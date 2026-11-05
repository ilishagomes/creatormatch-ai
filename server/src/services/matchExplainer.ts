import { z } from "zod";
import type { Campaign, Creator } from "../types.js";
import { AiResponseError, createMessagesClient, extractText, type MessagesClient } from "./ai.js";
import type { MatchResult } from "./matching/index.js";

/**
 * CLAUDE AS A WRITER, NOT A JUDGE
 *
 * The score is calculated by our deterministic algorithm. Claude only turns
 * the already-calculated breakdown into friendlier sentences. Two code-level
 * rules enforce that it can't invent metrics:
 *   1. Every number in Claude's text must already exist in the facts we sent.
 *   2. No follower/subscriber/engagement statistics and no links are allowed.
 * If either rule is broken, the explanation is discarded and an error shown.
 */

export interface MatchExplainer {
  explain(input: { campaign: Campaign; creator: Creator; match: MatchResult }): Promise<{ explanation: string; model: string }>;
}

export const EXPLAINER_SYSTEM_PROMPT = `You explain creator–campaign compatibility results to a brand manager.

You will receive the RESULT of a deterministic scoring algorithm as JSON. Rewrite it as a clear, friendly explanation of 2–4 sentences.

Rules:
- Use only the facts in the JSON. Do not add new facts about the creator.
- Do not introduce any number that is not in the JSON (no follower counts, percentages, prices or rankings).
- If a component is unknown, say it was not measured — never guess it.
- Mention any conflict flags as something to check, separately from the score.
- Plain text, no lists, no markdown, no links.`;

const responseSchema = z.object({ explanation: z.string().trim().min(40, "Explanation is too short").max(900, "Explanation is too long") });

const JSON_SCHEMA = {
  type: "object",
  properties: { explanation: { type: "string", description: "2–4 sentence plain-text explanation" } },
  required: ["explanation"],
  additionalProperties: false,
} as const;

/** The exact facts Claude may use. Nothing else about the creator is sent. */
export function buildFacts({ campaign, creator, match }: { campaign: Campaign; creator: Creator; match: MatchResult }) {
  return {
    campaign: { brand: campaign.brandName, product: campaign.product, category: campaign.industry, platforms: campaign.platforms },
    creator: { name: creator.name, mainCategory: creator.niche, primaryPlatform: creator.primaryPlatform },
    result: {
      score: match.score,
      tier: match.tier,
      scoringCoveragePercent: match.coverage.percent,
      components: match.components.map((c) => ({
        name: c.label, weight: c.weight, status: c.status, points: c.points, explanation: c.explanation,
      })),
      matchedTopics: match.matchedKeywords.map((m) => ({ topic: m.topic, relation: m.relation })),
      missingData: match.warnings,
      conflictFlags: match.conflicts.map((c) => c.message),
    },
  };
}

const NUMBER_RE = /\d+(?:[.,]\d+)?/g;
const STAT_RE = /\b(followers?|subscribers?|views?|engagement|impressions?|reach)\b/i;
const URL_RE = /https?:\/\/|www\./i;

/** Returns a list of problems; empty means the explanation is safe to show. */
export function checkExplanation(text: string, facts: unknown): string[] {
  const allowed = new Set((JSON.stringify(facts).match(NUMBER_RE) ?? []).map((n) => n.replace(",", ".")));
  const invented = [...new Set((text.match(NUMBER_RE) ?? []).map((n) => n.replace(",", ".")))].filter((n) => !allowed.has(n));
  const issues: string[] = [];
  if (invented.length) issues.push(`Contains numbers that are not in the calculated results: ${invented.join(", ")}`);
  if (STAT_RE.test(text)) issues.push("Mentions audience statistics, which are not part of the verified data");
  if (URL_RE.test(text)) issues.push("Contains a link");
  return issues;
}

export function createClaudeMatchExplainer(messages: MessagesClient, model: string): MatchExplainer {
  return {
    async explain(input) {
      const facts = buildFacts(input);
      const response = await messages.create({
        model,
        max_tokens: 4000,
        output_config: { effort: "low", format: { type: "json_schema", schema: JSON_SCHEMA } },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: EXPLAINER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(facts, null, 2) }],
      });
      if (response.stop_reason === "refusal") throw new AiResponseError("The AI declined to write an explanation.");
      if (response.stop_reason === "max_tokens") throw new AiResponseError("The AI explanation was cut off. Please try again.");

      let parsed: unknown;
      try {
        parsed = JSON.parse(extractText(response.content));
      } catch {
        throw new AiResponseError("The AI explanation was not valid JSON");
      }
      const result = responseSchema.safeParse(parsed);
      if (!result.success) throw new AiResponseError("The AI explanation was malformed", result.error.issues.map((i) => i.message));
      const issues = checkExplanation(result.data.explanation, facts);
      if (issues.length) throw new AiResponseError("The AI explanation included information that isn't in the calculated results, so it was discarded", issues);
      return { explanation: result.data.explanation, model: response.model };
    },
  };
}

export function createDefaultMatchExplainer(apiKey: string | null, model: string): MatchExplainer | null {
  const messages = createMessagesClient(apiKey);
  return messages ? createClaudeMatchExplainer(messages, model) : null;
}
