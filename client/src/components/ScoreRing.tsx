import type { MatchResult } from "../types";
import { cx } from "./ui";

const TIER_COLOR: Record<MatchResult["tier"], string> = {
  Strong: "var(--color-lavender-600)",
  Good: "#8b7cf6",
  Moderate: "#b6abf7",
  Low: "#d6d3df",
};

/** Circular 0–100 compatibility score. */
export function ScoreRing({ score, tier, size = 64 }: { score: number; tier: MatchResult["tier"]; size?: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Compatibility score ${score} out of 100 (${tier})`}>
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-lavender-100)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={TIER_COLOR[tier]} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="transition-[stroke-dashoffset] duration-700 ease-out" />
      </svg>
      <span className={cx("absolute inset-0 grid place-items-center font-semibold tabular-nums", size >= 80 ? "text-2xl" : size >= 56 ? "text-lg" : "text-sm")}>{score}</span>
    </div>
  );
}

/** Small explanation shown next to every score so it is never mistaken for a prediction. */
export function ScoreDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cx("text-xs text-ink-faint", className)}>
      Deterministic compatibility score: niche 40%, keywords 25%, platform 20%, verified audience 15%. Unknown components are excluded and the score is rescaled. Not an AI prediction or a likelihood of partnership.
    </p>
  );
}
