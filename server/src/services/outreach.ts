import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Campaign, Creator } from "../types.js";
import { aiOutreachSchema, type AiOutreach } from "../validation/outreach.js";
import { AiResponseError, createMessagesClient, extractText, type MessagesClient } from "./ai.js";
import type { MatchResult } from "./matching/index.js";

// Re-exported so existing imports keep working.
export { AiResponseError, toHttpError, type MessagesClient } from "./ai.js";

export interface OutreachRequest {
  campaign: Campaign;
  creator: Creator;
  match: MatchResult;
}

export interface GeneratedOutreach extends AiOutreach {
  model: string;
  generatedAt: string;
  /** How many Claude calls it took to get a valid draft (1 or 2) */
  attempts: number;
  /** Always true — shown to the user as "AI-generated draft, requires human review" */
  requiresHumanReview: true;
}

/**
 * Anything that can write an outreach email. The real app uses Claude; the
 * unit tests pass in a fake so they never call the paid API.
 */
export interface OutreachGenerator {
  generate(req: OutreachRequest): Promise<GeneratedOutreach>;
}

/** Total Claude calls per click when the reply fails validation (1 try + 1 automatic retry). */
export const MAX_ATTEMPTS = 2;

// ---------------------------------------------------------------- prompt ---

export const SYSTEM_PROMPT = `You write first-contact brand partnership outreach emails from a brand to a social media creator.

The email is a DRAFT. A person at the brand will review, edit and send it themselves, so write a strong, natural draft.

Accuracy rules — the user message contains the ONLY facts you may rely on:
- Only reference facts about the creator listed under "Verified creator profile". If something is not listed, do not mention it.
- Never state or estimate follower counts, subscriber counts, views, engagement rates or audience demographics.
- Never claim or imply the creator has worked with this brand or any other brand before.
- This is the FIRST contact: never say or imply the brand has already contacted, met or spoken with the creator (no "following up", "as discussed", "circling back").
- Never invent email addresses, phone numbers, URLs, discount codes or dates.
- Do not state any payment amount, fee, rate, deliverable count, deadline or contract term. You may say the brand would like to discuss a paid partnership.
- Do not mention internal notes, conflicts or any compatibility score.
- Sign off with the placeholders [Your name] and [Your role] instead of inventing a sender.

Style: warm, specific and concise (120–220 words), plain text, no emojis, no markdown.`;

const GOAL_LABELS: Record<Campaign["goal"], string> = {
  awareness: "brand awareness",
  engagement: "engagement",
  conversions: "sales and conversions",
  product_launch: "a product launch",
  content_creation: "content creation",
};

/** Builds the user message. Only verified, non-null creator fields are included. */
export function buildUserPrompt({ campaign, creator, match }: OutreachRequest): string {
  const profile: Record<string, unknown> = {
    name: creator.name,
    handle: `@${creator.handle}`,
    primaryPlatform: creator.primaryPlatform,
    contentNiche: creator.niche,
    contentTopics: creator.tags,
  };
  if (creator.description) profile.publicProfileSummary = creator.description;

  const brief = {
    brandName: campaign.brandName,
    productOrService: campaign.product,
    productAndCampaignDescription: campaign.description,
    campaignGoal: GOAL_LABELS[campaign.goal],
    industry: campaign.industry,
    targetAudience: campaign.targetAudience,
    targetAgeRange: `${campaign.ageMin}-${campaign.ageMax}`,
    platforms: campaign.platforms,
    paidPartnership: "The brand has a budget for a paid partnership. Do not state an amount.",
  };

  const overlap = [...new Set(match.matchedKeywords.filter((m) => m.relation === "exact").map((m) => m.topic))];

  return [
    "Campaign brief:",
    JSON.stringify(brief, null, 2),
    "",
    "Verified creator profile:",
    JSON.stringify(profile, null, 2),
    "",
    "Topics the creator's content shares with the brief (from our matching algorithm):",
    overlap.length ? overlap.join(", ") : "none identified",
    "",
    "Write the outreach email. In personalizationNote, name the verified profile facts you used.",
  ].join("\n");
}

