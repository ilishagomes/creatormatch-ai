import { Router } from "express";
import { HttpError, parseId } from "../middleware/errorHandler.js";
import type { CampaignRepository } from "../repositories/campaignRepository.js";
import { campaignInputSchema } from "../validation/campaign.js";

export function campaignRoutes(campaigns: CampaignRepository) {
  const router = Router();

  // GET /api/campaigns — list all saved campaigns (newest first)
  router.get("/", (_req, res) => {
    res.json(campaigns.findAll());
  });

  // GET /api/campaigns/:id — one campaign
  router.get("/:id", (req, res) => {
    const campaign = campaigns.findById(parseId(req.params.id));
    if (!campaign) throw new HttpError(404, "Campaign not found");
    res.json(campaign);
  });

  // POST /api/campaigns — validate, then save
  router.post("/", (req, res) => {
    const input = campaignInputSchema.parse(req.body); // throws ZodError → 400
    res.status(201).json(campaigns.create(input));
  });

  return router;
}
