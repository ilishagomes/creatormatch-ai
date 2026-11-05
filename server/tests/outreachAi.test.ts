import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../src/middleware/errorHandler.js";
import { scoreCreator } from "../src/services/matching/index.js";
import {
  AiResponseError, buildUserPrompt, checkGuardrails, createClaudeOutreachGenerator, MAX_ATTEMPTS,
  OUTPUT_FORMAT, parseAiResponse, SYSTEM_PROMPT, toHttpError, type MessagesClient,
} from "../src/services/outreach.js";
import type { Campaign, Creator } from "../src/types.js";

/**
 * All tests here use MOCKED Claude responses — no network, no API key, no cost.
 * The real API is exercised separately by tests-live/ (npm run test:live).
 */

const campaign: Campaign = {
  id: 1, brandName: "Glow Lab", product: "Vitamin C serum", industry: "skincare",
  description: "A gentle vitamin C serum for sensitive skin; we want honest skincare reviews.",
  targetAudience: "Skincare fans", ageMin: 18, ageMax: 34, platforms: ["youtube"],
  budget: 5000, currency: "GBP", goal: "product_launch", createdAt: "2026-11-05",
};
const creator: Creator = {
  id: 7, name: "Fixture Creator", handle: "fixture", primaryPlatform: "youtube",
  profileUrl: "https://www.youtube.com/@fixture", niche: "skincare", tags: ["skincare", "product reviews"],
  description: "Dermatologist sharing skincare education.", audienceMetrics: [{ label: "YouTube subscribers", value: 1234567, asOf: "2025-01", sourceUrl: "https://example.com" }],
  verifiedAudience: null, sourceUrls: ["https://example.com"], dateVerified: "2026-11-05", verificationStatus: "verified",
  verificationNote: null, considerations: "SECRET INTERNAL NOTE",
  ownedBrands: [{ name: "Hidden Brand Co", keywords: ["serum"], sourceUrl: "https://example.com" }],
};
const req = { campaign, creator, match: scoreCreator(campaign, creator) };

const goodEmail = {
  subject: "Partnership idea: Glow Lab x Fixture Creator",
  body: "Hi Fixture Creator,\n\nWe loved how your skincare education focuses on honesty. Glow Lab is launching a gentle vitamin C serum for sensitive skin and we think it fits your content.\n\nWould you be open to discussing a paid partnership?\n\nBest,\n[Your name]\n[Your role]",
  personalizationNote: "Referenced the creator's skincare education and product reviews from the verified profile.",
};

const text = (t: string) => ({ model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text: t, citations: null }] });
/** A fake SDK client that returns the given responses in order. */
function fakeClient(...responses: object[]) {
  const create = vi.fn();
  for (const r of responses) create.mockResolvedValueOnce(r);
  return { client: { create } as unknown as MessagesClient, create };
}

// ------------------------------------------------------------- validation

describe("AI response validation (zod)", () => {
  it("accepts a well-formed response", () => {
    expect(parseAiResponse(JSON.stringify(goodEmail))).toEqual(goodEmail);
  });

  it("rejects text that is not JSON with code invalid_json", () => {
    expect(() => parseAiResponse("Sure! Here's your email: ...")).toThrow(expect.objectContaining({ code: "invalid_json" }));
  });

  it("rejects missing fields with code schema and lists them", () => {
    try {
      parseAiResponse(JSON.stringify({ subject: "Hello there" }));
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ code: "schema" });
      expect((e as AiResponseError).issues.join(" ")).toMatch(/body/);
      expect((e as AiResponseError).issues.join(" ")).toMatch(/personalizationNote/);
    }
  });

  it("rejects a body that is too short", () => {
    expect(() => parseAiResponse(JSON.stringify({ ...goodEmail, body: "Hi!" }))).toThrow(/wrong format/);
  });

  it("sends the API a JSON schema generated from the same zod schema", () => {
    expect(OUTPUT_FORMAT.schema).toMatchObject({ type: "object", required: ["subject", "body", "personalizationNote"], additionalProperties: false });
  });
});

describe("content guardrails", () => {
  const withBody = (extra: string) => ({ ...goodEmail, body: goodEmail.body + "\n" + extra });

  it("passes a clean email, including 'paid partnership' without an amount", () => {
    expect(checkGuardrails(goodEmail)).toEqual([]);
  });

  it.each([
    ["an invented email address", "Reach me at jane@glowlab.com", /email address/],
    ["an invented phone number", "Call +44 20 7946 0958", /phone number/],
    ["an invented URL", "See https://glowlab.example", /URL/],
    ["an unverified follower count", "Your 2.5M followers will love it", /audience statistics/],
    ["a payment amount (£)", "We can offer £2,000 for one video.", /payment amount/],
    ["a payment amount (words)", "Our fee is 500 dollars.", /payment amount/],
    ["a claim of prior contact", "Just following up on my last note.", /already contacted/],
    ["a claim of prior contact (2)", "As we discussed, here are details.", /already contacted/],
    ["an invented past partnership", "We loved our previous collaboration together.", /previous partnership/],
  ])("flags %s", (_label, extra, pattern) => {
    expect(checkGuardrails(withBody(extra)).join(" ")).toMatch(pattern);
    expect(() => parseAiResponse(JSON.stringify(withBody(extra)))).toThrow(expect.objectContaining({ code: "guardrail" }));
  });
});

// --------------------------------------------------------------- prompt

