import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./client";

const respond = (status: number, body?: unknown) =>
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status })));

afterEach(() => vi.unstubAllGlobals());

describe("API client error handling", () => {
  it("returns parsed JSON on success", async () => {
    respond(200, [{ id: 1 }]);
    await expect(api.listCampaigns()).resolves.toEqual([{ id: 1 }]);
  });

  it("turns a 400 validation response into field errors the form can show", async () => {
    respond(400, { error: "Validation failed", details: [{ field: "budget", message: "Budget must be greater than 0" }] });
    const err = await api.listCampaigns().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.fieldErrors).toEqual([{ field: "budget", message: "Budget must be greater than 0" }]);
  });

  it("keeps the server's code, retryable flag and issue list for AI errors", async () => {
    respond(502, { error: "The AI draft included unverified information", details: ["States a payment amount"], code: "guardrail", retryable: true });
    const err: ApiError = await api.generateOutreach(1, 1).catch((e) => e);
    expect(err).toMatchObject({ status: 502, code: "guardrail", retryable: true, details: ["States a payment amount"] });
  });

  it("explains an unreachable API (empty 5xx from the dev proxy)", async () => {
    respond(502);
    const err: ApiError = await api.health().catch((e) => e);
    expect(err.message).toMatch(/Can't reach the API server/);
    expect(err.code).toBe("api_unreachable");
  });

  it("explains a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err: ApiError = await api.health().catch((e) => e);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/Can't reach the server/);
  });

  it("handles 204 No Content (delete)", async () => {
    respond(204);
    await expect(api.deleteDraft(1)).resolves.toBeUndefined();
  });

  it("sends JSON with the right method and path", async () => {
    respond(201, { id: 3 });
    await api.createDraft({ campaignId: 1, creatorId: 2, subject: "s", body: "b", personalizationNote: null, aiGenerated: true, aiModel: "m", reviewed: false });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/drafts");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({ campaignId: 1, creatorId: 2 });
  });
});
