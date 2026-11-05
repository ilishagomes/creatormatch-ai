import { useState } from "react";
import { Link } from "react-router";
import { api } from "../api/client";
import { CreatorAvatar } from "../components/CreatorAvatar";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { Badge, ButtonLink, Card, EmptyState, ErrorBanner, PageHeader, Skeleton, Spinner, cx, timeAgo } from "../components/ui";
import { useAsync } from "../components/useAsync";
import type { Draft } from "../types";

type Filter = "all" | "review" | "reviewed";

export function DraftsPage() {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useAsync(() => api.listDrafts(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState<number | null>(null);

  async function remove(d: Draft) {
    if (!window.confirm(`Delete the draft to ${d.creatorName}? This can't be undone.`)) return;
    setDeleting(d.id);
    try {
      await api.deleteDraft(d.id);
      setData((list) => list?.filter((x) => x.id !== d.id) ?? null);
      toast("Draft deleted");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setDeleting(null);
    }
  }

  const list = (data ?? []).filter((d) => filter === "all" || (filter === "reviewed" ? d.reviewed : !d.reviewed));
  const counts = { all: data?.length ?? 0, review: data?.filter((d) => !d.reviewed).length ?? 0, reviewed: data?.filter((d) => d.reviewed).length ?? 0 };

  return (
    <>
      <PageHeader eyebrow="Outreach" title="Outreach drafts" description="Edit, review and copy your outreach emails. Nothing is ever sent automatically." />

      {data && data.length > 0 && (
        <div className="mb-4 inline-flex rounded-xl border border-line bg-white p-1 shadow-[var(--shadow-card)]" role="tablist">
          {(["all", "review", "reviewed"] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={cx("rounded-lg px-3 py-1.5 text-sm font-medium transition", filter === f ? "bg-lavender-50 text-lavender-700" : "text-ink-muted hover:text-ink")}>
              {f === "all" ? "All" : f === "review" ? "Needs review" : "Reviewed"} <span className="ml-1 text-xs opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      {error && <ErrorBanner message={error.message} onRetry={reload} />}
      {loading && <Card className="divide-y divide-line">{[0, 1, 2].map((i) => <div key={i} className="flex gap-3 p-5"><Skeleton className="size-11 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div></div>)}</Card>}
      {data && data.length === 0 && (
        <EmptyState icon="mail" title="No drafts yet" description="Open a campaign, choose a creator and generate an outreach email to save your first draft."
          action={<ButtonLink to="/campaigns" variant="accent">Go to campaigns</ButtonLink>} />
      )}
      {data && data.length > 0 && list.length === 0 && <EmptyState icon="checkCircle" title="Nothing here" description="No drafts match this filter." />}
      {list.length > 0 && (
        <Card className="divide-y divide-line overflow-hidden">
          {list.map((d) => (
            <div key={d.id} className="group flex items-center gap-3 px-4 py-4 transition hover:bg-lavender-50/40 sm:px-5">
              <CreatorAvatar name={d.creatorName} />
              <Link to={`/outreach/${d.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium group-hover:text-lavender-700">{d.subject}</p>
                <p className="truncate text-sm text-ink-muted">To {d.creatorName} · {d.brandName} · {timeAgo(d.updatedAt)}</p>
              </Link>
              <div className="hidden shrink-0 gap-1.5 sm:flex">
                {d.reviewed ? <Badge tone="green" icon="checkCircle">Reviewed</Badge> : <Badge tone="amber">Needs review</Badge>}
                <Badge icon={d.aiGenerated ? "sparkles" : "edit"}>{d.aiGenerated ? "AI draft" : "Manual"}</Badge>
              </div>
              <Link to={`/outreach/${d.id}`} className="rounded-lg p-2 text-ink-muted hover:bg-white hover:text-ink" aria-label={`Edit draft to ${d.creatorName}`}><Icon name="edit" /></Link>
              <button onClick={() => remove(d)} disabled={deleting === d.id} className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-700" aria-label={`Delete draft to ${d.creatorName}`}>
                {deleting === d.id ? <Spinner className="size-4" /> : <Icon name="trash" />}
              </button>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
