import { useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ApiError, api } from "../api/client";
import { CreatorAvatar, PLATFORM_LABEL } from "../components/CreatorAvatar";
import { DatasetDisclaimer } from "../components/DatasetDisclaimer";
import { Icon, PLATFORM_ICON, type IconName } from "../components/Icon";
import { ScoreDisclaimer, ScoreRing } from "../components/ScoreRing";
import { Badge, Button, ButtonLink, Card, CardHeader, ErrorBanner, PageHeader, Skeleton, cx } from "../components/ui";
import { useAsync } from "../components/useAsync";
import { label, type Creator, type MatchResult } from "../types";

const NA = <span className="italic text-ink-faint">Not available</span>;
const pretty = (url: string) => decodeURIComponent(url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""));

/**
 * Creator profile. With ?campaign=ID it also shows the full match breakdown
 * for that campaign; without one, the user can pick a campaign to score against.
 */
export function CreatorDetailsPage() {
  const creatorId = Number(useParams().creatorId);
  const [params, setParams] = useSearchParams();
  const campaignId = Number(params.get("campaign")) || null;

  const base = useAsync(() => Promise.all([api.getCreator(creatorId), api.listCampaigns()]).then(([creator, campaigns]) => ({ creator, campaigns })), [creatorId]);
  const matchQ = useAsync(() => (campaignId ? api.getMatch(campaignId, creatorId) : Promise.resolve(null)), [campaignId, creatorId]);

  if (base.error) return <><PageHeader title="Creator" back={{ to: "/creators", label: "Creators" }} /><ErrorBanner message={base.error.message} onRetry={base.reload} /></>;
  if (base.loading || !base.data) return <DetailsSkeleton />;

  const { creator, campaigns } = base.data;
  const match = matchQ.data?.match ?? null;
  const campaign = matchQ.data?.campaign ?? null;
  const backTo = campaignId ? { to: `/campaigns/${campaignId}`, label: `Back to ${campaign?.brandName ?? "campaign"} matches` } : { to: "/creators", label: "Creators" };

  return (
    <>
      <PageHeader back={backTo} title={<span className="sr-only">{creator.name}</span>} />

      {/* Header */}
      <Card className="-mt-6 mb-6 overflow-hidden">
        <div className="h-20 bg-[linear-gradient(120deg,var(--color-lavender-100),var(--color-lavender-50)_50%,#fff)]" />
        <div className="flex flex-col gap-5 px-5 pb-6 sm:flex-row sm:items-end sm:px-8">
          <div className="-mt-10 rounded-2xl bg-white p-1 shadow-[var(--shadow-card)] sm:-mt-12"><CreatorAvatar name={creator.name} size="lg" /></div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{creator.name}</h1>
            <p className="text-sm text-ink-muted">@{creator.handle}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Badge tone="lavender">{label(creator.niche)}</Badge>
              <Badge icon={PLATFORM_ICON[creator.primaryPlatform]}>{PLATFORM_LABEL[creator.primaryPlatform]}</Badge>
              {creator.verificationStatus === "verified" ? <Badge tone="green" icon="shield">Profile verified {creator.dateVerified}</Badge> : <Badge tone="amber" icon="alert">Needs manual verification</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {match && (
              <div className="flex items-center gap-3 rounded-2xl bg-subtle/70 py-2 pl-2 pr-4">
                <ScoreRing score={match.score} tier={match.tier} size={60} />
                <div className="leading-tight"><p className="text-sm font-semibold">{match.tier} fit</p><p className="text-xs text-ink-muted">{match.coverage.percent}% coverage</p></div>
              </div>
            )}
            <a href={creator.profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-medium shadow-[var(--shadow-card)] transition hover:border-lavender-300 hover:bg-lavender-50">
              Open profile <Icon name="external" />
            </a>
            {campaignId && <ButtonLink to={`/outreach/new?campaign=${campaignId}&creator=${creator.id}`} icon="sparkles">Generate outreach</ButtonLink>}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="About" icon="info" />
            <div className="p-5 sm:p-6">
              <p className="leading-relaxed text-ink-muted">{creator.description ?? NA}</p>
              <h3 className="mb-2 mt-5 text-sm font-medium">Content specialties</h3>
              <div className="flex flex-wrap gap-1.5">
                {creator.tags.map((t) => {
                  const hit = match?.matchedKeywords.some((m) => m.creatorTerm === t);
                  return <Badge key={t} tone={hit ? "lavender" : "neutral"} icon={hit ? "check" : undefined}>{t}</Badge>;
                })}
              </div>
              {match && match.matchedKeywords.length > 0 && <p className="mt-2 text-xs text-ink-faint">Highlighted specialties matched topics in the campaign brief.</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Match breakdown" icon="target"
              description={campaign ? `Scored against ${campaign.brandName} — ${campaign.product}` : "Choose a campaign to see how this creator scores"}
              action={
                <select aria-label="Score against campaign" value={campaignId ?? ""} onChange={(e) => setParams(e.target.value ? { campaign: e.target.value } : {})}
                  className="h-9 max-w-[45%] rounded-lg border border-line bg-white px-2 text-sm">
                  <option value="">{campaigns.length ? "Select campaign…" : "No campaigns yet"}</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.brandName}</option>)}
                </select>
              } />
            <div className="p-5 sm:p-6">
              {!campaignId && (
                campaigns.length
                  ? <p className="text-sm text-ink-muted">Pick a campaign above to calculate the compatibility score.</p>
                  : <p className="text-sm text-ink-muted">Create a campaign first. <Link to="/campaigns/new" className="font-medium text-lavender-600 hover:underline">New campaign →</Link></p>
              )}
              {campaignId && matchQ.loading && <div className="space-y-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
              {campaignId && matchQ.error && <ErrorBanner message={matchQ.error.message} onRetry={matchQ.reload} />}
              {match && <Breakdown match={match} />}
            </div>
          </Card>

          {match && campaignId && <AiSummary campaignId={campaignId} creatorId={creator.id} />}
        </div>

        <div className="space-y-6">
          <Limitations creator={creator} match={match} />

          <Card>
            <CardHeader title="Verified sources" icon="link" />
            <div className="p-5">
              <dl className="mb-4 space-y-2 text-sm">
                <Row term="Profile"><a href={creator.profileUrl} target="_blank" rel="noopener noreferrer" className="break-all text-lavender-600 hover:underline">{pretty(creator.profileUrl)}</a></Row>
                <Row term="Last verified">{creator.dateVerified}</Row>
              </dl>
              <ol className="space-y-2 text-sm">
                {creator.sourceUrls.map((u, i) => (
                  <li key={u} className="flex gap-2">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-subtle text-[11px] font-medium text-ink-muted">{i + 1}</span>
                    <a href={u} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-lavender-600 hover:underline">{pretty(u)}</a>
                  </li>
                ))}
              </ol>
              {creator.verificationNote && <p className="mt-4 text-xs text-ink-faint">{creator.verificationNote}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Audience data" icon="creators" />
            <div className="p-5 text-sm">
              {creator.audienceMetrics.length ? (
                <ul className="space-y-3">
                  {creator.audienceMetrics.map((m) => (
                    <li key={m.label + m.asOf} className="flex items-baseline justify-between gap-3">
                      <span className="text-ink-muted">{m.label}<span className="block text-xs text-ink-faint">as of {m.asOf} · <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-lavender-600 hover:underline">source</a></span></span>
                      <span className="font-semibold tabular-nums">{m.value.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              ) : <p>{NA}<span className="mt-1 block text-xs text-ink-faint">No figure with both a public source and a date was found.</span></p>}
              <p className="mt-4 text-xs text-ink-faint">Historical snapshots, not live counts. Engagement, demographics and pricing are not stored.</p>
            </div>
          </Card>
        </div>
      </div>

      <DatasetDisclaimer className="mt-8" />
    </>
  );
}

function Breakdown({ match }: { match: MatchResult }) {
  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-lavender-50 px-4 py-3 text-sm leading-relaxed">{match.explanation}</p>
      {match.components.map((c) => (
        <div key={c.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{c.label} <span className="font-normal text-ink-faint">· weight {c.weight}</span></span>
            <span className={cx("tabular-nums", c.status === "scored" ? "font-medium" : "text-ink-faint")}>
              {c.status === "scored" ? `${c.points} / ${c.weight}` : c.status === "unknown" ? "Unknown — excluded" : "Not applicable — excluded"}
            </span>
          </div>
          {c.status === "scored"
            ? <div className="h-2 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-lavender-500 transition-[width] duration-700" style={{ width: `${(c.value ?? 0) * 100}%` }} /></div>
            : <div className="h-2 rounded-full border border-dashed border-line" aria-hidden="true" />}
          <p className="mt-1.5 text-sm text-ink-muted">{c.explanation}</p>
        </div>
      ))}
      <div className="rounded-xl border border-line p-4 text-sm">
        <div className="flex justify-between text-ink-muted"><span>Points from measured components</span><span className="tabular-nums">{match.coverage.earnedPoints} / {match.coverage.availablePoints}</span></div>
        <div className="mt-1 flex justify-between text-ink-muted"><span>Scoring coverage</span><span className="tabular-nums">{match.coverage.percent}%</span></div>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3"><span className="font-semibold">Compatibility score</span><span className="text-xl font-semibold tabular-nums">{match.score}<span className="text-sm text-ink-faint">/100</span></span></div>
        <p className="mt-1 text-xs text-ink-faint">{match.coverage.earnedPoints} ÷ {match.coverage.availablePoints} × 100 = {match.score}</p>
      </div>
      {match.matchedKeywords.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Matched topics</h3>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-subtle text-xs text-ink-faint"><tr><th className="px-3 py-2 font-medium">Brief said</th><th className="px-3 py-2 font-medium">Creator covers</th><th className="px-3 py-2 font-medium">Match</th><th className="px-3 py-2 text-right font-medium">Weight</th></tr></thead>
              <tbody className="divide-y divide-line">
                {match.matchedKeywords.map((m) => (
                  <tr key={m.topic}>
                    <td className="px-3 py-2">{m.campaignTerms.join(", ")}</td>
                    <td className="px-3 py-2 text-ink-muted">{m.creatorTerm}</td>
                    <td className="px-3 py-2"><Badge tone={m.relation === "exact" ? "lavender" : "neutral"}>{m.relation === "exact" ? m.topic : `≈ ${m.topic}`}</Badge></td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{m.importance}{m.relation === "related" ? " × ½" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ScoreDisclaimer />
    </div>
  );
}

function Limitations({ creator, match }: { creator: Creator; match: MatchResult | null }) {
  const items: { icon: IconName; tone: string; node: ReactNode }[] = [];
  for (const c of match?.conflicts ?? []) {
    items.push({ icon: "alert", tone: "bg-amber-50 text-amber-900", node: <><b className="font-medium">Conflict flag:</b> {c.message} <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">Source</a><span className="mt-0.5 block text-xs opacity-80">Doesn't change the score.</span></> });
  }
  if (creator.considerations) items.push({ icon: "info", tone: "bg-subtle text-ink-muted", node: creator.considerations });
  if (creator.ownedBrands.length) {
    items.push({ icon: "link", tone: "bg-subtle text-ink-muted", node: <><b className="font-medium text-ink">Owned brands:</b> {creator.ownedBrands.map((b, i) => <span key={b.name}>{i > 0 && ", "}<a href={b.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-lavender-600 hover:underline">{b.name}</a></span>)}</> });
  }
  const warnings = match?.warnings ?? [
    "No verified audience demographics — audience relevance can't be scored.",
    ...(creator.audienceMetrics.length ? [] : ["No dated audience-size figures are available."]),
  ];
  for (const w of warnings) items.push({ icon: "database", tone: "bg-subtle text-ink-muted", node: w });

  return (
    <Card>
      <CardHeader title="Limitations & considerations" icon="alert" />
      <ul className="space-y-2 p-4">
        {items.map((it, i) => (
          <li key={i} className={cx("flex gap-2.5 rounded-xl px-3 py-2.5 text-sm leading-relaxed", it.tone)}>
            <Icon name={it.icon} className="mt-0.5 size-4 shrink-0 opacity-70" /><span className="min-w-0">{it.node}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** "Explain with Claude": rewrites the calculated result in plain English. Never changes the numbers. */
function AiSummary({ campaignId, creatorId }: { campaignId: number; creatorId: number }) {
  const [state, setState] = useState<{ kind: "idle" } | { kind: "loading" } | { kind: "done"; text: string; model: string } | { kind: "error"; error: ApiError }>({ kind: "idle" });
  async function run() {
    setState({ kind: "loading" });
    try {
      const r = await api.explainMatch(campaignId, creatorId);
      setState({ kind: "done", text: r.explanation, model: r.model });
    } catch (err) {
      setState({ kind: "error", error: err instanceof ApiError ? err : new ApiError(0, (err as Error).message) });
    }
  }
  return (
    <Card>
      <CardHeader title="Plain-English summary" icon="sparkles" description="Claude rewrites the calculated breakdown. Any summary containing a number that isn't in the results is rejected." />
      <div className="p-5 sm:p-6">
        {state.kind === "loading" && <div className="space-y-2" aria-busy="true"><Skeleton className="h-4" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-3/4" /></div>}
        {state.kind === "done" && (
          <div className="rounded-xl border border-line bg-subtle/50 px-4 py-3 text-sm leading-relaxed">
            <p>{state.text}</p>
            <p className="mt-2 text-xs text-ink-faint">Written by {state.model} from the calculated results. The score itself was not produced by AI.</p>
          </div>
        )}
        {state.kind === "error" && <ErrorBanner message={state.error.message} details={state.error.details} />}
        {state.kind !== "loading" && (
          <Button variant="secondary" icon="sparkles" onClick={run} className="mt-4">{state.kind === "done" ? "Rewrite again" : "Explain with Claude"}</Button>
        )}
      </div>
    </Card>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return <div className="flex justify-between gap-4"><dt className="shrink-0 text-ink-muted">{term}</dt><dd className="min-w-0 text-right">{children}</dd></div>;
}

function DetailsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading creator">
      <Skeleton className="mb-6 h-4 w-28" />
      <Card className="mb-6 p-6"><div className="flex gap-4"><Skeleton className="size-16 rounded-2xl" /><div className="flex-1 space-y-2"><Skeleton className="h-6 w-56" /><Skeleton className="h-4 w-32" /><Skeleton className="h-5 w-64" /></div></div></Card>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]"><Card className="space-y-3 p-6"><Skeleton className="h-4" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-24" /></Card><Card className="space-y-3 p-6"><Skeleton className="h-4" /><Skeleton className="h-16" /></Card></div>
    </div>
  );
}
