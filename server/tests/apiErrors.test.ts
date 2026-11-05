import request from "supertest";
import { describe, expect, it } from "vitest";
import { makeTestApp, validCampaign } from "./helpers.js";

/** Every failure must come back as a clear JSON error — never a crash or an HTML page. */
describe("API error handling", () => {
  const { app } = makeTestApp({ seed: true });

  it("rejects an oversized body with 413", async () => {
    const res = await request(app).post("/api/campaigns").set("Content-Type", "application/json").send(JSON.stringify({ brandName: "x".repeat(200_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/too large/);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await request(app).post("/api/drafts").set("Content-Type", "application/json").send("{ bad");
    expect(res.status).toBe(400);
  });

  it("returns a validation error (not a crash) when the body is missing or not JSON", async () => {
    const res = await request(app).post("/api/campaigns").set("Content-Type", "text/plain").send("hello");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it.each([
    ["GET", "/api/campaigns/0"],
    ["GET", "/api/campaigns/-1"],
    ["GET", "/api/campaigns/1.5"],
    ["GET", "/api/creators/abc"],
    ["GET", "/api/campaigns/abc/matches/1"],
    ["PUT", "/api/drafts/xyz"],
  ])("returns 400 for an invalid id: %s %s", async (method, url) => {
    const res = await (request(app) as any)[method.toLowerCase()](url).send({ subject: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid/);
  });

  it("returns JSON 404 for unknown routes and wrong methods", async () => {
    for (const res of [await request(app).get("/api/unknown"), await request(app).delete("/api/campaigns/1")]) {
      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toMatch(/json/);
    }
  });

  it("returns 400 for invalid filter values", async () => {
    expect((await request(app).get("/api/creators?platform=myspace")).status).toBe(400);
    expect((await request(app).get("/api/drafts?campaignId=abc")).status).toBe(400);
  });

  it("returns 404 when saving a draft for a missing campaign, and 503 for AI without a key", async () => {
    expect((await request(app).post("/api/drafts").send({ campaignId: 999, creatorId: 1, subject: "s", body: "b" })).status).toBe(404);
    const c = await request(app).post("/api/campaigns").send(validCampaign);
    expect((await request(app).post("/api/outreach/generate").send({ campaignId: c.body.id, creatorId: 1 })).status).toBe(503);
  });
});
