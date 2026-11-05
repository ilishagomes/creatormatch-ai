import Anthropic from "@anthropic-ai/sdk";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { AiResponseError, type OutreachGenerator } from "../src/services/outreach.js";
import { makeTestApp, validCampaign } from "./helpers.js";

const fakeEmail = {
  subject: "Partnership idea",
  body: "x".repeat(100),
  personalizationNote: "Used verified topics.",
  model: "fake-model",
  generatedAt: "2026-11-05T00:00:00.000Z",
  attempts: 1,
  requiresHumanReview: true as const,
};
const generatorReturning = (impl: OutreachGenerator["generate"]): OutreachGenerator => ({ generate: vi.fn(impl) });

async function setup(generator: OutreachGenerator | null, aiRequestsPerMinute?: number) {
  const { app } = makeTestApp({ seed: true, outreachGenerator: generator, aiRequestsPerMinute });
  const campaign = await request(app).post("/api/campaigns").send(validCampaign);
  return { app, campaignId: campaign.body.id as number };
}

describe("POST /api/outreach/generate", () => {
  it("returns 503 with setup instructions when no API key is configured", async () => {
    const { app, campaignId } = await setup(null);
    const res = await request(app).post("/api/outreach/generate").send({ campaignId, creatorId: 1 });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("returns the generated email and passes the match to the generator", async () => {
    const generator = generatorReturning(async () => fakeEmail);
    const { app, campaignId } = await setup(generator);
    const res = await request(app).post("/api/outreach/generate").send({ campaignId, creatorId: 1 });
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe("Partnership idea");
    const arg = vi.mocked(generator.generate).mock.calls[0][0];
    expect(arg.creator.id).toBe(1);
    expect(arg.match.score).toBeTypeOf("number");
  });

  it("validates the request body", async () => {
    const { app } = await setup(generatorReturning(async () => fakeEmail));
    const res = await request(app).post("/api/outreach/generate").send({ campaignId: "one" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a missing campaign or creator", async () => {
    const { app, campaignId } = await setup(generatorReturning(async () => fakeEmail));
    expect((await request(app).post("/api/outreach/generate").send({ campaignId: 999, creatorId: 1 })).status).toBe(404);
    expect((await request(app).post("/api/outreach/generate").send({ campaignId, creatorId: 999 })).status).toBe(404);
  });

  it("returns 502 with details when the AI response fails validation", async () => {
    const { app, campaignId } = await setup(
      generatorReturning(async () => {
        throw new AiResponseError("The AI response broke a content safety rule, so it was discarded", ["Contains a URL"]);
      }),
    );
    const res = await request(app).post("/api/outreach/generate").send({ campaignId, creatorId: 1 });
    expect(res.status).toBe(502);
    expect(res.body.details).toEqual(["Contains a URL"]);
    expect(res.body).toMatchObject({ code: "schema", retryable: true });
  });

  it("returns 429 when the AI service rate limits", async () => {
    const { app, campaignId } = await setup(
      generatorReturning(async () => {
        throw new Anthropic.RateLimitError(429, undefined, "rate limited", new Headers());
      }),
    );
    const res = await request(app).post("/api/outreach/generate").send({ campaignId, creatorId: 1 });
    expect(res.status).toBe(429);
  });

  it("marks every generated draft as requiring human review", async () => {
    const { app, campaignId } = await setup(generatorReturning(async () => fakeEmail));
    const res = await request(app).post("/api/outreach/generate").send({ campaignId, creatorId: 1 });
    expect(res.body.requiresHumanReview).toBe(true);
  });

  it("limits AI requests per client to protect the paid API", async () => {
    const { app, campaignId } = await setup(generatorReturning(async () => fakeEmail), 2);
    for (let i = 0; i < 2; i++) expect((await request(app).post("/api/outreach/generate").send({ campaignId, creatorId: 1 })).status).toBe(200);
    const blocked = await request(app).post("/api/outreach/generate").send({ campaignId, creatorId: 1 });
    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("reports whether AI is configured on the health endpoint", async () => {
    expect((await request((await setup(null)).app).get("/api/health")).body.aiConfigured).toBe(false);
  });
});
