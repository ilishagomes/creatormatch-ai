export const INDUSTRIES = ["skincare", "beauty", "fashion", "fitness", "technology", "food", "lifestyle"] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const PLATFORMS = ["instagram", "tiktok", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const GOALS = ["awareness", "engagement", "conversions", "product_launch", "content_creation"] as const;
export type CampaignGoal = (typeof GOALS)[number];

export const CURRENCIES = ["GBP", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface Campaign {
  id: number;
  brandName: string;
  product: string;
  industry: Industry;
  description: string;
  targetAudience: string;
  ageMin: number;
  ageMax: number;
  platforms: Platform[];
  budget: number;
  currency: Currency;
  goal: CampaignGoal;
  createdAt: string;
}

export const NICHES = INDUSTRIES;

/** A brand the creator owns or co-founded — used to detect competitor conflicts. */
export interface OwnedBrand {
  name: string;
  keywords: string[];
  sourceUrl: string;
}

/** A sourced, dated audience/performance figure, e.g. YouTube subscribers as of 2025-12. */
export interface AudienceMetric {
  label: string;
  value: number;
  /** YYYY, YYYY-MM or YYYY-MM-DD — as precise as the source allows */
  asOf: string;
  sourceUrl: string;
}

export interface VerifiedAudience {
  ageMin: number;
  ageMax: number;
  asOf: string;
  sourceUrl: string;
}

export interface Creator {
  id: number;
  name: string;
  handle: string;
  primaryPlatform: Platform;
  profileUrl: string;
  niche: Industry;
  tags: string[];
  /** null means "not verified" — the UI shows "Not available". */
  description: string | null;
  /** Only figures that have a public source AND a date. Usually empty. */
  audienceMetrics: AudienceMetric[];
  /** Verified core audience age range, ONLY from a published source. null = unknown (the usual case). */
  verifiedAudience: VerifiedAudience | null;
  sourceUrls: string[];
  dateVerified: string;
  /** "verified" = the profile URL/handle was confirmed by research; otherwise it needs a human check. */
  verificationStatus: "verified" | "needs_manual_verification";
  verificationNote: string | null;
  considerations: string | null;
  ownedBrands: OwnedBrand[];
}
