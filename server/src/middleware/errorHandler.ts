import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

/** An error we throw on purpose, with an HTTP status and a safe message. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
    /** Extra machine-readable fields for the client, e.g. { code, retryable } */
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Parses a numeric :id route parameter, or throws a 400. */
export function parseId(raw: string | undefined, label = "id"): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `Invalid ${label}`);
  return id;
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "Route not found"));
};

/**
 * Every error in the app ends up here, so the API always answers with the
 * same JSON shape: { error: string, details?: [...] }.
 * Unknown errors are logged but never leaked to the client.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}), ...(err.extra ?? {}) });
    return;
  }
  // Errors from express.json(): malformed JSON, body too large, bad encoding.
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body is not valid JSON" });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large" });
    return;
  }
  if (typeof err?.status === "number" && err.status >= 400 && err.status < 500 && err.expose) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
};
