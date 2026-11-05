import { describe, expect, it, vi } from "vitest";
import type { RankedCreator } from "../types";
import { shortExplanation } from "./CreatorCard";
import { timeAgo } from "./ui";

const item = (niche: number, platform: number, keywords: { relation: "exact" | "related" }[]): RankedCreator => ({
  creator: { niche: "skincare", primaryPlatform: "youtube" } as RankedCreator["creator"],
  match: {
    components: [{ key: "niche", value: niche }, { key: "platform", value: platform }],
    matchedKeywords: keywords,
  } as unknown as RankedCreator["match"],
});

describe("creator card explanation", () => {
  it("describes niche, topic coverage and platform from the calculated result", () => {
    expect(shortExplanation(item(1, 1, [{ relation: "exact" }, { relation: "related" }]))).toBe("Creates skincare content · covers 2 brief topics (1 exact) · active on YouTube");
  });
  it("is honest when nothing matches", () => {
    expect(shortExplanation(item(0, 0, []))).toBe("Different category (skincare) · no brief topics covered · YouTube not selected");
  });
});

describe("timeAgo", () => {
  it("formats SQLite UTC timestamps relative to now", () => {
    vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
    expect(timeAgo("2026-11-05 11:59:50")).toBe("just now");
    expect(timeAgo("2026-11-05 11:30:00")).toBe("30 min ago");
    expect(timeAgo("2026-11-05 09:00:00")).toBe("3 hr ago");
    expect(timeAgo("2026-11-03 12:00:00")).toBe("2 days ago");
    vi.useRealTimers();
  });
});
