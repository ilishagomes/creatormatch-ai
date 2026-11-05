// Mirrors the server's types (server/src/types.ts). Kept separate so the
// frontend has no build-time dependency on server code.

export const INDUSTRIES = ["skincare", "beauty", "fashion", "fitness", "technology", "food", "lifestyle"] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const PLATFORMS = ["instagram", "tiktok", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const GOALS = ["awareness", "engagement", "conversions", "product_launch", "content_creation"] as const;
export type CampaignGoal = (typeof GOALS)[number];

export const CURRENCIES = ["GBP", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface CampaignInput {
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
}

export interface Campaign extends CampaignInput {
  id: number;
  createdAt: string;
}

export interface OwnedBrand {
  name: string;
  keywords: string[];
  sourceUrl: string;
}

export interface AudienceMetric {
  label: string;
  value: number;
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
  description: string | null;
  audienceMetrics: AudienceMetric[];
  verifiedAudience: { ageMin: number; ageMax: number; asOf: string; sourceUrl: string } | null;
  sourceUrls: string[];
  dateVerified: string;
  verificationStatus: "verified" | "needs_manual_verification";
  verificationNote: string | null;
  considerations: string | null;
  ownedBrands: OwnedBrand[];
}

export type ComponentKey = "niche" | "keywords" | "platform" | "audience";

export interface ScoreComponent {
  key: ComponentKey;
  label: string;
  weight: number;
  status: "scored" | "unknown" | "not_applicable";
  value: number | null;
  points: number | null;
  explanation: string;
}

export interface KeywordMatch {
  topic: string;
  campaignTerms: string[];
  creatorTerm: string;
  relation: "exact" | "related";
  importance: number;
}

export interface ConflictFlag {
  type: "owned_brand";
  brand: string;
  matchedKeywords: string[];
  sourceUrl: string;
  message: string;
}

export interface MatchResult {
  creatorId: number;
  score: number;
  tier: "Strong" | "Good" | "Moderate" | "Low";
  coverage: {
    percent: number;
    earnedPoints: number;
    availablePoints: number;
    excluded: { key: ComponentKey; label: string; reason: string }[];
  };
  components: ScoreComponent[];
  matchedKeywords: KeywordMatch[];
  warnings: string[];
  conflicts: ConflictFlag[];
  explanation: string;
}

export interface BriefTopic {
  topic: string;
  terms: string[];
  importance: number;
}

export interface RankedCreator {
  creator: Creator;
  match: MatchResult;
}

export interface GeneratedOutreach {
  subject: string;
  body: string;
  personalizationNote: string;
  model: string;
  generatedAt: string;
  attempts: number;
  requiresHumanReview: true;
}

export interface Draft {
  id: number;
  campaignId: number;
  creatorId: number;
  creatorName: string;
  brandName: string;
  subject: string;
  body: string;
  personalizationNote: string | null;
  aiGenerated: boolean;
  aiModel: string | null;
  reviewed: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Human-friendly labels for enum values */
export const LABELS: Record<string, string> = {
  skincare: "Skincare",
  beauty: "Beauty & makeup",
  lifestyle: "Lifestyle",
  fashion: "Fashion",
  fitness: "Fitness & wellness",
  technology: "Technology",
  food: "Food & lifestyle",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  awareness: "Brand awareness",
  engagement: "Engagement",
  conversions: "Sales & conversions",
  product_launch: "Product launch",
  content_creation: "Content creation",
};
export const label = (value: string) => LABELS[value] ?? value;
