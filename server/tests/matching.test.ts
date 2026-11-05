import { describe, expect, it } from "vitest";
import {
  analyzeCampaign, FIELD_WEIGHTS, rankCreators, RELATED_NICHES, scoreCreator, WEIGHTS,
} from "../src/services/matching/index.js";
import { loadCreatorFile } from "../src/db/seed.js";
import { TOPICS } from "../src/services/matching/taxonomy.js";
import { findTerms, tokenize } from "../src/services/matching/text.js";
import type { Campaign, Creator } from "../src/types.js";

// ----------------------------------------------------------------- fixtures
// Fictional fixtures on purpose: unit tests must not depend on the real dataset.

const skincareCampaign: Campaign = {
  id: 1, brandName: "Glow Lab", product: "Vitamin C serum", industry: "skincare",
  description: "A gentle serum for sensitive skin. We want honest product reviews and ingredient education.",
  targetAudience: "Skincare enthusiasts", ageMin: 18, ageMax: 34, platforms: ["youtube"],
  budget: 5000, currency: "GBP", goal: "product_launch", createdAt: "2026-11-05",
};

const creator = (overrides: Partial<Creator> = {}): Creator => ({
  id: 1, name: "Skincare Fixture", handle: "skin_fixture", primaryPlatform: "youtube",
  profileUrl: "https://www.youtube.com/@skin_fixture", niche: "skincare",
  tags: ["skincare", "serum", "ingredients", "product reviews"], description: null,
  audienceMetrics: [], verifiedAudience: null, sourceUrls: ["https://example.com"], dateVerified: "2026-11-05",
  verificationStatus: "verified", verificationNote: null, considerations: null, ownedBrands: [],
  ...overrides,
});

const gamingCreator = creator({
  id: 2, name: "Gaming Fixture", handle: "gaming_fixture", niche: "technology",
  tags: ["gaming", "pc hardware", "esports"],
});

const comp = (c: Campaign, cr: Creator, key: string) => scoreCreator(c, cr).components.find((x) => x.key === key)!;

// ============================================================ REQUIRED TESTS

describe("required behaviour", () => {
  it("1. a skincare creator scores higher than an unrelated gaming creator for a skincare campaign", () => {
    const skin = scoreCreator(skincareCampaign, creator());
    const gaming = scoreCreator(skincareCampaign, gamingCreator);
    expect(skin.score).toBeGreaterThan(gaming.score);
    expect(comp(skincareCampaign, gamingCreator, "niche").value).toBe(0);
    expect(comp(skincareCampaign, gamingCreator, "keywords").value).toBeLessThan(0.2);
  });

  it("2. changing the platform changes the rankings", () => {
    const yt = creator({ id: 10, name: "A YouTube creator", primaryPlatform: "youtube" });
    const tt = creator({ id: 11, name: "B TikTok creator", handle: "b", primaryPlatform: "tiktok", profileUrl: "https://www.tiktok.com/@b" });
    const onYouTube = rankCreators({ ...skincareCampaign, platforms: ["youtube"] }, [yt, tt]).map((r) => r.creator.id);
    const onTikTok = rankCreators({ ...skincareCampaign, platforms: ["tiktok"] }, [yt, tt]).map((r) => r.creator.id);
    expect(onYouTube).toEqual([10, 11]);
    expect(onTikTok).toEqual([11, 10]);
  });

  it("3. changing the campaign category changes the rankings", () => {
    const pool = [creator(), gamingCreator];
    const forSkincare = rankCreators(skincareCampaign, pool).map((r) => r.creator.id);
    const forTech = rankCreators({
      ...skincareCampaign, industry: "technology", product: "Gaming keyboard",
      description: "A mechanical keyboard for gaming and PC builds. We want honest product reviews.",
    }, pool).map((r) => r.creator.id);
    expect(forSkincare[0]).toBe(1);
    expect(forTech[0]).toBe(2);
  });

  it("4. missing demographic data is marked unknown — never turned into an invented value", () => {
    const r = scoreCreator(skincareCampaign, creator({ verifiedAudience: null }));
    const audience = r.components.find((c) => c.key === "audience")!;
    expect(audience.status).toBe("unknown");
    expect(audience.value).toBeNull(); // not 0, not 0.5 — null
    expect(audience.points).toBeNull();
    expect(r.coverage.percent).toBe(100 - WEIGHTS.audience); // 85%
    expect(r.coverage.excluded.map((e) => e.key)).toEqual(["audience"]);
    expect(r.warnings.join(" ")).toMatch(/No verified audience demographics/);
  });

  it("5. the same input always produces the same numerical score", () => {
    const first = scoreCreator(skincareCampaign, creator());
    for (let i = 0; i < 50; i++) expect(scoreCreator(skincareCampaign, creator())).toEqual(first);
    const pool = [gamingCreator, creator(), creator({ id: 3, name: "Another", handle: "x", niche: "beauty" })];
    expect(rankCreators(skincareCampaign, pool)).toEqual(rankCreators(skincareCampaign, [...pool].reverse()));
  });
});

