import { Router } from "express";
import { z } from "zod";
import { HttpError, parseId } from "../middleware/errorHandler.js";
import type { CreatorRepository } from "../repositories/creatorRepository.js";
import { INDUSTRIES, PLATFORMS } from "../types.js";

const filtersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  niche: z.enum(INDUSTRIES).optional(),
  platform: z.enum(PLATFORMS).optional(),
});

export function creatorRoutes(creators: CreatorRepository) {
  const router = Router();

  // GET /api/creators?search=&niche=&platform=
  router.get("/", (req, res) => {
    const filters = filtersSchema.parse(req.query);
    res.json(creators.findAll(filters));
  });

  // GET /api/creators/:id
  router.get("/:id", (req, res) => {
    const creator = creators.findById(parseId(req.params.id));
    if (!creator) throw new HttpError(404, "Creator not found");
    res.json(creator);
  });

  return router;
}
