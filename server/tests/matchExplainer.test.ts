import type Anthropic from "@anthropic-ai/sdk";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { MessagesClient } from "../src/services/ai.js";
import { buildFacts, checkExplanation, createClaudeMatchExplainer, type MatchExplainer } from "../src/services/matchExplainer.js";
import { scoreCreator } from "../src/services/matching/index.js";
import { makeTestApp, testCreator, validCampaign } from "./helpers.js";

const campaign = { ...validCampaign, id: 1, createdAt: "", industry: "skincare" } as any;
const creator = { ...testCreator, id: 1, niche: "skincare", tags: ["skincare", "serum"] } as any;
const input = { campaign, creator, match: scoreCreator(campaign, creator) };
const facts = buildFacts(input);

function fakeClient(text: string, extra: Partial<Anthropic.Beta.BetaMessage> = {}) {
  const create = vi.fn().mockResolvedValue({ model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text, citations: null }], ...extra });
  return { client: { create } as unknown as MessagesClient, create };
}

describe("Claude explanation guardrails", () => {
  const good = `This creator is a ${input.match.tier.toLowerCase()} fit with a score of ${input.match.score}, based on ${input.match.coverage.percent}% of the scoring model. Their audience data is not verified, so that part was not measured.`;

  it("accepts an explanation that only uses numbers from the calculated results", () => {
    expect(checkExplanation(good, facts)).toEqual([]);
  });

  it("rejects invented numbers", () => {
    expect(checkExplanation("A great fit — probably 73% likely to say yes.", facts).join(" ")).toMatch(/73/);
  });

  it("rejects audience statistics and links", () => {
    expect(checkExplanation(`Score ${input.match.score}; huge reach across social.`, facts).join(" ")).toMatch(/audience statistics/);
    expect(checkExplanation(`Score ${input.match.score}. See https://example.com`, facts).join(" ")).toMatch(/link/);
  });

  it("sends Claude only the calculated facts and returns a validated explanation", async () => {
    const { client, create } = fakeClient(JSON.stringify({ explanation: good }));
    const result = await createClaudeMatchExplainer(client, "claude-opus-5-5").explain(input);
    expect(result.explanation).toBe(good);
    const sent = JSON.parse(create.mock.calls[0][0].messages[0].content);
    expect(sent.result.score).toBe(input.match.score);
    expect(sent.creator).toEqual({ name: creator.name, mainCategory: "skincare", primaryPlatform: "youtube" });
  });

  it("discards an AI explanation that invents a metric", async () => {
    const { client } = fakeClient(JSON.stringify({ explanation: "This creator has 2 million followers and is an excellent, strong match for the brand." }));
    await expect(createClaudeMatchExplainer(client, "m").explain(input)).rejects.toThrow(/isn't in the calculated results/);
  });

  it("handles refusals and invalid JSON", async () => {
    await expect(createClaudeMatchExplainer(fakeClient("", { stop_reason: "refusal" }).client, "m").explain(input)).rejects.toThrow(/declined/);
    await expect(createClaudeMatchExplainer(fakeClient("not json").client, "m").explain(input)).rejects.toThrow(/valid JSON/);
  });
});

describe("POST /api/campaigns/:id/matches/:creatorId/explanation", () => {
  async function setup(explainer: MatchExplainer | null) {
    const { app } = makeTestApp({ seed: true, matchExplainer: explainer });
    const c = await request(app).post("/api/campaigns").send(validCampaign);
    return { app, id: c.body.id as number };
  }

  it("returns 503 when AI is not configured", async () => {
    const { app, id } = await setup(null);
    const res = await request(app).post(`/api/campaigns/${id}/matches/1/explanation`);
    expect(res.status).toBe(503);
  });

  it("passes the deterministic match to the explainer and returns its text", async () => {
    const explain = vi.fn().mockResolvedValue({ explanation: "ok", model: "fake" });
    const { app, id } = await setup({ explain });
    const res = await request(app).post(`/api/campaigns/${id}/matches/1/explanation`);
    expect(res.status).toBe(200);
    expect(explain.mock.calls[0][0].match.score).toBeTypeOf("number");
  });
});
