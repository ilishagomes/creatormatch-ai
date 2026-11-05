import request from "supertest";
import { describe, expect, it } from "vitest";
import { makeTestApp, validCampaign } from "./helpers.js";

describe("campaigns API", () => {
  it("creates a campaign and returns it with an id", async () => {
    const { app } = makeTestApp();
    const res = await request(app).post("/api/campaigns").send(validCampaign);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTypeOf("number");
    expect(res.body.platforms).toEqual(["instagram", "tiktok"]);
  });

  it("retrieves a saved campaign by id and in the list", async () => {
    const { app } = makeTestApp();
    const created = await request(app).post("/api/campaigns").send(validCampaign);

    const one = await request(app).get(`/api/campaigns/${created.body.id}`);
    expect(one.status).toBe(200);
    expect(one.body.brandName).toBe("Glow Lab");

    const list = await request(app).get("/api/campaigns");
    expect(list.body).toHaveLength(1);
  });

  it("returns 400 with field details for invalid input", async () => {
    const { app } = makeTestApp();
    const res = await request(app).post("/api/campaigns").send({ ...validCampaign, budget: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details[0].field).toBe("budget");
  });

  it("returns 400 for malformed JSON", async () => {
    const { app } = makeTestApp();
    const res = await request(app)
      .post("/api/campaigns")
      .set("Content-Type", "application/json")
      .send("{ not json");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not valid JSON/);
  });

  it("returns 404 for a campaign that does not exist", async () => {
    const { app } = makeTestApp();
    const res = await request(app).get("/api/campaigns/999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Campaign not found");
  });

  it("returns 400 for a non-numeric id", async () => {
    const { app } = makeTestApp();
    const res = await request(app).get("/api/campaigns/abc");
    expect(res.status).toBe(400);
  });

  it("returns 404 JSON for unknown API routes", async () => {
    const { app } = makeTestApp();
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Route not found");
  });
});
