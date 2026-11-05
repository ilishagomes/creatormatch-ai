import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { api } from "../api/client";
import { CreatorCard, CreatorCardSkeleton } from "../components/CreatorCard";
import { DatasetDisclaimer } from "../components/DatasetDisclaimer";
import { Icon, PLATFORM_ICON } from "../components/Icon";
import { ScoreDisclaimer } from "../components/ScoreRing";
import { Badge, ButtonLink, Card, EmptyState, ErrorBanner, PageHeader, Skeleton, cx } from "../components/ui";
import { useAsync } from "../components/useAsync";
import { INDUSTRIES, PLATFORMS, label, type RankedCreator } from "../types";

type SortKey = "score" | "name" | "niche";

/** Creator discovery: every creator ranked for one campaign. */
export function DiscoveryPage() {
  const id = Number(useParams().id);
  const { data, error, loading, reload } = useAsync(() => api.getMatches(id), [id]);

  const [search, setSearch] = useState("");
  const [niche, setNiche] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [hideConflicts, setHideConflicts] = useState(false);

  // Filtering and sorting happen in the browser: the server returns all ranked creators once.
  const visible = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const by: Record<SortKey, (a: RankedCreator, b: RankedCreator) => number> = {
      score: (a, b) => b.match.score - a.match.score,
      name: (a, b) => a.creator.name.localeCompare(b.creator.name),
      niche: (a, b) => a.creator.niche.localeCompare(b.creator.niche) || b.match.score - a.match.score,
    };
    return data.results
      .map((r, i) => ({ ...r, rank: i + 1 }))
      .filter((r) => niche === "all" || r.creator.niche === niche)
      .filter((r) => platform === "all" || r.creator.primaryPlatform === platform)
      .filter((r) => !hideConflicts || r.match.conflicts.length === 0)
      .filter((r) => !q || [r.creator.name, r.creator.handle, r.creator.description ?? "", ...r.creator.tags].join(" ").toLowerCase().includes(q))
      .sort(by[sort]);
  }, [data, search, niche, platform, sort, hideConflicts]);

  if (error) return <><PageHeader title="Creator discovery" back={{ to: "/campaigns", label: "Campaigns" }} /><ErrorBanner message={error.message} onRetry={reload} /></>;
  if (loading || !data) {
    return (
      <div aria-busy="true" aria-label="Ranking creators">
        <Skeleton className="mb-3 h-4 w-24" /><Skeleton className="h-8 w-64" /><Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <Skeleton className="mt-8 h-24 rounded-2xl" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <CreatorCardSkeleton key={i} Skeleton={Skeleton} />)}</div>
      </div>
    );
  }

  const c = data.campaign;
  const counts = Object.fromEntries(INDUSTRIES.map((n) => [n, data.results.filter((r) => r.creator.niche === n).length]));
  const strong = data.results.filter((r) => r.match.tier === "Strong").length;
  const flagged = data.results.filter((r) => r.match.conflicts.length).length;
  const resetFilters = () => (setSearch(""), setNiche("all"), setPlatform("all"), setHideConflicts(false));

  return (
    <>
      <PageHeader
        back={{ to: "/campaigns", label: "Campaigns" }}
        eyebrow={<span className="inline-flex items-center gap-1.5"><Icon name="campaign" className="size-3.5" />Creator discovery · {label(c.industry)}</span>}
        title={`${c.brandName} — ${c.product}`}
        description={`${label(c.goal)} for ${c.targetAudience.toLowerCase()}, ages ${c.ageMin}–${c.ageMax}.`}
        actions={<ButtonLink to="/outreach" variant="secondary" icon="mail">Outreach drafts</ButtonLink>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Creators ranked" value={data.results.length} />
        <MiniStat label="Strong fits" value={strong} />
        <MiniStat label="Conflict flags" value={flagged} />
        <Card className="px-4 py-3">
          <p className="text-xs text-ink-faint">Platforms</p>
          <div className="mt-1.5 flex flex-wrap gap-1">{c.platforms.map((p) => <Badge key={p} tone="lavender" icon={PLATFORM_ICON[p]}>{label(p)}</Badge>)}</div>
        </Card>
      </div>

      <Card className="mb-6 p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon name="sparkles" className="text-lavender-600" />How we read your brief</h2>
          <p className="text-xs text-ink-faint">Weight = where it appears (product 1.5× · description 1× · audience 0.5×) × specificity</p>
        </div>
        {data.briefTopics.length === 0 ? (
          <p className="text-sm text-ink-muted">No recognised topics. Add specific words (e.g. “acne”, “running”, “laptop”) for better keyword matching.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.briefTopics.map((t) => (
              <span key={t.topic} className="inline-flex items-center gap-2 rounded-lg border border-line bg-subtle/60 py-1 pl-3 pr-1 text-sm" title={`Found: ${t.terms.join(", ")}`}>
                {t.topic}
                <span className="rounded-md bg-white px-1.5 py-0.5 text-xs font-semibold tabular-nums text-lavender-700 ring-1 ring-lavender-200">{t.importance}</span>
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="sticky top-14 z-20 -mx-4 mb-4 border-y border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border lg:top-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, handle or topic…" aria-label="Search creators"
              className="h-10 w-full rounded-xl border border-line bg-white pl-10 pr-4 text-sm outline-none transition focus:border-lavender-500 focus:ring-4 focus:ring-lavender-100" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <select aria-label="Category" value={niche} onChange={(e) => setNiche(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm">
              <option value="all">All categories ({data.results.length})</option>
              {INDUSTRIES.map((n) => <option key={n} value={n}>{label(n)} ({counts[n]})</option>)}
            </select>
            <select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm">
              <option value="all">All platforms</option>
              {PLATFORMS.map((p) => <option key={p} value={p}>{label(p)}</option>)}
            </select>
            <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm">
              <option value="score">Best match</option>
              <option value="name">Name A–Z</option>
              <option value="niche">Category</option>
            </select>
            <label className={cx("flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm transition", hideConflicts ? "border-lavender-300 bg-lavender-50 text-lavender-700" : "border-line bg-white text-ink-muted")}>
              <input type="checkbox" checked={hideConflicts} onChange={(e) => setHideConflicts(e.target.checked)} className="size-4 accent-[var(--color-lavender-600)]" />
              Hide conflicts
            </label>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-sm text-ink-muted" aria-live="polite">Showing {visible.length} of {data.results.length} creators</p>
        <ScoreDisclaimer className="sm:max-w-lg sm:text-right" />
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="search" title="No creators match these filters" description="Try a different search term or clear the filters."
          action={<button onClick={resetFilters} className="text-sm font-medium text-lavender-600 hover:underline">Clear filters</button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((r) => <CreatorCard key={r.creator.id} item={r} rank={r.rank} campaignId={c.id} />)}
        </div>
      )}

      <DatasetDisclaimer className="mt-8" />
    </>
  );
}

function MiniStat({ label: l, value }: { label: string; value: number }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-ink-faint">{l}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    </Card>
  );
}
