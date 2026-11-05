/**
 * `npm run ai:check` — makes ONE real Claude call with a sample campaign and
 * prints the result. Use it to confirm your API key and the AI integration
 * work before recording your demo. (Costs a fraction of a cent.)
 */
import { config } from "../config.js";
import { openDatabase } from "../db/database.js";
import { seedCreators } from "../db/seed.js";
import { createCreatorRepository } from "../repositories/creatorRepository.js";
import { scoreCreator } from "../services/matching/index.js";
import { AiResponseError, createDefaultOutreachGenerator, toHttpError } from "../services/outreach.js";
import type { Campaign } from "../types.js";

const generator = createDefaultOutreachGenerator(config.anthropicApiKey, config.anthropicModel);
if (!generator) {
  console.error("ANTHROPIC_API_KEY is not set in .env");
  process.exit(1);
}

const db = openDatabase(":memory:");
seedCreators(db);
const creator = createCreatorRepository(db).findAll({ search: "Dr Dray" })[0];
const campaign: Campaign = {
  id: 0, brandName: "Glow Lab", product: "Vitamin C brightening serum", industry: "beauty",
  description: "Launching a fragrance-free vitamin C serum for sensitive skin. We want honest skincare reviews and ingredient education.",
  targetAudience: "Skincare enthusiasts with sensitive skin", ageMin: 18, ageMax: 34, platforms: ["youtube"],
  budget: 5000, currency: "GBP", goal: "product_launch", createdAt: new Date().toISOString(),
};

console.log(`Calling ${config.anthropicModel} for ${creator.name}...`);
const started = Date.now();
try {
  const email = await generator.generate({ campaign, creator, match: scoreCreator(campaign, creator) });
  console.log(`\nOK in ${((Date.now() - started) / 1000).toFixed(1)}s (model: ${email.model}, attempts: ${email.attempts})\n`);
  console.log(`SUBJECT: ${email.subject}\n\n${email.body}\n\nWHY: ${email.personalizationNote}`);
} catch (err) {
  const mapped = toHttpError(err) as Error;
  console.error("FAILED:", mapped.message);
  if (err instanceof AiResponseError) console.error(`code: ${err.code}`, err.issues);
  else if (mapped === err) console.error(err);
  process.exit(1);
}
