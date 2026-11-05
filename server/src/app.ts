import cors from "cors";
import express from "express";
import { config } from "./config.js";
import type { DB } from "./db/database.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { createCampaignRepository } from "./repositories/campaignRepository.js";
import { createCreatorRepository } from "./repositories/creatorRepository.js";
import { createDraftRepository } from "./repositories/draftRepository.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { creatorRoutes } from "./routes/creators.js";
import { draftRoutes } from "./routes/drafts.js";
import { matchRoutes } from "./routes/matches.js";
import { outreachRoutes } from "./routes/outreach.js";
import { createDefaultMatchExplainer, type MatchExplainer } from "./services/matchExplainer.js";
import { createDefaultOutreachGenerator, type OutreachGenerator } from "./services/outreach.js";

export interface AppOptions {
  /** Inject a generator (tests use a fake). Defaults to Claude if an API key is set, otherwise null. */
  outreachGenerator?: OutreachGenerator | null;
  /** Inject a match explainer (tests use a fake). Defaults to Claude if an API key is set. */
  matchExplainer?: MatchExplainer | null;
  /** Max AI requests per client per minute (protects the paid API). Default 10. */
  aiRequestsPerMinute?: number;
}

/**
 * Builds the Express app. The database (and AI generator) are passed in
 * ("dependency injection") so tests can swap in an in-memory database and a
 * fake AI instead of the real ones.
 */
export function createApp(db: DB, options: AppOptions = {}) {
  const generator =
    options.outreachGenerator !== undefined
      ? options.outreachGenerator
      : createDefaultOutreachGenerator(config.anthropicApiKey, config.anthropicModel);
  const explainer =
    options.matchExplainer !== undefined
      ? options.matchExplainer
      : createDefaultMatchExplainer(config.anthropicApiKey, config.anthropicModel);

  const app = express();
  app.use(cors({ origin: [/^http:\/\/localhost:\d+$/] }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", aiConfigured: generator !== null });
  });

  const creators = createCreatorRepository(db);
  const campaigns = createCampaignRepository(db);
  const drafts = createDraftRepository(db);

  // Every endpoint that calls Claude shares one per-client limit.
  const aiLimit = rateLimit({ windowMs: 60_000, max: options.aiRequestsPerMinute ?? 10, name: "AI" });
  app.post("/api/outreach/generate", aiLimit);
  app.post("/api/campaigns/:campaignId/matches/:creatorId/explanation", aiLimit);

  app.use("/api/creators", creatorRoutes(creators));
  app.use("/api/campaigns/:campaignId/matches", matchRoutes(campaigns, creators, explainer));
  app.use("/api/campaigns", campaignRoutes(campaigns));
  app.use("/api/outreach", outreachRoutes(campaigns, creators, generator));
  app.use("/api/drafts", draftRoutes(drafts, campaigns, creators));

  app.use("/api", notFoundHandler);
  app.use(errorHandler);
  return app;
}
