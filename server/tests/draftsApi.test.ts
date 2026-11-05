import request from "supertest";
import { describe, expect, it } from "vitest";
import { makeTestApp, validCampaign } from "./helpers.js";

async function setup() {
  const { app } = makeTestApp({ seed: true });
  const campaign = await request(app).post("/api/campaigns").send(validCampaign);
  const draft = { campaignId: campaign.body.id, creatorId: 1, subject: "Hello", body: "Draft body", personalizationNote: "Note" };
  return { app, campaignId: campaign.body.id as number, draft };
}

describe("drafts API", () => {
  it("saves a draft as unreviewed by default, with creator and brand names", async () => {
    const { app, draft } = await setup();
    const res = await request(app).post("/api/drafts").send(draft);
    expect(res.status).toBe(201);
    expect(res.body.reviewed).toBe(false);
    expect(res.body.aiGenerated).toBe(true);
    expect(res.body.brandName).toBe("Glow Lab");
    expect(res.body.creatorName).toBeTypeOf("string");
  });

  it("records which model wrote an AI draft, and none for a manual draft", async () => {
    const { app, draft } = await setup();
    const ai = await request(app).post("/api/drafts").send({ ...draft, aiModel: "claude-opus-5-5" });
    const manual = await request(app).post("/api/drafts").send({ ...draft, aiGenerated: false, aiModel: "claude-opus-5-5" });
    expect(ai.body.aiModel).toBe("claude-opus-5-5");
    expect(manual.body.aiModel).toBeNull();
  });

  it("lists drafts, optionally filtered by campaign", async () => {
    const { app, draft, campaignId } = await setup();
    await request(app).post("/api/drafts").send(draft);
    expect((await request(app).get("/api/drafts")).body).toHaveLength(1);
    expect((await request(app).get(`/api/drafts?campaignId=${campaignId}`)).body).toHaveLength(1);
    expect((await request(app).get(`/api/drafts?campaignId=999`)).body).toHaveLength(0);
  });

  it("edits a draft and marks it as reviewed", async () => {
    const { app, draft } = await setup();
    const created = await request(app).post("/api/drafts").send(draft);
    const res = await request(app).put(`/api/drafts/${created.body.id}`).send({ body: "Edited body", reviewed: true });
    expect(res.status).toBe(200);
    expect(res.body.body).toBe("Edited body");
    expect(res.body.reviewed).toBe(true);
    expect(res.body.subject).toBe("Hello");
  });

  it("rejects an empty update and an empty subject", async () => {
    const { app, draft } = await setup();
    const created = await request(app).post("/api/drafts").send(draft);
    expect((await request(app).put(`/api/drafts/${created.body.id}`).send({})).status).toBe(400);
    expect((await request(app).put(`/api/drafts/${created.body.id}`).send({ subject: "  " })).status).toBe(400);
  });

  it("rejects a draft for a creator or campaign that does not exist", async () => {
    const { app, draft } = await setup();
    expect((await request(app).post("/api/drafts").send({ ...draft, creatorId: 999 })).status).toBe(404);
    expect((await request(app).post("/api/drafts").send({ ...draft, campaignId: 999 })).status).toBe(404);
  });

  it("deletes a draft", async () => {
    const { app, draft } = await setup();
    const created = await request(app).post("/api/drafts").send(draft);
    expect((await request(app).delete(`/api/drafts/${created.body.id}`)).status).toBe(204);
    expect((await request(app).get(`/api/drafts/${created.body.id}`)).status).toBe(404);
    expect((await request(app).delete(`/api/drafts/${created.body.id}`)).status).toBe(404);
  });
});
