import { cx } from "./ui";

/** Soft gradient pairs; each creator always gets the same one (hash of their name). */
const GRADIENTS = [
  "from-lavender-100 to-lavender-200 text-lavender-700",
  "from-violet-100 to-fuchsia-100 text-violet-700",
  "from-indigo-100 to-lavender-100 text-indigo-700",
  "from-purple-100 to-pink-100 text-purple-700",
  "from-sky-100 to-indigo-100 text-indigo-700",
];

/**
 * Initials avatar. We don't use creators' photos: we don't have the rights
 * to them and hot-linking platform images is unreliable.
 */
export function CreatorAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const clean = name.replace(/\(.*?\)/g, "").replace(/^Dr\.?\s+/i, "").trim();
  const initials = clean.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const hash = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return (
    <span className={cx(
      "grid shrink-0 place-items-center rounded-xl bg-gradient-to-br font-semibold ring-1 ring-inset ring-black/5",
      GRADIENTS[hash % GRADIENTS.length],
      size === "lg" ? "size-16 rounded-2xl text-xl" : size === "sm" ? "size-8 text-xs" : "size-11 text-sm",
    )} aria-hidden="true">
      {initials}
    </span>
  );
}

export const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
