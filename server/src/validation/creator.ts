import { z } from "zod";
import { INDUSTRIES, PLATFORMS } from "../types.js";

const PLATFORM_DOMAINS: Record<(typeof PLATFORMS)[number], string> = {
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/@",
  youtube: "https://www.youtube.com/",
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
/** Sources are often only precise to the month or year, so allow YYYY, YYYY-MM or YYYY-MM-DD. */
const partialDate = z.string().regex(/^\d{4}(-\d{2}){0,2}$/, "Use YYYY, YYYY-MM or YYYY-MM-DD");

/**
 * Validates every creator in creators.json BEFORE it is written to the
 * database. This is our guard against fabricated or incomplete data:
 * every creator needs sources and a verification date, and any audience
 * figure must carry both the date it was observed and where it came from.
 */
export const creatorSeedSchema = z
  .object({
    name: z.string().min(2),
    handle: z.string().min(1).regex(/^[A-Za-z0-9._]+$/, "Handle must not include @ or spaces"),
    primaryPlatform: z.enum(PLATFORMS),
    profileUrl: z.url(),
    niche: z.enum(INDUSTRIES),
    tags: z.array(z.string().min(1)).min(1),
    description: z.string().min(10).nullable(),
    audienceMetrics: z.array(
      z.object({
        label: z.string().min(3),
        value: z.number().int().positive(),
        asOf: partialDate,
        sourceUrl: z.url({ error: "Every audience figure needs a source URL" }),
      }),
    ),
    // Optional verified audience age range. It must cite a source and a date;
    // without one the field stays null and audience relevance is "unknown".
    verifiedAudience: z
      .object({
        ageMin: z.number().int().min(13).max(100),
        ageMax: z.number().int().min(13).max(100),
        asOf: partialDate,
        sourceUrl: z.url({ error: "Verified audience data needs a source URL" }),
      })
      .refine((a) => a.ageMin <= a.ageMax, { message: "ageMin must be ≤ ageMax" })
      .nullable()
      .default(null),
    sourceUrls: z.array(z.url()).min(1, "Every creator needs at least one source"),
    dateVerified: isoDate,
    verificationStatus: z.enum(["verified", "needs_manual_verification"]),
    verificationNote: z.string().nullable(),
    considerations: z.string().nullable(),
    ownedBrands: z.array(
      z.object({ name: z.string().min(1), keywords: z.array(z.string().min(1)).min(1), sourceUrl: z.url() }),
    ),
  })
  .strict() // unknown fields (e.g. "sponsorshipRate") are rejected, so nothing unvetted sneaks in
  .refine((c) => c.profileUrl.startsWith(PLATFORM_DOMAINS[c.primaryPlatform]), {
    message: "Profile URL does not match the primary platform",
    path: ["profileUrl"],
  });

export type CreatorSeed = z.infer<typeof creatorSeedSchema>;