// ================================================================ the maths

describe("score normalisation and coverage", () => {
  it("rescales over measured components: score = earned ÷ available × 100", () => {
    const r = scoreCreator(skincareCampaign, creator());
    const scored = r.components.filter((c) => c.status === "scored");
    const earned = scored.reduce((s, c) => s + c.weight * (c.value as number), 0);
    const available = scored.reduce((s, c) => s + c.weight, 0);
    expect(available).toBe(85);
    expect(r.score).toBe(Math.round((earned / available) * 100));
  });

  it("a perfect match on every measurable component scores 100 even with audience unknown", () => {
    const perfect = creator({ tags: ["serum", "sensitive skin", "product reviews", "ingredient education", "skincare"] });
    expect(scoreCreator(skincareCampaign, perfect).score).toBe(100);
  });

  it("uses verified audience data when it exists, and reaches 100% coverage", () => {
    const full = scoreCreator(skincareCampaign, creator({ verifiedAudience: { ageMin: 18, ageMax: 24, asOf: "2025-01", sourceUrl: "https://example.com" } }));
    const audience = full.components.find((c) => c.key === "audience")!;
    expect(audience.status).toBe("scored");
    expect(audience.value).toBeCloseTo(7 / 17); // ages 18–24 overlap 7 of the 17 years in 18–34
    expect(full.coverage.percent).toBe(100);
  });

  it("weights sum to 100", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("excludes keyword relevance when the brief has no recognised topics", () => {
    const vague = { ...skincareCampaign, product: "New thing", description: "Something exciting is coming soon for everyone.", targetAudience: "People" };
    const r = scoreCreator(vague, creator());
    expect(r.components.find((c) => c.key === "keywords")!.status).toBe("not_applicable");
    expect(r.coverage.percent).toBe(60); // niche 40 + platform 20
  });
});

// ======================================================= related-term matching

describe("topic taxonomy: related terms match", () => {
  const family = (word: string) => findTerms(word)[0]?.topic.family;
  it.each([
    [["moisturizer", "serum", "acne", "skincare"], "skincare"],
    [["running", "gym", "exercise", "activewear"], "fitness"],
    [["laptops", "software", "gadgets", "consumer technology"], "technology"],
  ])("%j all belong to the %s family", (words, fam) => {
    for (const w of words) expect(family(w), w).toBe(fam);
  });

  it("gives partial credit for a related topic and full credit for the same topic", () => {
    const brief = { ...skincareCampaign, product: "Moisturizer", description: "A rich moisturizer for dry skin.", targetAudience: "Adults" };
    const exact = scoreCreator(brief, creator({ tags: ["moisturizer"] })).matchedKeywords[0];
    const related = scoreCreator(brief, creator({ tags: ["acne"] })).matchedKeywords[0];
    expect(exact.relation).toBe("exact");
    expect(related.relation).toBe("related"); // acne ≈ moisturizer (both skincare)
    expect(comp(brief, creator({ tags: ["moisturizer"] }), "keywords").value).toBe(1);
    expect(comp(brief, creator({ tags: ["acne"] }), "keywords").value).toBe(0.5);
  });

  it("uses longest-match-first, so 'home workouts' is not also read as 'home'", () => {
    expect(findTerms("quick home workouts").map((h) => h.topic.id)).toEqual(["fitness.home"]);
  });

  it("treats 'fragrance-free' as its own term so it does not match 'fragrance'", () => {
    expect(tokenize("Fragrance-free, gluten free snacks")).toEqual(["fragrancefree", "glutenfree", "snack"]);
    expect(findTerms("fragrance-free cream").some((h) => h.topic.id === "beauty.fragrance")).toBe(false);
  });

  it("every taxonomy term maps to exactly one topic (no ambiguous duplicates)", () => {
    const seen = new Map<string, string>();
    for (const t of TOPICS) for (const term of t.terms) {
      const key = tokenize(term).join(" ");
      expect(seen.get(key) ?? t.id, `"${term}" in ${t.id} and ${seen.get(key)}`).toBe(t.id);
      seen.set(key, t.id);
    }
  });
});

// ============================================== not all keywords are equal

describe("keyword importance", () => {
  it("a topic in the product name counts more than the same topic in the audience field", () => {
    const inProduct = analyzeCampaign({ ...skincareCampaign, product: "Acne patch", description: "Launch.", targetAudience: "Adults" });
    const inAudience = analyzeCampaign({ ...skincareCampaign, product: "Patch", description: "Launch.", targetAudience: "People with acne" });
    expect(inProduct.find((t) => t.topic.id === "skincare.acne")!.importance).toBe(FIELD_WEIGHTS.product);
    expect(inAudience.find((t) => t.topic.id === "skincare.acne")!.importance).toBe(FIELD_WEIGHTS.targetAudience);
  });

  it("a specific topic (acne) counts more than a broad one (reviews)", () => {
    const topics = analyzeCampaign({ ...skincareCampaign, product: "Kit", description: "Acne care with honest reviews.", targetAudience: "Adults" });
    const acne = topics.find((t) => t.topic.id === "skincare.acne")!;
    const reviews = topics.find((t) => t.topic.id === "format.reviews")!;
    expect(acne.importance).toBeGreaterThan(reviews.importance);
  });

  it("matching the central product topic beats matching only a broad format topic", () => {
    const serumCreator = creator({ tags: ["serum"] });
    const reviewsOnly = creator({ tags: ["product reviews"], niche: "skincare" });
    expect(comp(skincareCampaign, serumCreator, "keywords").value!).toBeGreaterThan(comp(skincareCampaign, reviewsOnly, "keywords").value!);
  });
});

// ======================================================= conflicts are separate

describe("conflict flags", () => {
  const owner = creator({ ownedBrands: [{ name: "Rival Skin", keywords: ["serum"], sourceUrl: "https://example.com" }] });

  it("flags a creator who owns a competing brand", () => {
    const r = scoreCreator(skincareCampaign, owner);
    expect(r.conflicts).toEqual([expect.objectContaining({ type: "owned_brand", brand: "Rival Skin", matchedKeywords: ["serum"] })]);
    expect(r.explanation).toMatch(/Potential conflict/);
  });

  it("does NOT change the numerical score", () => {
    expect(scoreCreator(skincareCampaign, owner).score).toBe(scoreCreator(skincareCampaign, creator()).score);
  });

  it("ignores owned-brand categories the brief doesn't mention, and fragrance-free products", () => {
    const candle = creator({ ownedBrands: [{ name: "Candle Co", keywords: ["candle", "fragrance"], sourceUrl: "https://example.com" }] });
    expect(scoreCreator({ ...skincareCampaign, description: "A fragrance-free serum." }, candle).conflicts).toEqual([]);
  });
});

describe("RELATED_NICHES", () => {
  it("is symmetric, so A→B related always means B→A related", () => {
    for (const [a, related] of Object.entries(RELATED_NICHES)) {
      for (const b of related) expect(RELATED_NICHES[b as keyof typeof RELATED_NICHES]).toContain(a);
    }
  });

  it("gives related categories partial niche credit", () => {
    expect(comp(skincareCampaign, creator({ niche: "beauty" }), "niche").value).toBe(0.4);
  });
});

describe("taxonomy covers the curated dataset", () => {
  const data = loadCreatorFile() as Creator[];
  const tags = [...new Set(data.flatMap((c) => c.tags))];

  it("maps at least 90% of the dataset's tags to a topic (the rest are places/audiences, not content)", () => {
    const mapped = tags.filter((t) => findTerms(t).length > 0);
    expect(mapped.length / tags.length).toBeGreaterThanOrEqual(0.9);
  });

  it("gives every real creator at least two recognised content topics", () => {
    for (const c of data) {
      const topics = new Set(c.tags.flatMap((t) => findTerms(t).map((h) => h.topic.id)));
      expect(topics.size, c.name).toBeGreaterThanOrEqual(2);
    }
  });
});