// ------------------------------------------------------------ validation ---

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\./i;
const AUDIENCE_STAT_RE = /\b\d[\d,.]*\s*(k|m|million|thousand|%)?\s*(followers|subscribers|fans|views|viewers|engagement)\b/i;
const MONEY_RE = /[£$€]\s?\d|\b\d[\d,.]*\s?(k\s)?(pounds|dollars|euros|gbp|usd|eur)\b/i;
const PRIOR_CONTACT_RE = /\b(following up|follow(?:ing)? up on|circling back|as (?:we|i) (?:discussed|mentioned)|our (?:previous|last|earlier) (?:email|message|conversation|call)|(?:we|i)(?:'ve| have) (?:already )?(?:reached out|contacted|spoken|emailed))\b/i;
const PRIOR_PARTNERSHIP_RE = /\b(?:your|our) (?:recent|previous|past|last|earlier) (?:collaboration|partnership|campaign|sponsorship)\b|\b(?:worked|partnered|collaborated) with us (?:before|previously)\b/i;

/**
 * Code-level safety rules. The prompt asks Claude to follow them; this
 * function makes sure it did. Any hit → the draft is discarded (and retried).
 */
export function checkGuardrails(email: AiOutreach): string[] {
  const text = `${email.subject}\n${email.body}`;
  const issues: string[] = [];
  if (EMAIL_RE.test(text)) issues.push("Contains an email address (contact details must not be invented)");
  if (PHONE_RE.test(text)) issues.push("Contains a phone number (contact details must not be invented)");
  if (URL_RE.test(text)) issues.push("Contains a URL (links must not be invented)");
  if (AUDIENCE_STAT_RE.test(text)) issues.push("States audience statistics, which are not verified");
  if (MONEY_RE.test(text)) issues.push("States a payment amount, which was not provided");
  if (PRIOR_CONTACT_RE.test(text)) issues.push("Implies the brand already contacted the creator");
  if (PRIOR_PARTNERSHIP_RE.test(text)) issues.push("Claims a previous partnership that is not verified");
  return issues;
}

/** Turns Claude's raw text into a validated email, or throws AiResponseError with a precise code. */
export function parseAiResponse(raw: string): AiOutreach {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AiResponseError("The AI returned a reply that wasn't valid JSON.", [], "invalid_json");
  }
  const parsed = aiOutreachSchema.safeParse(json);
  if (!parsed.success) {
    throw new AiResponseError(
      "The AI reply was missing required fields or had the wrong format.",
      parsed.error.issues.map((i) => `${i.path.join(".") || "response"}: ${i.message}`),
      "schema",
    );
  }
  const issues = checkGuardrails(parsed.data);
  if (issues.length) {
    throw new AiResponseError("The AI draft included unverified information, so it was discarded.", issues, "guardrail");
  }
  return parsed.data;
}

// ----------------------------------------------------------- Claude call ---

/** The JSON Schema sent to the API, generated from the zod schema above. */
export const OUTPUT_FORMAT = betaZodOutputFormat(aiOutreachSchema);

export function createClaudeOutreachGenerator(messages: MessagesClient, model: string, maxAttempts = MAX_ATTEMPTS): OutreachGenerator {
  async function attempt(req: OutreachRequest): Promise<{ email: AiOutreach; model: string }> {
    const response = await messages.create({
      model,
      max_tokens: 8000,
      output_config: {
        // A short email doesn't need deep reasoning; low effort is faster and cheaper.
        effort: "low",
        // Structured outputs: the API constrains Claude's reply to this JSON schema.
        format: { type: "json_schema", schema: OUTPUT_FORMAT.schema },
      },
      // If a safety classifier declines by mistake, the API retries on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(req) }],
    });

    if (response.stop_reason === "refusal") {
      throw new AiResponseError("The AI declined to write this email. Try rewording the campaign description.", [], "refusal");
    }
    if (response.stop_reason === "max_tokens") {
      throw new AiResponseError("The AI reply was cut off before it finished.", [], "truncated");
    }
    return { email: parseAiResponse(extractText(response.content)), model: response.model };
  }

  return {
    async generate(req) {
      let lastError: AiResponseError | undefined;
      // Retry ONLY when the reply itself was unusable (bad JSON, schema, guardrail, cut off).
      // Network/5xx/429 retries are handled by the SDK; refusals are not retried.
      for (let n = 1; n <= maxAttempts; n++) {
        try {
          const { email, model: used } = await attempt(req);
          return { ...email, model: used, generatedAt: new Date().toISOString(), attempts: n, requiresHumanReview: true };
        } catch (err) {
          if (!(err instanceof AiResponseError) || !err.retryable) throw err;
          lastError = err;
        }
      }
      lastError!.attempts = maxAttempts;
      lastError!.message = `${lastError!.message} (${maxAttempts} attempts)`;
      throw lastError!;
    },
  };
}

export function createDefaultOutreachGenerator(apiKey: string | null, model: string): OutreachGenerator | null {
  const messages = createMessagesClient(apiKey);
  return messages ? createClaudeOutreachGenerator(messages, model) : null;
}
