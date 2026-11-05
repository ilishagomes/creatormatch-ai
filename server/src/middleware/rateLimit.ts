import type { RequestHandler } from "express";
import { HttpError } from "./errorHandler.js";

/**
 * A small in-memory rate limiter: at most `max` requests per `windowMs` per
 * client IP. It protects the paid Claude API from runaway clicking or loops.
 * (In-memory is fine for a single-server app; a multi-server deployment
 * would need a shared store such as Redis.)
 */
export function rateLimit({ windowMs, max, name }: { windowMs: number; max: number; name: string }): RequestHandler {
  const hits = new Map<string, number[]>();
  return (req, res, next) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return next(new HttpError(429, `Too many ${name} requests. Please wait ${retryAfter}s and try again.`, undefined, { code: "local_rate_limit", retryable: true }));
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
