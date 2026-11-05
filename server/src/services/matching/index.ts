import type { Campaign, Creator, Industry } from "../../types.js";
import { TOPIC_BY_ID, type Topic } from "./taxonomy.js";
import { containsPhrase, findTerms } from "./text.js";

/**
 * CREATORMATCH COMPATIBILITY SCORE
 *
 * A deterministic, rule-based score. No AI, no randomness: the same campaign
 * and creator always give exactly the same result, and every point can be
 * traced to a rule below. It is a COMPATIBILITY score — not a prediction of
 * campaign performance or of whether a partnership will happen.
 *
 *   component                 weight   value (0–1)
 *   content niche relevance     40     same category 1 · related 0.4 · else 0
 *   campaign keyword relevance  25     weighted share of the brief's topics the creator covers
 *   platform compatibility      20     primary platform selected 1 · else 0
 *   verified audience relevance 15     overlap of age ranges — ONLY if verified data exists
 *
 * A component with no data is "unknown" and is left out instead of guessed.
 * The score is then rescaled over the components we could measure:
 *
 *   score = 100 × (Σ weight × value of known components) ÷ (Σ weight of known components)
 *   coverage = Σ weight of known components  (e.g. 85% when audience is unknown)
 *
 * Brand conflicts are reported as flags and NEVER change the number.
 */

export const WEIGHTS = { niche: 40, keywords: 25, platform: 20, audience: 15 } as const;
export type ComponentKey = keyof typeof WEIGHTS;

export const RELATED_CATEGORY_VALUE = 0.4;
export const RELATED_TOPIC_STRENGTH = 0.5;
/** Where a word appears in the brief changes how much it matters. */
export const FIELD_WEIGHTS = { product: 1.5, description: 1, targetAudience: 0.5 } as const;
export const SPECIFICITY_WEIGHTS = { specific: 1, broad: 0.5 } as const;

/** Categories whose audiences overlap. Symmetric (checked by a test). */
export const RELATED_NICHES: Record<Industry, Industry[]> = {
  skincare: ["beauty"],
  beauty: ["skincare", "fashion"],
  fashion: ["beauty", "lifestyle"],
  fitness: ["food", "lifestyle"],
  food: ["fitness", "lifestyle"],
  technology: ["lifestyle"],
  lifestyle: ["fashion", "fitness", "food", "technology"],
};

const PLATFORM_NAMES = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" } as const;

// ------------------------------------------------------------------ types ---

export interface ScoreComponent {
  key: ComponentKey;
  label: string;
  weight: number;
  /** "scored" = measured; "unknown" = no verified data; "not_applicable" = nothing to compare */
  status: "scored" | "unknown" | "not_applicable";
  /** 0–1 when scored, null otherwise — never a made-up number */
  value: number | null;
  /** weight × value, rounded to 1 decimal; null when not scored */
  points: number | null;
  explanation: string;
}

