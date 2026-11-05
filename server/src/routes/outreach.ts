import { Router } from "express";
import { HttpError } from "../middleware/errorHandler.js";
import type { CampaignRepository } from "../repositories/campaignRepository.js";
import type { CreatorRepository } from "../repositories/creatorRepository.js";
import { scoreCreator } from "../services/matching/index.js";
import { toHttpError, type OutreachGenerator } from "../services/outreach.js";
import { generateRequestSchema } from "../validation/outreach.js";

export function outreachRoutes(
  campaigns: CampaignRepository,
  creators: CreatorRepository,
  generator: OutreachGenerator | null,
) {
  const router = Router();

  // POST /api/outreach/generate { campaignId, creatorId }
  // Returns an AI draft. It is NOT saved automatically — the user reviews it first.
  router.post("/generate", async (req, res) => {
    const { campaignId, creatorId } = generateRequestSchema.parse(req.body);
    const campaign = campaigns.findById(campaignId);
    if (!campaign) throw new HttpError(404, "Campaign not found");
    const creator = creators.findById(creatorId);
    if (!creator) throw new HttpError(404, "Creator not found");

    if (!generator) {
      throw new HttpError(503, "AI outreach is not configured. Add ANTHROPIC_API_KEY to your .env file and restart the server.");
    }

    try {
      const email = await generator.generate({ campaign, creator, match: scoreCreator(campaign, creator) });
      res.json(email);
    } catch (err) {
      throw toHttpError(err);
    }
  });

  return router;
}
