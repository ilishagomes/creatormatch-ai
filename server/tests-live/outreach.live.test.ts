import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { openDatabase } from "../src/db/database.js";
import { seedCreators } from "../src/db/seed.js";
import { createCreatorRepository } from "../src/repositories/creatorRepository.js";
import { createDefaultMatchExplainer } from "../src/services/matchExplainer.js";
import { scoreCreator } from "../src/services/matching/index.js";
import { checkGuardrails, createDefaultOutreachGenerator } from "../src/services/outreach.js";
import type { Campaign } from "../src/types.js";
import { aiOutreachSchema } from "../src/validation/outreach.js";

/**
 * Makes REAL calls to Claude (3 requests, a few cents at most).
 * Skipped automatically when no API key is configured.
 */
const hasKey = Boolean(config.anthropicApiKey);
if (!hasKey) console.warn("\n⚠ Skipping live tests: ANTHROPIC_API_KEY is not set in .env\n");

const db = openDatabase(":memory:");
seedCreators(db);
const creators = createCreatorRepository(db);

const campaign: Campaign = {
  id: 1, brandName: "Glow Lab", product: "Vitamin C brightening serum", industry: "skincare",
  description: "We're launching a fragrance-free vitamin C serum for sensitive skin and want creators who give honest product reviews and explain ingredients.",
  targetAudience: "Skincare enthusiasts with sensitive skin", ageMin: 18, ageMax: 34, platforms: ["youtube", "tiktok"],
  budget: 5000, currency: "GBP", goal: "product_launch", createdAt: new Date().toISOString(),
};

describe.skipIf(!hasKey)(`LIVE: outreach generation with ${config.anthropicModel}`, () => {
  const generator = createDefaultOutreachGenerator(config.anthropicApiKey, config.anthropicModel)!;

  it.each(["Cassandra Bankson", "Dr Dray"])("writes a valid, guardrail-clean draft for %s", async (search) => {
    const creator = creators.findAll({ search })[0];
    const draft = await generator.generate({ campaign, creator, match: scoreCreator(campaign, creator) });

    // Shape is valid according to the same zod schema the app uses
    expect(aiOutreachSchema.safeParse(draft).success).toBe(true);
    // No invented contact details, stats, money, prior contact or partnerships
    expect(checkGuardrails(draft)).toEqual([]);
    // It is personalised to this campaign and creator
    expect(`${draft.subject} ${draft.body}`).toMatch(/Glow Lab/);
    expect(draft.body).toMatch(/\[Your name\]/);
    expect(draft.requiresHumanReview).toBe(true);
    expect(draft.model).toBeTruthy();
    console.log(`\n--- ${creator.name} (${draft.model}, attempts: ${draft.attempts}) ---\nSUBJECT: ${draft.subject}\n\n${draft.body}\n\nWHY: ${draft.personalizationNote}\n`);
  });

  it("writes a plain-English match explanation that passes the number check", async () => {
    const creator = creators.findAll({ search: "Muneeb" })[0];
    const explainer = createDefaultMatchExplainer(config.anthropicApiKey, config.anthropicModel)!;
    const { explanation } = await explainer.explain({ campaign, creator, match: scoreCreator(campaign, creator) });
    expect(explanation.length).toBeGreaterThan(40);
    console.log(`\n--- Match explanation ---\n${explanation}\n`);
  });
});
