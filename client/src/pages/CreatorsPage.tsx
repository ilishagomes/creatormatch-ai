import { useMemo, useState } from "react";
import { Link } from "react-router";
import { api } from "../api/client";
import { CreatorAvatar, PLATFORM_LABEL } from "../components/CreatorAvatar";
import { DatasetDisclaimer } from "../components/DatasetDisclaimer";
import { Icon, PLATFORM_ICON } from "../components/Icon";
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Skeleton, cx } from "../components/ui";
import { useAsync } from "../components/useAsync";
import { INDUSTRIES, PLATFORMS, label } from "../types";

/** Browse the full curated creator database (no campaign needed). */
export function CreatorsPage() {
  const { data, error, loading, reload } = useAsync(() => api.listCreators(), []);
  const [search, setSearch] = useState("");
  const [niche, setNiche] = useState("all");
  const [platform, setPlatform] = useState("all");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? [])
      .filter((c) => niche === "all" || c.niche === niche)
      .filter((c) => platform === "all" || c.primaryPlatform === platform)
      .filter((c) => !q || [c.name, c.handle, c.description ?? "", ...c.tags].join(" ").toLowerCase().includes(q));
  }, [data, search, niche, platform]);

  return (
    <>
      <PageHeader eyebrow="Creators" title="Creator database"
        description={data ? `${data.length} real creators, each with verified profile links and public sources.` : "Real creators with verified profile links and public sources."} />

      <div className="mb-5 flex flex-col gap-3">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search creators, handles or topics…" aria-label="Search creators"
            className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-4 text-sm shadow-[var(--shadow-card)] outline-none transition focus:border-lavender-500 focus:ring-4 focus:ring-lavender-100" />
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
          {["all", ...INDUSTRIES].map((n) => (
            <button key={n} onClick={() => setNiche(n)} aria-pressed={niche === n}
              className={cx("rounded-lg border px-3 py-1.5 text-sm font-medium transition", niche === n ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-muted hover:border-lavender-300 hover:text-ink")}>
              {n === "all" ? "All" : label(n)}
            </button>
          ))}
          <select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className="ml-auto h-9 rounded-lg border border-line bg-white px-3 text-sm">
            <option value="all">All platforms</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{label(p)}</option>)}
          </select>
        </div>
      </div>

      {error && <ErrorBanner message={error.message} onRetry={reload} />}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => <Card key={i} className="p-5"><div className="flex gap-3"><Skeleton className="size-11 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div></div><Skeleton className="mt-4 h-12" /></Card>)}
        </div>
      )}
      {data && visible.length === 0 && (
        <EmptyState icon="search" title="No creators found" description="Try a different search or category."
          action={<button onClick={() => (setSearch(""), setNiche("all"), setPlatform("all"))} className="text-sm font-medium text-lavender-600 hover:underline">Clear filters</button>} />
      )}
      {data && visible.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => (
            <Link key={c.id} to={`/creators/${c.id}`} className="group">
              <Card className="flex h-full flex-col p-5 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-lavender-200 group-hover:shadow-[var(--shadow-lift)]">
                <div className="flex items-start gap-3">
                  <CreatorAvatar name={c.name} />
                  <div className="min-w-0">
                    <h2 className="font-semibold leading-snug tracking-tight">{c.name}</h2>
                    <p className="truncate text-xs text-ink-muted">@{c.handle}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone="lavender">{label(c.niche)}</Badge>
                  <Badge icon={PLATFORM_ICON[c.primaryPlatform]}>{PLATFORM_LABEL[c.primaryPlatform]}</Badge>
                  {c.verificationStatus === "verified" ? <Badge tone="green" icon="shield">Verified</Badge> : <Badge tone="amber">Needs verification</Badge>}
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-ink-muted">{c.description ?? "Description not available."}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-lavender-600">View profile <Icon name="arrowRight" className="size-3.5 transition group-hover:translate-x-0.5" /></span>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <DatasetDisclaimer className="mt-8" />
    </>
  );
}
