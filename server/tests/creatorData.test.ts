import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/database.js";
import { loadCreatorFile, seedCreators, validateCreators } from "../src/db/seed.js";
import { createCreatorRepository } from "../src/repositories/creatorRepository.js";
import { INDUSTRIES } from "../src/types.js";
import { testCreator } from "./helpers.js";

const realData = loadCreatorFile() as Array<Record<string, any>>;

describe("curated creator dataset", () => {
  it("passes validation and contains 20–30 creators", () => {
    const creators = validateCreators(realData);
    expect(creators.length).toBeGreaterThanOrEqual(20);
    expect(creators.length).toBeLessThanOrEqual(30);
  });

  it("covers every content category with at least two creators", () => {
    for (const niche of INDUSTRIES) {
      expect(realData.filter((c) => c.niche === niche).length, niche).toBeGreaterThanOrEqual(2);
    }
  });

  it("gives every creator at least one source and a verification note", () => {
    for (const c of realData) {
      expect(c.sourceUrls.length, c.name).toBeGreaterThan(0);
      expect(c.verificationNote, c.name).toBeTruthy();
    }
  });

  it("only uses https source links", () => {
    for (const c of realData) {
      for (const u of [...c.sourceUrls, ...c.ownedBrands.map((b: any) => b.sourceUrl), ...c.audienceMetrics.map((m: any) => m.sourceUrl)]) {
        expect(u, c.name).toMatch(/^https:\/\//);
      }
    }
  });

  it("profile URLs point at the stored handle on the stored platform", () => {
    for (const c of realData) {
      const url = new URL(c.profileUrl);
      const handle = c.handle.toLowerCase();
      if (c.primaryPlatform === "tiktok") {
        expect(url.hostname, c.name).toBe("www.tiktok.com");
        expect(url.pathname.toLowerCase(), c.name).toBe(`/@${handle}`);
      } else if (c.primaryPlatform === "instagram") {
        expect(url.hostname, c.name).toBe("www.instagram.com");
        expect(url.pathname.toLowerCase(), c.name).toBe(`/${handle}/`);
      } else {
        expect(url.hostname, c.name).toBe("www.youtube.com");
        // Either /@handle, a legacy /handle or /user/handle URL, or a canonical channel-ID URL.
        const p = url.pathname;
        const ok = p.toLowerCase() === `/@${handle}` || p.toLowerCase() === `/${handle}` || p.toLowerCase() === `/user/${handle}` || /^\/channel\/UC[A-Za-z0-9_-]{22}$/.test(p);
        expect(ok, `${c.name}: ${c.profileUrl}`).toBe(true);
      }
    }
  });

  it("every creator with a channel-ID URL explains how the channel was confirmed", () => {
    for (const c of realData.filter((x) => /\/channel\//.test(x.profileUrl))) {
      expect(c.verificationNote, c.name).toMatch(/confirmed/i);
    }
  });

  it("never stores pricing, demographics or engagement data", () => {
    const text = JSON.stringify(realData).toLowerCase();
    for (const banned of ["engagement rate", "sponsorship rate", "per post", "% female", "% male", "cpm"]) {
      expect(text).not.toContain(banned);
    }
  });
});

describe("creator validation rejects bad or incomplete data", () => {
  it("rejects a creator with no sources", () => {
    expect(() => validateCreators([{ ...testCreator, sourceUrls: [] }])).toThrow(/at least one source/);
  });

  it("rejects an audience figure without a date or source", () => {
    const metric = { label: "YouTube subscribers", value: 1000, asOf: "2025-12", sourceUrl: "https://example.com" };
    expect(() => validateCreators([{ ...testCreator, audienceMetrics: [{ ...metric, asOf: "recently" }] }])).toThrow(/YYYY/);
    expect(() => validateCreators([{ ...testCreator, audienceMetrics: [{ ...metric, sourceUrl: undefined }] }])).toThrow(/source URL/);
    expect(validateCreators([{ ...testCreator, audienceMetrics: [metric] }])).toHaveLength(1);
  });

  it("rejects fields that aren't part of the vetted schema (e.g. invented rates)", () => {
    expect(() => validateCreators([{ ...testCreator, sponsorshipRate: 5000 }])).toThrow(/sponsorshipRate/);
  });

  it("rejects a profile URL that does not match the platform", () => {
    expect(() => validateCreators([{ ...testCreator, profileUrl: "https://www.tiktok.com/@test_creator" }])).toThrow(/does not match/);
  });

  it("rejects a handle that includes @", () => {
    expect(() => validateCreators([{ ...testCreator, handle: "@test" }])).toThrow(/Handle/);
  });

  it("rejects duplicate platform + handle pairs", () => {
    expect(() => validateCreators([testCreator, { ...testCreator, name: "Copy" }])).toThrow(/Duplicate/);
  });

  it("names the invalid creator in the error message", () => {
    expect(() => validateCreators([{ ...testCreator, name: "Broken Person", niche: "crypto" }])).toThrow(/Broken Person/);
  });

  it("does not write anything if one creator is invalid (all-or-nothing)", () => {
    const db = openDatabase(":memory:");
    expect(() => seedCreators(db, [testCreator, { ...testCreator, handle: "x", sourceUrls: [] }])).toThrow();
    expect(createCreatorRepository(db).count()).toBe(0);
  });
});

describe("seeding", () => {
  it("re-seeding updates creators in place, keeping ids and saved drafts", () => {
    const db = openDatabase(":memory:");
    seedCreators(db, [testCreator]);
    const repo = createCreatorRepository(db);
    const [before] = repo.findAll();

    db.prepare(
      `INSERT INTO campaigns (brand_name, product, industry, description, target_audience, age_min, age_max, platforms, budget, currency, goal)
       VALUES ('B', 'P', 'skincare', 'd', 't', 18, 30, '["youtube"]', 1, 'GBP', 'awareness')`,
    ).run();
    db.prepare("INSERT INTO outreach_drafts (campaign_id, creator_id, subject, body) VALUES (1, ?, 's', 'b')").run(before.id);

    const result = seedCreators(db, [{ ...testCreator, description: "Updated description from new research" }]);
    const [after] = repo.findAll();
    expect(result).toEqual({ total: 1, removed: 0 });
    expect(after.id).toBe(before.id);
    expect(after.description).toBe("Updated description from new research");
    expect((db.prepare("SELECT COUNT(*) AS n FROM outreach_drafts").get() as { n: number }).n).toBe(1);
  });

  it("removes creators that were taken out of the dataset", () => {
    const db = openDatabase(":memory:");
    seedCreators(db, [testCreator, { ...testCreator, handle: "second", profileUrl: "https://www.youtube.com/@second" }]);
    expect(seedCreators(db, [testCreator])).toEqual({ total: 1, removed: 1 });
  });

  it("keeps unverified fields as null/empty instead of inventing values", () => {
    const db = openDatabase(":memory:");
    seedCreators(db, [testCreator]);
    const [creator] = createCreatorRepository(db).findAll();
    expect(creator.description).toBeNull();
    expect(creator.audienceMetrics).toEqual([]);
    expect(creator.considerations).toBeNull();
    expect(creator.ownedBrands).toEqual([]);
    expect(creator.verificationStatus).toBe("needs_manual_verification");
  });

  it("refuses to open a database created by an older schema version", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cm-")), "old.db");
    const old = openDatabase(file);
    old.pragma("user_version = 1"); // pretend it was created by version 1
    old.close();
    expect(() => openDatabase(file)).toThrow(/db:reset/);
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });
});
