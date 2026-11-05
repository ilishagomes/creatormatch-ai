import { Icon } from "./Icon";
import { cx } from "./ui";

/** Last date the curated dataset was researched (matches creators.json). */
export const DATASET_VERIFIED = "5 November 2026";

/** Shown wherever creator data appears so it is never mistaken for a live feed or a pricing tool. */
export function DatasetDisclaimer({ className }: { className?: string }) {
  return (
    <div className={cx("flex gap-3 rounded-xl border border-line bg-white/70 px-4 py-3 text-xs leading-relaxed text-ink-muted", className)} role="note">
      <Icon name="info" className="mt-0.5 size-4 shrink-0 text-lavender-500" />
      <p>
        <span className="font-medium text-ink">Curated research dataset</span>, last verified {DATASET_VERIFIED}, built from public sources.
        It does not provide real-time creator availability, verified partnership pricing, audience demographics or engagement rates,
        and audience size is not an indicator of cost.
      </p>
    </div>
  );
}
