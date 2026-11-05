import { Link } from "react-router";
import type { RankedCreator } from "../types";
import { label } from "../types";
import { CreatorAvatar, PLATFORM_LABEL } from "./CreatorAvatar";
import { Icon, PLATFORM_ICON } from "./Icon";
import { ScoreRing } from "./ScoreRing";
import { Badge, ButtonLink, Card } from "./ui";

/** One-sentence match explanation built from the calculated components. */
export function shortExplanation({ creator, match }: RankedCreator): string {
  const niche = match.components.find((c) => c.key === "niche")!;
  const platform = match.components.find((c) => c.key === "platform")!;
  const exact = match.matchedKeywords.filter((m) => m.relation === "exact").length;
  const parts = [
    niche.value === 1 ? `Creates ${label(creator.niche).toLowerCase()} content` : niche.value ? `Related category (${label(creator.niche).toLowerCase()})` : `Different category (${label(creator.niche).toLowerCase()})`,
    match.matchedKeywords.length ? `covers ${match.matchedKeywords.length} brief topic${match.matchedKeywords.length === 1 ? "" : "s"}${exact ? ` (${exact} exact)` : ""}` : "no brief topics covered",
    platform.value ? `active on ${PLATFORM_LABEL[creator.primaryPlatform]}` : `${PLATFORM_LABEL[creator.primaryPlatform]} not selected`,
  ];
  return parts.join(" · ");
}

export function CreatorCard({ item, rank, campaignId }: { item: RankedCreator; rank: number; campaignId: number }) {
  const { creator, match } = item;
  const topics = match.matchedKeywords.filter((m) => m.relation === "exact").slice(0, 3);

  return (
    <Card as="article" className="group flex min-w-0 flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:border-lavender-200 hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-start gap-3">
        <CreatorAvatar name={creator.name} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tabular-nums text-ink-faint">#{rank}</p>
          <h3 className="font-semibold leading-snug tracking-tight">{creator.name}</h3>
          <a href={creator.profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs text-ink-muted hover:text-lavender-600">
            @{creator.handle} <Icon name="external" className="size-3 shrink-0" />
          </a>
        </div>
        <div className="flex flex-col items-center">
          <ScoreRing score={match.score} tier={match.tier} size={52} />
          <span className="mt-1 text-[11px] font-medium text-ink-muted">{match.tier}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge tone="lavender">{label(creator.niche)}</Badge>
        <Badge icon={PLATFORM_ICON[creator.primaryPlatform]}>{PLATFORM_LABEL[creator.primaryPlatform]}</Badge>
        {match.conflicts.length > 0 && <Badge tone="amber" icon="alert">Conflict flag</Badge>}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{shortExplanation(item)}.</p>

      {topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {topics.map((m) => <span key={m.topic} className="inline-flex items-center gap-1 rounded-md bg-subtle px-2 py-0.5 text-xs text-ink-muted"><Icon name="check" className="size-3 text-lavender-600" />{m.topic}</span>)}
        </div>
      )}

      {match.conflicts.map((c) => (
        <p key={c.brand} className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">Owns {c.brand} ({c.matchedKeywords.join(", ")}). Shown for review; it doesn't change the score.</p>
      ))}

      <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
        <ButtonLink to={`/creators/${creator.id}?campaign=${campaignId}`} variant="secondary" size="sm">View profile</ButtonLink>
        <ButtonLink to={`/outreach/new?campaign=${campaignId}&creator=${creator.id}`} variant="primary" size="sm" icon="sparkles">Generate outreach</ButtonLink>
      </div>
      <p className="mt-2 text-center text-[10px] text-ink-faint">{match.coverage.percent}% scoring coverage</p>
    </Card>
  );
}

export function CreatorCardSkeleton({ Skeleton }: { Skeleton: (p: { className?: string }) => React.ReactElement }) {
  return (
    <Card className="p-5">
      <div className="flex gap-3"><Skeleton className="size-11 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div><Skeleton className="size-12 rounded-full" /></div>
      <Skeleton className="mt-5 h-5 w-40" /><Skeleton className="mt-3 h-10 w-full" /><div className="mt-5 grid grid-cols-2 gap-2"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
    </Card>
  );
}
