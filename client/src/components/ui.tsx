import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";
import { Icon, type IconName } from "./Icon";

/** Joins class names, skipping falsy values. */
export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-white shadow-sm hover:bg-ink/85",
  accent: "bg-lavender-600 text-white shadow-sm shadow-lavender-600/20 hover:bg-lavender-700",
  secondary: "bg-white text-ink border border-line shadow-[var(--shadow-card)] hover:border-lavender-300 hover:bg-lavender-50",
  ghost: "text-ink-muted hover:text-ink hover:bg-lavender-50",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
};
const SIZES: Record<Size, string> = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]" };
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 whitespace-nowrap select-none";

export function Button({
  variant = "primary", size = "md", loading = false, icon, className, children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; icon?: IconName }) {
  return (
    <button className={cx(BASE, VARIANTS[variant], SIZES[size], className)} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner className="size-4" /> : icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function ButtonLink({ to, variant = "primary", size = "md", icon, className, children }: { to: string; variant?: Variant; size?: Size; icon?: IconName; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={cx(BASE, VARIANTS[variant], SIZES[size], className)}>
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  );
}

export function Card({ className, children, as: As = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" }) {
  return <As className={cx("rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]", className)}>{children}</As>;
}

export function CardHeader({ title, description, icon, action }: { title: string; description?: ReactNode; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-lavender-50 text-lavender-600">
            <Icon name={icon} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

type Tone = "neutral" | "lavender" | "green" | "amber" | "red";
const TONES: Record<Tone, string> = {
  neutral: "bg-subtle text-ink-muted ring-line",
  lavender: "bg-lavender-50 text-lavender-700 ring-lavender-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
};
export function Badge({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[tone], className)}>
      {icon && <Icon name={icon} className="size-3" />}
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className ?? "size-5")} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Shimmering placeholder block used while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-shimmer rounded-lg bg-[linear-gradient(90deg,var(--color-subtle)_0%,#ebe8f6_50%,var(--color-subtle)_100%)] bg-[length:800px_100%]", className)}
    />
  );
}

export function ErrorBanner({ message, details, onRetry, hint }: { message: string; details?: string[]; onRetry?: () => void; hint?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-2.5">
        <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">{message}</p>
          {details && details.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-red-700">{details.map((d) => <li key={d}>{d}</li>)}</ul>
          )}
          {hint && <p className="mt-1 text-red-700/90">{hint}</p>}
        </div>
      </div>
      {onRetry && <Button variant="danger" size="sm" icon="refresh" onClick={onRetry} className="shrink-0">Try again</Button>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions, back }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="mb-8">
      {back && (
        <Link to={back.to} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-lavender-600">
          <Icon name="arrowLeft" /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-lavender-600">{eyebrow}</p>}
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-[15px] text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = "plus", title, description, action }: { icon?: IconName; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-lavender-200 bg-white/60 px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-lavender-100 text-lavender-600">
        <Icon name={icon} className="size-6" />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** "3 minutes ago" from a SQLite UTC timestamp ("YYYY-MM-DD HH:MM:SS") or ISO string. */
export function timeAgo(value: string): string {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
