import { z } from "zod";
import { CURRENCIES, GOALS, INDUSTRIES, PLATFORMS } from "../types.js";

/** Trims whitespace, then enforces a length range with a friendly message. */
const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

/**
 * The single source of truth for what a valid campaign looks like.
 * Express routes run every incoming request body through this schema;
 * anything invalid is rejected with a 400 before it reaches the database.
 */
export const campaignInputSchema = z
  .object({
    brandName: text("Brand name", 2, 80),
    product: text("Product or service", 2, 120),
    industry: z.enum(INDUSTRIES, { error: "Choose a valid industry" }),
    description: text("Campaign description", 20, 1500),
    targetAudience: text("Target audience", 5, 300),
    ageMin: z.number({ error: "Minimum age must be a number" }).int().min(13, "Minimum age is 13").max(100),
    ageMax: z.number({ error: "Maximum age must be a number" }).int().min(13).max(100, "Maximum age is 100"),
    platforms: z
      .array(z.enum(PLATFORMS, { error: "Unknown platform" }), { error: "Select at least one platform" })
      .min(1, "Select at least one platform")
      .transform((list) => [...new Set(list)]),
    budget: z
      .number({ error: "Budget must be a number" })
      .positive("Budget must be greater than 0")
      .max(10_000_000, "Budget looks unrealistically large"),
    currency: z.enum(CURRENCIES).default("GBP"),
    goal: z.enum(GOALS, { error: "Choose a valid campaign goal" }),
  })
  .refine((c) => c.ageMin <= c.ageMax, {
    message: "Minimum age cannot be greater than maximum age",
    path: ["ageMax"],
  });

export type CampaignInput = z.infer<typeof campaignInputSchema>;