export interface KeywordMatch {
  /** Topic from the campaign brief */
  topic: string;
  /** The word(s) we found in the brief for this topic */
  campaignTerms: string[];
  /** The creator term that matched it */
  creatorTerm: string;
  relation: "exact" | "related";
  /** How much this topic matters in the brief (field weight × specificity) */
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
  /** 0–100, rescaled over the measured components */
  score: number;
  tier: "Strong" | "Good" | "Moderate" | "Low";
  coverage: {
    /** Percent of the scoring model that could be measured (0–100) */
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

// ------------------------------------------------------- campaign analysis ---

export interface CampaignTopic {
  topic: Topic;
  /** Every word in the brief that pointed at this topic */
  terms: string[];
  importance: number;
}

/**
 * Finds the topics in a campaign brief and how important each one is.
 * importance = (weight of the field it appeared in) × (specificity of the topic)
 * If a topic appears in several fields, its most important appearance counts.
 */
export function analyzeCampaign(campaign: Campaign): CampaignTopic[] {
  const best = new Map<string, CampaignTopic>();
  for (const field of Object.keys(FIELD_WEIGHTS) as (keyof typeof FIELD_WEIGHTS)[]) {
    for (const hit of findTerms(campaign[field])) {
      const importance = FIELD_WEIGHTS[field] * SPECIFICITY_WEIGHTS[hit.topic.specificity];
      const current = best.get(hit.topic.id);
      if (!current) {
        best.set(hit.topic.id, { topic: hit.topic, terms: [hit.term], importance });
      } else {
        if (!current.terms.includes(hit.term)) current.terms.push(hit.term);
        current.importance = Math.max(current.importance, importance);
      }
    }
  }
  // Sorted most important first, then by id, so output order is stable.
  return [...best.values()].sort((a, b) => b.importance - a.importance || a.topic.id.localeCompare(b.topic.id));
}

/** Topics a creator covers, from their curated tags and sourced description. */
export function creatorTopics(creator: Creator): Map<string, string> {
  const topics = new Map<string, string>(); // topic id → the creator's term
  for (const text of [...creator.tags, creator.description ?? ""]) {
    for (const hit of findTerms(text)) if (!topics.has(hit.topic.id)) topics.set(hit.topic.id, hit.term);
  }
  return topics;
}

// -------------------------------------------------------------- components ---

const round1 = (n: number) => Math.round(n * 10) / 10;

function component(key: ComponentKey, label: string, value: number | null, status: ScoreComponent["status"], explanation: string): ScoreComponent {
  return { key, label, weight: WEIGHTS[key], status, value, points: value === null ? null : round1(WEIGHTS[key] * value), explanation };
}

function scoreNiche(campaign: Campaign, creator: Creator): ScoreComponent {
  if (creator.niche === campaign.industry) {
    return component("niche", "Content niche relevance", 1, "scored", `Main content category is ${creator.niche}, the same as your campaign.`);
  }
  if (RELATED_NICHES[campaign.industry].includes(creator.niche)) {
    return component("niche", "Content niche relevance", RELATED_CATEGORY_VALUE, "scored",
      `Main content category is ${creator.niche}, which is related to ${campaign.industry} (partial credit).`);
  }
  return component("niche", "Content niche relevance", 0, "scored", `Main content category is ${creator.niche}, which is unrelated to ${campaign.industry}.`);
}

function scoreKeywords(brief: CampaignTopic[], creator: Creator): { component: ScoreComponent; matches: KeywordMatch[] } {
  if (brief.length === 0) {
    return {
      matches: [],
      component: component("keywords", "Campaign keyword relevance", null, "not_applicable",
        "Your brief didn't mention any topics we recognise, so keyword relevance couldn't be measured."),
    };
  }
  const covered = creatorTopics(creator);
  const coveredFamilies = new Map<string, string>();
  for (const [id, term] of covered) {
    const fam = TOPIC_BY_ID.get(id)!.family;
    if (!coveredFamilies.has(fam)) coveredFamilies.set(fam, term);
  }

  let total = 0;
  let earned = 0;
  const matches: KeywordMatch[] = [];
  for (const { topic, terms, importance } of brief) {
    total += importance;
    const exact = covered.get(topic.id);
    const related = coveredFamilies.get(topic.family);
    if (exact) {
      earned += importance;
      matches.push({ topic: topic.label, campaignTerms: terms, creatorTerm: exact, relation: "exact", importance });
    } else if (related) {
      earned += importance * RELATED_TOPIC_STRENGTH;
      matches.push({ topic: topic.label, campaignTerms: terms, creatorTerm: related, relation: "related", importance });
    }
  }
  const value = earned / total;
  const exactCount = matches.filter((m) => m.relation === "exact").length;
  const relatedCount = matches.length - exactCount;
  const explanation = matches.length
    ? `Covers ${matches.length} of the ${brief.length} topics in your brief (${exactCount} directly, ${relatedCount} through related topics), weighted by how central each topic is.`
    : `None of the ${brief.length} topics in your brief appear in this creator's content.`;
  return { matches, component: component("keywords", "Campaign keyword relevance", value, "scored", explanation) };
}

function scorePlatform(campaign: Campaign, creator: Creator): ScoreComponent {
  const name = PLATFORM_NAMES[creator.primaryPlatform];
  return campaign.platforms.includes(creator.primaryPlatform)
    ? component("platform", "Platform compatibility", 1, "scored", `Primary platform (${name}) is one of your selected platforms.`)
    : component("platform", "Platform compatibility", 0, "scored",
        `Primary platform (${name}) is not one of your selected platforms (${campaign.platforms.map((p) => PLATFORM_NAMES[p]).join(", ")}).`);
}

/**
 * Audience relevance is ONLY scored from verified, sourced demographic data.
 * Without it the component is "unknown" (value null) — never 0, never a guess.
 */
function scoreAudience(campaign: Campaign, creator: Creator): ScoreComponent {
  const a = creator.verifiedAudience;
  if (!a) {
    return component("audience", "Verified audience relevance", null, "unknown",
      "Unknown — no verified audience demographics are available for this creator, so this was left out of the score rather than guessed.");
  }
  const overlap = Math.max(0, Math.min(campaign.ageMax, a.ageMax) - Math.max(campaign.ageMin, a.ageMin) + 1);
  const value = overlap / (campaign.ageMax - campaign.ageMin + 1);
  return component("audience", "Verified audience relevance", value, "scored",
    `Verified core audience is aged ${a.ageMin}–${a.ageMax} (as of ${a.asOf}); ${Math.round(value * 100)}% of your ${campaign.ageMin}–${campaign.ageMax} target range overlaps.`);
}

// ------------------------------------------------------- conflicts & notes ---

/**
 * A conflict is flagged when the brief's product or description mentions a
 * category sold by a brand the creator owns (from sourced data). Flags are
 * shown next to the score — they do not change it.
 */
function findConflicts(campaign: Campaign, creator: Creator): ConflictFlag[] {
  const text = `${campaign.product} ${campaign.description}`;
  return creator.ownedBrands.flatMap((brand) => {
    const matched = brand.keywords.filter((k) => containsPhrase(text, k));
    return matched.length
      ? [{ type: "owned_brand" as const, brand: brand.name, matchedKeywords: matched, sourceUrl: brand.sourceUrl,
           message: `Owns ${brand.name}, which sells ${matched.join(", ")} — this may compete with your product.` }]
      : [];
  });
}

function missingDataWarnings(creator: Creator, components: ScoreComponent[], brief: CampaignTopic[]): string[] {
  const w: string[] = [];
  if (!creator.verifiedAudience) w.push("No verified audience demographics — audience relevance is unknown and excluded from the score.");
  if (brief.length === 0) w.push("Your brief contains no recognised topics — keyword relevance couldn't be measured.");
  else if (brief.length < 3) w.push(`Your brief only mentions ${brief.length} recognised topic${brief.length === 1 ? "" : "s"}, so keyword relevance rests on little evidence.`);
  if (!creator.description) w.push("No verified profile description is available.");
  if (creator.audienceMetrics.length === 0) w.push("No dated audience-size figures are available (size is not used in scoring).");
  if (creator.verificationStatus === "needs_manual_verification") w.push("This creator's profile still needs manual verification.");
  return w;
}

// ------------------------------------------------------------ explanation ---

function tierFor(score: number): MatchResult["tier"] {
  if (score >= 75) return "Strong";
  if (score >= 55) return "Good";
  if (score >= 35) return "Moderate";
  return "Low";
}

/** A short, template-based explanation built only from the computed results. */
function explain(r: Omit<MatchResult, "explanation">, creator: Creator, campaign: Campaign): string {
  const parts: string[] = [`${r.tier} fit: ${r.score}/100, based on ${r.coverage.percent}% of the scoring model.`];
  const niche = r.components.find((c) => c.key === "niche")!;
  parts.push(
    niche.value === 1 ? `Creates ${creator.niche} content, matching your campaign.`
      : niche.value ? `Creates ${creator.niche} content, which is related to ${campaign.industry}.`
      : `Creates ${creator.niche} content, outside your ${campaign.industry} campaign.`,
  );
  const exact = r.matchedKeywords.filter((m) => m.relation === "exact").map((m) => m.topic.toLowerCase());
  if (exact.length) parts.push(`Directly covers ${exact.slice(0, 3).join(", ")}${exact.length > 3 ? " and more" : ""}.`);
  else if (r.matchedKeywords.length) parts.push("Covers related topics but none of your brief's exact topics.");
  else parts.push("Doesn't cover the topics in your brief.");
  const platform = r.components.find((c) => c.key === "platform")!;
  parts.push(platform.value ? `Posts mainly on ${PLATFORM_NAMES[creator.primaryPlatform]}, which you selected.` : `Posts mainly on ${PLATFORM_NAMES[creator.primaryPlatform]}, which you didn't select.`);
  if (r.coverage.excluded.some((e) => e.key === "audience")) parts.push("Audience fit is unknown.");
  if (r.conflicts.length) parts.push(`Potential conflict: owns ${r.conflicts.map((c) => c.brand).join(", ")}.`);
  return parts.join(" ");
}

// ------------------------------------------------------------------- main ---

export function scoreCreator(campaign: Campaign, creator: Creator, brief: CampaignTopic[] = analyzeCampaign(campaign)): MatchResult {
  const { component: keywords, matches } = scoreKeywords(brief, creator);
  const components = [scoreNiche(campaign, creator), keywords, scorePlatform(campaign, creator), scoreAudience(campaign, creator)];

  const scored = components.filter((c) => c.status === "scored");
  const availablePoints = scored.reduce((sum, c) => sum + c.weight, 0);
  const earnedRaw = scored.reduce((sum, c) => sum + c.weight * (c.value as number), 0);
  const score = availablePoints === 0 ? 0 : Math.round((100 * earnedRaw) / availablePoints);

  const partial: Omit<MatchResult, "explanation"> = {
    creatorId: creator.id,
    score,
    tier: tierFor(score),
    coverage: {
      percent: availablePoints, // weights sum to 100, so available points = percent
      earnedPoints: round1(earnedRaw),
      availablePoints,
      excluded: components
        .filter((c) => c.status !== "scored")
        .map((c) => ({ key: c.key, label: c.label, reason: c.status === "unknown" ? "No verified data" : "Nothing to compare" })),
    },
    components,
    matchedKeywords: matches,
    warnings: missingDataWarnings(creator, components, brief),
    conflicts: findConflicts(campaign, creator),
  };
  return { ...partial, explanation: explain(partial, creator, campaign) };
}

/** Scores every creator and sorts best-first. Ties break by name, so order is stable. */
export function rankCreators(campaign: Campaign, creators: Creator[]) {
  const brief = analyzeCampaign(campaign); // analyse the brief once, reuse for every creator
  return creators
    .map((creator) => ({ creator, match: scoreCreator(campaign, creator, brief) }))
    .sort((a, b) => b.match.score - a.match.score || a.creator.name.localeCompare(b.creator.name));
}
