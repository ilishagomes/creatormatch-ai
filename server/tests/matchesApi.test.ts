import request from "supertest";
import { describe, expect, it } from "vitest";
import { makeTestApp, validCampaign } from "./helpers.js";

describe("matches API", () => {
  const { app } = makeTestApp({ seed: true });

  it("ranks real creators for a skincare campaign with skincare creators on top", async () => {
    const created = await request(app).post("/api/campaigns").send(validCampaign);
    const res = await request(app).get(`/api/campaigns/${created.body.id}/matches`);
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThanOrEqual(20);
    expect(res.body.results[0].creator.niche).toBe("skincare");
    const scores = res.body.results.map((r: { match: { score: number } }) => r.match.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("produces different rankings for different campaigns", async () => {
    const beauty = await request(app).post("/api/campaigns").send(validCampaign);
    const tech = await request(app)
      .post("/api/campaigns")
      .send({
        ...validCampaign,
        industry: "technology",
        product: "Wireless earbuds",
        description: "Launching new earbuds and want honest tech reviews of our smartphones accessories and gadgets.",
        platforms: ["youtube"],
      });
    const a = await request(app).get(`/api/campaigns/${beauty.body.id}/matches`);
    const b = await request(app).get(`/api/campaigns/${tech.body.id}/matches`);
    expect(a.body.results[0].creator.id).not.toBe(b.body.results[0].creator.id);
    expect(b.body.results[0].creator.niche).toBe("technology");
  });

  it("changing ONLY the campaign category changes the ranking", async () => {
    const brief = { ...validCampaign, product: "New launch", description: "We are launching something new and want honest reviews.", targetAudience: "Adults", platforms: ["youtube", "tiktok", "instagram"] };
    const tops: Record<string, string[]> = {};
    for (const industry of ["skincare", "fitness", "technology", "food"]) {
      const c = await request(app).post("/api/campaigns").send({ ...brief, industry });
      const res = await request(app).get(`/api/campaigns/${c.body.id}/matches`);
      tops[industry] = res.body.results.slice(0, 3).map((r: { creator: { niche: string } }) => r.creator.niche);
    }
    for (const [industry, niches] of Object.entries(tops)) expect(niches, industry).toEqual([industry, industry, industry]);
  });

  it("returns one creator's breakdown", async () => {
    const created = await request(app).post("/api/campaigns").send(validCampaign);
    const res = await request(app).get(`/api/campaigns/${created.body.id}/matches/1`);
    expect(res.status).toBe(200);
    expect(res.body.match.components).toHaveLength(4);
  });

  it("returns 404 for a missing campaign or creator", async () => {
    expect((await request(app).get("/api/campaigns/999/matches")).status).toBe(404);
    const created = await request(app).post("/api/campaigns").send(validCampaign);
    expect((await request(app).get(`/api/campaigns/${created.body.id}/matches/999`)).status).toBe(404);
  });

  it("returns 400 for a non-numeric campaign id", async () => {
    const res = await request(app).get("/api/campaigns/abc/matches");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid campaign id");
  });
});
