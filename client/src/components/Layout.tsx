import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { api } from "../api/client";
import { Icon, type IconName } from "./Icon";
import { ToastProvider } from "./Toast";
import { ButtonLink, cx } from "./ui";
import { useAsync } from "./useAsync";

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/campaigns", label: "Campaigns", icon: "campaign" },
  { to: "/creators", label: "Creators", icon: "creators" },
  { to: "/outreach", label: "Outreach", icon: "mail" },
];

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--color-lavender-600)" />
        <circle cx="12.5" cy="16" r="5.5" fill="none" stroke="#fff" strokeWidth="2.4" />
        <circle cx="19.5" cy="16" r="5.5" fill="none" stroke="#fff" strokeWidth="2.4" opacity=".7" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">
        CreatorMatch <span className="text-lavender-600">AI</span>
      </span>
    </span>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const health = useAsync(() => api.health(), []);
  const status = health.loading
    ? null
    : health.error
      ? { dot: "bg-red-500", text: "API offline", hint: "Start the backend with npm run dev" }
      : health.data?.aiConfigured
        ? { dot: "bg-emerald-500", text: "Claude connected", hint: "AI outreach is available" }
        : { dot: "bg-amber-500", text: "AI not configured", hint: "Add ANTHROPIC_API_KEY to .env" };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link to="/" onClick={onNavigate} aria-label="CreatorMatch AI home"><Logo /></Link>
      </div>
      <div className="px-4 pb-4">
        <ButtonLink to="/campaigns/new" variant="accent" icon="plus" className="w-full" >New campaign</ButtonLink>
      </div>
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate}
            className={({ isActive }) => cx(
              "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
              isActive ? "bg-white text-ink shadow-[var(--shadow-card)] ring-1 ring-line" : "text-ink-muted hover:bg-white/60 hover:text-ink",
            )}>
            {({ isActive }) => (
              <>
                <Icon name={item.icon} className={cx("size-[18px]", isActive ? "text-lavender-600" : "text-ink-faint group-hover:text-ink-muted")} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-3 p-4">
        {status && (
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5" title={status.hint}>
            <span className={cx("size-2 shrink-0 rounded-full", status.dot)} />
            <div className="min-w-0 leading-tight">
              <p className="text-xs font-medium">{status.text}</p>
              <p className="truncate text-[11px] text-ink-faint">{status.hint}</p>
            </div>
          </div>
        )}
        <p className="px-1 text-[11px] leading-relaxed text-ink-faint">
          Curated public data. Not connected to social platform APIs. Scores are compatibility estimates, not predictions.
        </p>
      </div>
    </div>
  );
}

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Scroll to top on page change; close the mobile drawer.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[radial-gradient(1200px_500px_at_80%_-10%,var(--color-lavender-100),transparent)]">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-canvas/80 backdrop-blur lg:block">
          <SidebarContent />
        </aside>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/85 px-4 backdrop-blur lg:hidden">
          <Link to="/" aria-label="CreatorMatch AI home"><Logo /></Link>
          <button onClick={() => setDrawerOpen(true)} className="rounded-lg p-2 text-ink-muted hover:bg-lavender-50" aria-label="Open menu" aria-expanded={drawerOpen}>
            <Icon name="menu" className="size-5" />
          </button>
        </header>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-fade-up bg-canvas shadow-[var(--shadow-pop)]">
              <button onClick={() => setDrawerOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 text-ink-muted hover:bg-lavender-50" aria-label="Close menu">
                <Icon name="close" className="size-5" />
              </button>
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        <main className="lg:pl-64">
          <div key={location.pathname} className="mx-auto max-w-6xl animate-fade-up px-4 py-8 sm:px-8 sm:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
