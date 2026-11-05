import { Link } from "react-router";
import { api } from "../api/client";
import { Icon, type IconName } from "../components/Icon";
import { ButtonLink, Card, CardHeader, ErrorBanner, PageHeader, Skeleton, cx, timeAgo } from "../components/ui";
import { useAsync } from "../components/useAsync";
import { INDUSTRIES, label } from "../types";

interface Activity { at: string; icon: IconName; text: React.ReactNode; to: string }

/** Overview built entirely from real application data — no invented analytics. */
export function DashboardPage() {
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([api.listCreators(), api.listCampaigns(), api.listDrafts()]).then(([creators, campaigns, drafts]) => ({ creators, campaigns, drafts })),
    [],
  );

  if (error) return <><Header /><ErrorBanner message={error.message} onRetry={reload} /></>;
  if (loading || !data) return <><Header /><DashboardSkeleton /></>;

  const { creators, campaigns, drafts } = data;
  const reviewed = drafts.filter((d) => d.reviewed).length;
  const categories = INDUSTRIES.map((n) => ({ niche: n, count: creators.filter((c) => c.niche === n).length }));
  const maxCount = Math.max(...categories.map((c) => c.count), 1);

  const activity: Activity[] = [
    ...campaigns.map((c) => ({ at: c.createdAt, icon: "campaign" as const, to: `/campaigns/${c.id}`, text: <>Campaign <b className="font-medium text-ink">{c.brandName}</b> created</> })),
    ...drafts.map((d) => ({
      at: d.updatedAt, icon: "mail" as const, to: `/outreach/${d.id}`,
      text: <>Outreach draft to <b className="font-medium text-ink">{d.creatorName}</b> {d.updatedAt !== d.createdAt ? "edited" : "saved"}{d.reviewed ? " · reviewed" : ""}</>,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);

  const steps = [
    { done: campaigns.length > 0, label: "Create a campaign brief", to: "/campaigns/new" },
    { done: campaigns.length > 0, label: "Review ranked creator matches", to: campaigns[0] ? `/campaigns/${campaigns[0].id}` : "/campaigns/new" },
    { done: drafts.length > 0, label: "Draft personalised outreach", to: campaigns[0] ? `/campaigns/${campaigns[0].id}` : "/campaigns/new" },
    { done: reviewed > 0, label: "Review and save a draft", to: "/outreach" },
  ];

  return (
    <>
      <Header />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon="database" label="Creators in database" value={creators.length} sub={`${categories.filter((c) => c.count).length} content categories · verified sources`} to="/creators" />
        <Stat icon="campaign" label="Saved campaigns" value={campaigns.length} sub={campaigns[0] ? `Latest: ${campaigns[0].brandName}` : "None yet"} to="/campaigns" />
        <Stat icon="mail" label="Outreach drafts" value={drafts.length} sub={drafts.length ? `${reviewed} reviewed · ${drafts.length - reviewed} need review` : "None yet"} to="/outreach" />
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Recent activity" icon="clock" description="Campaigns and drafts, newest first" />
          {activity.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium">No activity yet</p>
              <p className="mt-1 text-sm text-ink-muted">Create your first campaign to start matching creators.</p>
              <ButtonLink to="/campaigns/new" icon="plus" variant="accent" className="mt-5">Create campaign</ButtonLink>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {activity.map((a, i) => (
                <li key={i}>
                  <Link to={a.to} className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-lavender-50/50 sm:px-6">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-subtle text-ink-muted group-hover:text-lavender-600"><Icon name={a.icon} /></span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{a.text}</span>
                    <span className="shrink-0 text-xs text-ink-faint">{timeAgo(a.at)}</span>
                    <Icon name="chevronRight" className="size-4 shrink-0 text-ink-faint opacity-0 transition group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Getting started" icon="target" description="Your progress through the core workflow" />
            <ol className="space-y-1 p-3">
              {steps.map((s, i) => (
                <li key={s.label}>
                  <Link to={s.to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-lavender-50/60">
                    <span className={cx("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", s.done ? "bg-emerald-500 text-white" : "bg-subtle text-ink-muted ring-1 ring-line")}>
                      {s.done ? <Icon name="check" className="size-3.5" strokeWidth={2.5} /> : i + 1}
                    </span>
                    <span className={cx("flex-1", s.done && "text-ink-muted line-through decoration-ink-faint/50")}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Creator database" icon="creators" description="Creators per content category" />
            <ul className="space-y-2.5 p-5 sm:px-6">
              {categories.map((c) => (
                <li key={c.niche} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 truncate text-ink-muted">{label(c.niche)}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                    <span className="block h-full rounded-full bg-lavender-400" style={{ width: `${(c.count / maxCount) * 100}%` }} />
                  </span>
                  <span className="w-5 text-right font-medium tabular-nums">{c.count}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function Header() {
  return (
    <PageHeader
      eyebrow="Overview"
      title="Creator partnerships, explained"
      description="Build a campaign brief, rank real creators with an explainable compatibility score, and draft outreach with Claude."
      actions={<ButtonLink to="/campaigns/new" icon="plus" variant="accent">New campaign</ButtonLink>}
    />
  );
}

function Stat({ icon, label: l, value, sub, to }: { icon: IconName; label: string; value: number; sub: string; to: string }) {
  return (
    <Link to={to} className="group">
      <Card className="h-full p-5 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-lift)]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink-muted">{l}</p>
          <span className="grid size-9 place-items-center rounded-xl bg-lavender-50 text-lavender-600"><Icon name={icon} /></span>
        </div>
        <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        <p className="mt-1 truncate text-xs text-ink-faint">{sub}</p>
      </Card>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <Card key={i} className="p-5"><Skeleton className="h-4 w-32" /><Skeleton className="mt-4 h-8 w-16" /><Skeleton className="mt-2 h-3 w-40" /></Card>)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="space-y-4 p-6">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8" />)}</Card>
        <Card className="space-y-3 p-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-6" />)}</Card>
      </div>
    </div>
  );
}
