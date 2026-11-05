import { z } from "zod";

const id = (label: string) => z.number({ error: `${label} is required` }).int().positive(`${label} must be a positive integer`);

/** POST /api/outreach/generate */
export const generateRequestSchema = z.object({
  campaignId: id("campaignId"),
  creatorId: id("creatorId"),
});

/**
 * The shape we REQUIRE Claude's answer to have — the single source of truth.
 * The same schema is (1) converted to JSON Schema and sent to the API as the
 * structured-output format, and (2) used to validate the reply in our code.
 * The .describe() texts tell the model what each field is for.
 */
export const aiOutreachSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(5, "Subject is too short")
    .max(150, "Subject is too long")
    .describe("Email subject line, under 100 characters, naming the brand"),
  body: z
    .string()
    .trim()
    .min(80, "Body is too short")
    .max(4000, "Body is too long")
    .describe("Plain-text email body (120–220 words) with line breaks, signed with [Your name] and [Your role]"),
  personalizationNote: z
    .string()
    .trim()
    .min(10, "Personalization note is too short")
    .max(800)
    .describe("1–3 sentences naming which verified creator facts were used to personalise the email"),
});
export type AiOutreach = z.infer<typeof aiOutreachSchema>;

/** POST /api/drafts */
export const draftInputSchema = z.object({
  campaignId: id("campaignId"),
  creatorId: id("creatorId"),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  body: z.string().trim().min(1, "Body is required").max(6000),
  personalizationNote: z.string().trim().max(1000).nullable().default(null),
  aiGenerated: z.boolean().default(true),
  /** Which model wrote the original draft (provenance); null for manual drafts */
  aiModel: z.string().trim().max(100).nullable().default(null),
  reviewed: z.boolean().default(false),
});
export type DraftInput = z.infer<typeof draftInputSchema>;

/** PUT /api/drafts/:id — any subset of the editable fields */
export const draftUpdateSchema = z
  .object({
    subject: z.string().trim().min(1, "Subject is required").max(200),
    body: z.string().trim().min(1, "Body is required").max(6000),
    reviewed: z.boolean(),
  })
  .partial()
  .refine((u) => Object.keys(u).length > 0, { message: "Nothing to update" });
export type DraftUpdate = z.infer<typeof draftUpdateSchema>;
