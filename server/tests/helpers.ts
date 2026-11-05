import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db/database.js";
import { seedCreators } from "../src/db/seed.js";
import type { MatchExplainer } from "../src/services/matchExplainer.js";
import type { OutreachGenerator } from "../src/services/outreach.js";

/** A fresh app + in-memory database for each test — no shared state. */
/**
 * Tests NEVER call the real Claude API: the generator defaults to null
 * ("not configured") unless a test passes in a fake one.
 */
export function makeTestApp({
  seed = false,
  outreachGenerator = null,
  matchExplainer = null,
  aiRequestsPerMinute = 1000,
}: { seed?: boolean; outreachGenerator?: OutreachGenerator | null; matchExplainer?: MatchExplainer | null; aiRequestsPerMinute?: number } = {}) {
  const db = openDatabase(":memory:");
  if (seed) seedCreators(db);
  return { db, app: createApp(db, { outreachGenerator, matchExplainer, aiRequestsPerMinute }) };
}

/** A minimal valid creator for tests — fictional on purpose, never seeded into the real DB. */
export const testCreator = {
  name: "Test Creator",
  handle: "test_creator",
  primaryPlatform: "youtube",
  profileUrl: "https://www.youtube.com/@test_creator",
  niche: "technology",
  tags: ["tech reviews"],
  description: null,
  audienceMetrics: [],
  verifiedAudience: null,
  sourceUrls: ["https://example.com/source"],
  dateVerified: "2026-11-05",
  verificationStatus: "needs_manual_verification",
  verificationNote: null,
  considerations: null,
  ownedBrands: [],
};

export const validCampaign = {
  brandName: "Glow Lab",
  product: "Vitamin C brightening serum",
  industry: "skincare",
  description: "Launching a fragrance-free vitamin C serum for sensitive skin, focused on honest routines.",
  targetAudience: "Skincare enthusiasts with sensitive skin",
  ageMin: 18,
  ageMax: 34,
  platforms: ["instagram", "tiktok"],
  budget: 5000,
  currency: "GBP",
  goal: "product_launch",
};
