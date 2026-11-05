import { Router } from "express";
import { HttpError, parseId } from "../middleware/errorHandler.js";
import type { CampaignRepository } from "../repositories/campaignRepository.js";
import type { CreatorRepository } from "../repositories/creatorRepository.js";
import { toHttpError } from "../services/ai.js";
import type { MatchExplainer } from "../services/matchExplainer.js";
import { analyzeCampaign, rankCreators, scoreCreator, WEIGHTS } from "../services/matching/index.js";

/** Mounted under /api/campaigns/:campaignId/matches */
export function matchRoutes(campaigns: CampaignRepository, creators: CreatorRepository, explainer: MatchExplainer | null) {
  const router = Router({ mergeParams: true });

  function loadCampaign(raw: string | undefined) {
    const campaign = campaigns.findById(parseId(raw, "campaign id"));
    if (!campaign) throw new HttpError(404, "Campaign not found");
    return campaign;
  }
  function loadCreator(raw: string | undefined) {
    const creator = creators.findById(parseId(raw, "creator id"));
    if (!creator) throw new HttpError(404, "Creator not found");
    return creator;
  }

  // GET /api/campaigns/:campaignId/matches — every creator, ranked
  router.get("/", (req, res) => {
    const campaign = loadCampaign((req.params as Record<string, string>).campaignId);
    const briefTopics = analyzeCampaign(campaign).map((t) => ({ topic: t.topic.label, terms: t.terms, importance: t.importance }));
    res.json({ campaign, weights: WEIGHTS, briefTopics, results: rankCreators(campaign, creators.findAll()) });
  });

  // GET /api/campaigns/:campaignId/matches/:creatorId — one creator's breakdown
  router.get("/:creatorId", (req, res) => {
    const campaign = loadCampaign((req.params as Record<string, string>).campaignId);
    const creator = loadCreator(req.params.creatorId);
    res.json({ campaign, creator, weights: WEIGHTS, match: scoreCreator(campaign, creator) });
  });

  // POST /api/campaigns/:campaignId/matches/:creatorId/explanation
  // Claude rewrites the already-calculated result in plain English.
  router.post("/:creatorId/explanation", async (req, res) => {
    const campaign = loadCampaign((req.params as Record<string, string>).campaignId);
    const creator = loadCreator(req.params.creatorId);
    if (!explainer) {
      throw new HttpError(503, "AI explanations are not configured. Add ANTHROPIC_API_KEY to your .env file and restart the server.");
    }
    try {
      res.json(await explainer.explain({ campaign, creator, match: scoreCreator(campaign, creator) }));
    } catch (err) {
      throw toHttpError(err);
    }
  });

  return router;
}
