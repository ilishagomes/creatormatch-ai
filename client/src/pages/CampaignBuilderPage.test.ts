import { describe, expect, it } from "vitest";
import { EMPTY, EXAMPLE, validate } from "./CampaignBuilderPage";

describe("campaign form validation (mirrors the server)", () => {
  it("accepts the example brief", () => {
    expect(validate(EXAMPLE)).toEqual({});
  });

  it("flags every required field on an empty form", () => {
    expect(Object.keys(validate(EMPTY)).sort()).toEqual(["brandName", "budget", "description", "goal", "industry", "platforms", "product", "targetAudience"].sort());
  });

  it("rejects an age range where min > max, and ages under 13", () => {
    expect(validate({ ...EXAMPLE, ageMin: "40", ageMax: "20" }).ageMax).toBeTruthy();
    expect(validate({ ...EXAMPLE, ageMin: "10" }).ageMin).toBeTruthy();
  });

  it("rejects zero, negative and non-numeric budgets", () => {
    for (const budget of ["0", "-5", "abc", ""]) expect(validate({ ...EXAMPLE, budget }).budget, budget).toBeTruthy();
  });

  it("ignores surrounding whitespace when checking length", () => {
    expect(validate({ ...EXAMPLE, brandName: "   A   " }).brandName).toBeTruthy();
  });
});
