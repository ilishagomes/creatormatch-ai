/**
 * One consistent icon set (24px grid, 1.75 stroke, rounded caps) so every
 * icon in the app looks like it belongs to the same family.
 */
const PATHS = {
  dashboard: "M4 4h6v8H4zM14 4h6v5h-6zM14 13h6v7h-6zM4 16h6v4H4z",
  campaign: "M3 11l14-6v14L3 13zM7 12.5V18a1.5 1.5 0 003 0v-4.5M17 9a3 3 0 010 6",
  creators: "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M16 3.5a4 4 0 010 7.5M22 21v-1a6 6 0 00-4-5.6",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  plus: "M12 5v14M5 12h14",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  arrowLeft: "M19 12H5M11 18l-6-6 6-6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5",
  sparkles: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  checkCircle: "M12 21a9 9 0 100-18 9 9 0 000 18zM8 12.5l3 3 5-6",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  save: "M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7",
  alert: "M12 3l9.5 17h-19zM12 10v4M12 17.5v.01",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8v.01",
  refresh: "M20 11a8 8 0 00-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0014.5 4.5L20 16M20 20v-4h-4",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  chevronRight: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  filter: "M4 5h16l-6 8v5l-4 2v-7z",
  video: "M3 6h12v12H3zM15 10l6-3v10l-6-3",
  music: "M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z",
  camera: "M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 100-8 4 4 0 000 8z",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  database: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  edit: "M4 20h4l11-11-4-4L4 16zM13.5 6.5l4 4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  target: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 17a5 5 0 100-10 5 5 0 000 10zM12 13a1 1 0 100-2 1 1 0 000 2z",
  wand: "M15 4V2M15 10V8M11 6H9M21 6h-2M18 3l-1.5 1.5M18 9l-1.5-1.5M3 21l11-11",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "", strokeWidth = 1.75 }: { name: IconName; className?: string; strokeWidth?: number }) {
  // Default to 16px unless the caller sets a size, so a colour-only className never leaves the icon unsized.
  const sized = /(^|\s)size-/.test(className) ? className : `size-4 ${className}`;
  return (
    <svg viewBox="0 0 24 24" className={sized} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export const PLATFORM_ICON: Record<string, IconName> = { youtube: "video", tiktok: "music", instagram: "camera" };
