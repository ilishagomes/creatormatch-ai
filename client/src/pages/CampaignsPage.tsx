import { Link } from "react-router";
import { api } from "../api/client";
import { Icon, PLATFORM_ICON } from "../components/Icon";
import { Badge, ButtonLink, Card, EmptyState, ErrorBanner, PageHeader, Skeleton, timeAgo } from "../components/ui";
import { useAsync } from "../components/useAsync";
import { label } from "../types";

export function CampaignsPage() {
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([api.listCampaigns(), api.listDrafts()]).then(([campaigns, drafts]) => ({ campaigns, drafts })),
    [],
  );

  return (
    <>
      <PageHeader eyebrow="Campaigns" title="Your campaigns" description="Each campaign brief ranks every creator in the database for that brand."
        actions={<ButtonLink to="/campaigns/new" icon="plus" variant="accent">New campaign</ButtonLink>} />

      {error && <ErrorBanner message={error.message} onRetry={reload} />}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <Card key={i} className="p-5"><Skeleton className="h-5 w-40" /><Skeleton className="mt-2 h-4 w-56" /><Skeleton className="mt-6 h-4 w-full" /></Card>)}
        </div>
      )}
      {data && data.campaigns.length === 0 && (
        <EmptyState icon="campaign" title="No campaigns yet" description="Create a campaign brief to see real creators ranked by compatibility."
          action={<ButtonLink to="/campaigns/new" icon="plus" variant="accent">Create your first campaign</ButtonLink>} />
      )}
      {data && data.campaigns.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.campaigns.map((c) => {
            const draftCount = data.drafts.filter((d) => d.campaignId === c.id).length;
            return (
              <Link key={c.id} to={`/campaigns/${c.id}`} className="group">
                <Card className="flex h-full flex-col p-5 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-lavender-200 group-hover:shadow-[var(--shadow-lift)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">{c.brandName}</h2>
                      <p className="truncate text-sm text-ink-muted">{c.product}</p>
                    </div>
                    <Badge tone="lavender">{label(c.industry)}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-ink-muted">{c.description}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-xs text-ink-muted">
                    <span className="flex items-center gap-1.5">{c.platforms.map((p) => <Icon key={p} name={PLATFORM_ICON[p]} className="size-3.5" />)} {c.platforms.map(label).join(", ")}</span>
                    <span className="flex items-center gap-1.5"><Icon name="target" className="size-3.5" />{label(c.goal)}</span>
                    <span className="flex items-center gap-1.5"><Icon name="mail" className="size-3.5" />{draftCount} draft{draftCount === 1 ? "" : "s"}</span>
                    <span className="ml-auto text-ink-faint">{timeAgo(c.createdAt)}</span>
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-lavender-600">View matches <Icon name="arrowRight" className="size-3.5 transition group-hover:translate-x-0.5" /></span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
