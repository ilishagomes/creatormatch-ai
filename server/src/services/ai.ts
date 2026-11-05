import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { HttpError } from "../middleware/errorHandler.js";

/** The single SDK method we use — typed this way so tests can supply a fake. */
export type MessagesClient = Pick<Anthropic["beta"]["messages"], "create">;

/**
 * Creates the SDK client, or null when no API key is configured. The key is
 * read from the server's environment only — it is never sent to the browser.
 * maxRetries: the SDK automatically retries network errors, 429s and 5xx once.
 */
export function createMessagesClient(apiKey: string | null): MessagesClient | null {
  if (!apiKey) return null;
  return new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 }).beta.messages;
}

/** Joins the text blocks of a response (skipping thinking and other block types). */
export function extractText(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export type AiErrorCode = "invalid_json" | "schema" | "guardrail" | "refusal" | "truncated";

/** Claude answered, but the answer is unusable. `code` says why; `retryable` whether trying again may help. */
export class AiResponseError extends Error {
  constructor(
    message: string,
    public issues: string[] = [],
    public code: AiErrorCode = "schema",
    public attempts = 1,
  ) {
    super(message);
  }
  get retryable() {
    return this.code !== "refusal";
  }
}

/**
 * Converts SDK and validation errors into safe HTTP errors for the browser,
 * from most specific to least specific. Raw SDK messages are never forwarded.
 */
export function toHttpError(err: unknown): unknown {
  if (err instanceof AiResponseError) {
    return new HttpError(502, err.message, err.issues.length ? err.issues : undefined, { code: err.code, retryable: err.retryable, attempts: err.attempts });
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new HttpError(502, "The AI service rejected the API key. Check ANTHROPIC_API_KEY in your .env file.", undefined, { code: "auth", retryable: false });
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new HttpError(502, `The AI model "${config.anthropicModel}" was not found. Check ANTHROPIC_MODEL in your .env file.`, undefined, { code: "model_not_found", retryable: false });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new HttpError(429, "The AI service is rate limiting requests. Wait a moment and try again.", undefined, { code: "rate_limited", retryable: true });
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new HttpError(503, "Could not reach the AI service. Check your internet connection and try again.", undefined, { code: "connection", retryable: true });
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new HttpError(502, "The AI service rejected the request. Check that ANTHROPIC_MODEL names a current Claude model.", undefined, { code: "bad_request", retryable: false });
  }
  if (err instanceof Anthropic.APIError) {
    return new HttpError(502, `The AI service returned an error (${err.status ?? "unknown"}). Please try again.`, undefined, { code: "api_error", retryable: true });
  }
  return err;
}
