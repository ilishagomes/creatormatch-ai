import { Router } from "express";
import { z } from "zod";
import { HttpError, parseId } from "../middleware/errorHandler.js";
import type { CampaignRepository } from "../repositories/campaignRepository.js";
import type { CreatorRepository } from "../repositories/creatorRepository.js";
import type { DraftRepository } from "../repositories/draftRepository.js";
import { draftInputSchema, draftUpdateSchema } from "../validation/outreach.js";

const listQuery = z.object({ campaignId: z.coerce.number().int().positive().optional() });

export function draftRoutes(drafts: DraftRepository, campaigns: CampaignRepository, creators: CreatorRepository) {
  const router = Router();

  // GET /api/drafts?campaignId=1
  router.get("/", (req, res) => {
    res.json(drafts.findAll(listQuery.parse(req.query).campaignId));
  });

  // GET /api/drafts/:id
  router.get("/:id", (req, res) => {
    const draft = drafts.findById(parseId(req.params.id));
    if (!draft) throw new HttpError(404, "Draft not found");
    res.json(draft);
  });

  // POST /api/drafts — save a (possibly edited) email
  router.post("/", (req, res) => {
    const input = draftInputSchema.parse(req.body);
    if (!campaigns.findById(input.campaignId)) throw new HttpError(404, "Campaign not found");
    if (!creators.findById(input.creatorId)) throw new HttpError(404, "Creator not found");
    res.status(201).json(drafts.create(input));
  });

  // PUT /api/drafts/:id — edit subject/body or mark as human-reviewed
  router.put("/:id", (req, res) => {
    const id = parseId(req.params.id);
    const updated = drafts.update(id, draftUpdateSchema.parse(req.body));
    if (!updated) throw new HttpError(404, "Draft not found");
    res.json(updated);
  });

  // DELETE /api/drafts/:id
  router.delete("/:id", (req, res) => {
    if (!drafts.delete(parseId(req.params.id))) throw new HttpError(404, "Draft not found");
    res.status(204).end();
  });

  return router;
}