describe("prompt building", () => {
  const prompt = buildUserPrompt(req);

  it("includes brand, product description, goal, niche and the verified profile", () => {
    for (const s of ["Glow Lab", "Vitamin C serum", "gentle vitamin C serum for sensitive skin", "a product launch", "@fixture", "skincare", "Dermatologist sharing skincare education."]) {
      expect(prompt).toContain(s);
    }
  });

  it("never sends internal notes, owned brands, audience figures or the exact budget", () => {
    expect(prompt).not.toContain("SECRET INTERNAL NOTE");
    expect(prompt).not.toContain("Hidden Brand Co");
    expect(prompt).not.toContain("1234567");
    expect(prompt).not.toContain("5000");
  });

  it("leaves out a missing description instead of sending null", () => {
    const p = buildUserPrompt({ ...req, creator: { ...creator, description: null } });
    expect(p).not.toContain("publicProfileSummary");
    expect(p).not.toContain("null");
  });

  it("system prompt forbids each category of invented claim", () => {
    for (const rule of [/follower counts/, /worked with this brand or any other brand/, /already contacted/, /email addresses/, /payment amount/]) {
      expect(SYSTEM_PROMPT).toMatch(rule);
    }
  });
});

// ------------------------------------------------- generator with mocked SDK

describe("Claude generator (mocked SDK)", () => {
  it("sends a structured-output request with the configured model and returns a validated draft", async () => {
    const { client, create } = fakeClient(text(JSON.stringify(goodEmail)));
    const result = await createClaudeOutreachGenerator(client, "claude-opus-5-5").generate(req);
    expect(result).toMatchObject({ ...goodEmail, model: "claude-opus-5-5", attempts: 1, requiresHumanReview: true });
    const params = create.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.output_config.format.type).toBe("json_schema");
  });

  it("ignores non-text blocks such as thinking", async () => {
    const { client } = fakeClient({ ...text(JSON.stringify(goodEmail)), content: [{ type: "thinking", thinking: "", signature: "x" }, { type: "text", text: JSON.stringify(goodEmail), citations: null }] });
    await expect(createClaudeOutreachGenerator(client, "m").generate(req)).resolves.toMatchObject({ subject: goodEmail.subject });
  });

  it("automatically retries once when the first reply is malformed, then succeeds", async () => {
    const { client, create } = fakeClient(text("not json at all"), text(JSON.stringify(goodEmail)));
    const result = await createClaudeOutreachGenerator(client, "m").generate(req);
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
  });

  it("retries when a guardrail is broken, and gives up after MAX_ATTEMPTS with a helpful error", async () => {
    const bad = text(JSON.stringify({ ...goodEmail, body: goodEmail.body + " Email me: a@b.co" }));
    const { client, create } = fakeClient(bad, bad, bad);
    await expect(createClaudeOutreachGenerator(client, "m").generate(req)).rejects.toMatchObject({
      code: "guardrail", attempts: MAX_ATTEMPTS, retryable: true, message: expect.stringMatching(/2 attempts/),
    });
    expect(create).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("does not retry a refusal", async () => {
    const { client, create } = fakeClient({ ...text(""), stop_reason: "refusal" });
    await expect(createClaudeOutreachGenerator(client, "m").generate(req)).rejects.toMatchObject({ code: "refusal", retryable: false });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries a truncated reply", async () => {
    const { client, create } = fakeClient({ ...text('{"subject": "Hi'), stop_reason: "max_tokens" }, text(JSON.stringify(goodEmail)));
    await expect(createClaudeOutreachGenerator(client, "m").generate(req)).resolves.toMatchObject({ attempts: 2 });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("does not retry SDK errors itself (the SDK already retries network/429/5xx)", async () => {
    const create = vi.fn().mockRejectedValue(new Anthropic.AuthenticationError(401, undefined, "bad key", new Headers()));
    await expect(createClaudeOutreachGenerator({ create } as unknown as MessagesClient, "m").generate(req)).rejects.toBeInstanceOf(Anthropic.AuthenticationError);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

// --------------------------------------------------------- error mapping

describe("toHttpError", () => {
  const map = (e: unknown) => toHttpError(e) as HttpError;

  it("maps SDK errors to safe HTTP statuses with a retryable flag", () => {
    expect(map(new Anthropic.AuthenticationError(401, undefined, "x", new Headers()))).toMatchObject({ status: 502, extra: { code: "auth", retryable: false } });
    expect(map(new Anthropic.NotFoundError(404, undefined, "x", new Headers()))).toMatchObject({ status: 502, extra: { code: "model_not_found" } });
    expect(map(new Anthropic.RateLimitError(429, undefined, "x", new Headers()))).toMatchObject({ status: 429, extra: { retryable: true } });
    expect(map(new Anthropic.APIConnectionError({ message: "offline" }))).toMatchObject({ status: 503, extra: { retryable: true } });
    expect(map(new Anthropic.InternalServerError(500, undefined, "x", new Headers()))).toMatchObject({ status: 502, extra: { retryable: true } });
    expect(map(new AiResponseError("bad", ["issue"], "schema", 2))).toMatchObject({ status: 502, details: ["issue"], extra: { code: "schema", retryable: true, attempts: 2 } });
  });

  it("never leaks the raw SDK message to the client", () => {
    expect(map(new Anthropic.AuthenticationError(401, undefined, "sk-ant-secret-detail", new Headers())).message).not.toContain("sk-ant");
  });

  it("passes unknown errors through unchanged (they become a generic 500)", () => {
    const e = new Error("bug");
    expect(toHttpError(e)).toBe(e);
  });
});
