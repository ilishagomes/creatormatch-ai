import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/database.js";
import { seedCreators } from "../src/db/seed.js";
import { createCreatorRepository } from "../src/repositories/creatorRepository.js";
import { rankCreators } from "../src/services/matching/index.js";
import type { Campaign } from "../src/types.js";

/**
 * Scenario tests against the REAL curated dataset: different kinds of
 * campaigns must surface meaningfully different creators.
 */
const db = openDatabase(":memory:");
seedCreators(db);
const creators = createCreatorRepository(db).findAll();

const base = { id: 1, brandName: "Brand", ageMin: 18, ageMax: 34, budget: 5000, currency: "GBP", goal: "product_launch", createdAt: "" } as const;

export const SCENARIOS: Record<string, Campaign> = {
  skincare: {
    ...base, industry: "skincare", product: "Gentle acne cleanser",
    description: "A fragrance-free cleanser for oily, acne-prone skin. We want skincare educators who explain ingredients and give honest product reviews.",
    targetAudience: "Young adults dealing with acne", platforms: ["youtube", "tiktok"],
  },
  athleticApparel: {
    ...base, industry: "fitness", product: "Squat-proof training leggings",
    description: "Performance leggings and tops for strength training, gym sessions, HIIT and home workouts. Looking for fitness creators who train in their kit.",
    targetAudience: "Women who lift and train at home", platforms: ["youtube", "instagram"],
  },
  technology: {
    ...base, industry: "technology", product: "Noise-cancelling headphones",
    description: "Launching premium headphones. We want honest tech reviews from creators who cover smartphones, gadgets and consumer electronics.",
    targetAudience: "Tech enthusiasts", platforms: ["youtube"],
  },
  food: {
    ...base, industry: "food", product: "Plant-based pasta sauce",
    description: "A vegan pasta sauce. We want cooking creators who share easy recipes, comfort food and plant-based meals.",
    targetAudience: "Home cooks", platforms: ["tiktok", "youtube"],
  },
  fashion: {
    ...base, industry: "fashion", product: "Capsule wardrobe collection",
    description: "A luxury fashion capsule collection. Looking for styling and outfits content from creators who attend fashion week.",
    targetAudience: "Style-conscious professionals", platforms: ["instagram", "tiktok"],
  },
};

const top = (c: Campaign, n = 5) => rankCreators(c, creators).slice(0, n);

describe("different campaigns surface different creators", () => {
  it.each([
    ["skincare", "skincare"],
    ["athleticApparel", "fitness"],
    ["technology", "technology"],
    ["food", "food"],
    ["fashion", "fashion"],
  ])("%s campaign → top 3 are all %s creators", (scenario, niche) => {
    const top3 = top(SCENARIOS[scenario], 3);
    expect(top3.map((r) => r.creator.niche)).toEqual([niche, niche, niche]);
  });

  it("no two campaigns share the same #1 creator", () => {
    const leaders = Object.values(SCENARIOS).map((c) => top(c, 1)[0].creator.id);
    expect(new Set(leaders).size).toBe(leaders.length);
  });

  it("top-5 lists barely overlap between campaigns", () => {
    const lists = Object.values(SCENARIOS).map((c) => new Set(top(c).map((r) => r.creator.id)));
    for (let i = 0; i < lists.length; i++) {
      for (let j = i + 1; j < lists.length; j++) {
        const shared = [...lists[i]].filter((id) => lists[j].has(id)).length;
        expect(shared).toBeLessThanOrEqual(1);
      }
    }
  });

  it("flags a creator who owns a competing activewear brand for the apparel campaign", () => {
    const cassey = rankCreators(SCENARIOS.athleticApparel, creators).find((r) => r.creator.handle === "blogilates")!;
    expect(cassey.match.conflicts.map((c) => c.brand)).toContain("POPFLEX");
  });

  it("flags skincare-brand founders for the skincare campaign", () => {
    const flagged = rankCreators(SCENARIOS.skincare, creators)
      .filter((r) => r.match.conflicts.length)
      .map((r) => r.creator.handle);
    expect(flagged).toEqual(expect.arrayContaining(["Hyram", "shereeneidriss", "dermdoctor", "susanyara"]));
  });
});
