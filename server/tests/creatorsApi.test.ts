import request from "supertest";
import { describe, expect, it } from "vitest";
import { makeTestApp } from "./helpers.js";

describe("creators API", () => {
  const { app } = makeTestApp({ seed: true });

  it("lists all seeded creators with parsed arrays", async () => {
    const res = await request(app).get("/api/creators");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(20);
    expect(Array.isArray(res.body[0].tags)).toBe(true);
    expect(Array.isArray(res.body[0].sourceUrls)).toBe(true);
  });

  it("filters by niche", async () => {
    const res = await request(app).get("/api/creators?niche=fitness");
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((c: { niche: string }) => c.niche === "fitness")).toBe(true);
  });

  it("filters by platform", async () => {
    const res = await request(app).get("/api/creators?platform=tiktok");
    expect(res.body.every((c: { primaryPlatform: string }) => c.primaryPlatform === "tiktok")).toBe(true);
  });

  it("searches name, handle and tags", async () => {
    const res = await request(app).get("/api/creators?search=dermatology");
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("returns 400 for an invalid niche filter", async () => {
    const res = await request(app).get("/api/creators?niche=crypto");
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe("niche");
  });

  it("gets a creator by id", async () => {
    const list = await request(app).get("/api/creators");
    const res = await request(app).get(`/api/creators/${list.body[0].id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(list.body[0].name);
  });

  it("returns 404 for an unknown creator", async () => {
    const res = await request(app).get("/api/creators/99999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Creator not found");
  });
});
