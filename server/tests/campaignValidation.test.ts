import { describe, expect, it } from "vitest";
import { campaignInputSchema } from "../src/validation/campaign.js";
import { validCampaign } from "./helpers.js";

/** Returns the list of fields that failed validation. */
function failingFields(input: unknown): string[] {
  const result = campaignInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("campaign validation", () => {
  it("accepts a valid campaign", () => {
    expect(campaignInputSchema.safeParse(validCampaign).success).toBe(true);
  });

  it("trims whitespace from text fields", () => {
    const parsed = campaignInputSchema.parse({ ...validCampaign, brandName: "   Glow Lab  " });
    expect(parsed.brandName).toBe("Glow Lab");
  });

  it("rejects missing required fields", () => {
    const fields = failingFields({});
    for (const f of ["brandName", "product", "industry", "description", "targetAudience", "platforms", "budget", "goal"]) {
      expect(fields).toContain(f);
    }
  });

  it("rejects an unknown industry", () => {
    expect(failingFields({ ...validCampaign, industry: "crypto" })).toEqual(["industry"]);
  });

  it("requires at least one platform and rejects unknown platforms", () => {
    expect(failingFields({ ...validCampaign, platforms: [] })).toEqual(["platforms"]);
    expect(failingFields({ ...validCampaign, platforms: ["myspace"] })).toEqual(["platforms.0"]);
  });

  it("removes duplicate platforms", () => {
    const parsed = campaignInputSchema.parse({ ...validCampaign, platforms: ["tiktok", "tiktok"] });
    expect(parsed.platforms).toEqual(["tiktok"]);
  });

  it("rejects an age range where min > max", () => {
    expect(failingFields({ ...validCampaign, ageMin: 40, ageMax: 20 })).toEqual(["ageMax"]);
  });

  it("rejects ages under 13", () => {
    expect(failingFields({ ...validCampaign, ageMin: 10 })).toEqual(["ageMin"]);
  });

  it("rejects zero, negative and non-numeric budgets", () => {
    expect(failingFields({ ...validCampaign, budget: 0 })).toEqual(["budget"]);
    expect(failingFields({ ...validCampaign, budget: -50 })).toEqual(["budget"]);
    expect(failingFields({ ...validCampaign, budget: "5000" })).toEqual(["budget"]);
  });

  it("rejects a too-short description", () => {
    expect(failingFields({ ...validCampaign, description: "Too short" })).toEqual(["description"]);
  });

  it("defaults currency to GBP", () => {
    const { currency, ...rest } = validCampaign;
    expect(campaignInputSchema.parse(rest).currency).toBe("GBP");
  });
});
