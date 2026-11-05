import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ApiError, api } from "../api/client";
import { copyText } from "../components/clipboard";
import { CreatorAvatar, PLATFORM_LABEL } from "../components/CreatorAvatar";
import { Icon } from "../components/Icon";
import { ScoreRing } from "../components/ScoreRing";
import { useToast } from "../components/Toast";
import { Badge, Button, ButtonLink, Card, CardHeader, ErrorBanner, PageHeader, Skeleton, Spinner, cx } from "../components/ui";
import { useAsync } from "../components/useAsync";
import { label, type Campaign, type Creator, type Draft, type MatchResult } from "../types";

/** How many generate/regenerate clicks per visit (each click may make up to 2 Claude calls on the server). */
export const MAX_USER_ATTEMPTS = 3;

const HINTS: Record<string, string> = {
  schema: "The AI's reply didn't have the expected structure. This is usually a one-off; trying again normally works.",
  invalid_json: "The AI's reply couldn't be read. Trying again normally works.",
  guardrail: "The draft mentioned something we can't verify (contact details, statistics, payment amounts or prior contact), so it was discarded rather than shown.",
  truncated: "The AI ran out of space before finishing. Trying again normally works.",
  refusal: "The AI declined this request. Try rewording the campaign description.",
  auth: "Check that ANTHROPIC_API_KEY in your .env file is correct, then restart the server.",
  model_not_found: "Set ANTHROPIC_MODEL in .env to a current Claude model (e.g. claude-opus-5-5) and restart the server.",
  local_rate_limit: "You've made a lot of AI requests in the last minute. Wait a moment before trying again.",
  rate_limited: "The AI service is busy. Wait a moment before trying again.",
  connection: "Check your internet connection, then try again.",
};

interface EditorState {
  subject: string;
  body: string;
  note: string | null;
  ai: boolean;
  model: string | null;
  serverAttempts?: number;
}

/**
 * AI Outreach Studio.
 *  /outreach/new?campaign=1&creator=5  → generate a new draft for a creator
 *  /outreach/12                        → edit saved draft #12
 */
export function OutreachStudioPage() {
  const { draftId } = useParams();
  const [params] = useSearchParams();
  const editing = draftId ? Number(draftId) : null;

  const ctx = useAsync(async () => {
    const draft = editing ? await api.getDraft(editing) : null;
    const campaignId = draft?.campaignId ?? Number(params.get("campaign"));
    const creatorId = draft?.creatorId ?? Number(params.get("creator"));
    if (!campaignId || !creatorId) throw new Error("Choose a creator from a campaign to start a draft.");
    const { campaign, creator, match } = await api.getMatch(campaignId, creatorId);
    return { draft, campaign, creator, match };
  }, [editing, params.get("campaign"), params.get("creator")]);

  if (ctx.error) {
    return (
      <>
        <PageHeader eyebrow="Outreach studio" title="Outreach studio" back={{ to: "/outreach", label: "Outreach" }} />
        <ErrorBanner message={ctx.error.message} onRetry={ctx.reload} />
        <ButtonLink to="/campaigns" variant="secondary" className="mt-4">Go to campaigns</ButtonLink>
      </>
    );
  }
  if (ctx.loading || !ctx.data) return <StudioSkeleton />;
  return <Studio key={`${editing}-${ctx.data.creator.id}`} {...ctx.data} />;
}

function Studio({ draft: initialDraft, campaign, creator, match }: { draft: Draft | null; campaign: Campaign; creator: Creator; match: MatchResult }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [editor, setEditor] = useState<EditorState | null>(
    initialDraft ? { subject: initialDraft.subject, body: initialDraft.body, note: initialDraft.personalizationNote, ai: initialDraft.aiGenerated, model: initialDraft.aiModel } : null,
  );
  const [saved, setSaved] = useState<Draft | null>(initialDraft);
  const [reviewed, setReviewed] = useState(initialDraft?.reviewed ?? false);
  const [genState, setGenState] = useState<{ kind: "idle" } | { kind: "loading" } | { kind: "error"; error: ApiError }>({ kind: "idle" });
  const [attempts, setAttempts] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const dirty = editor !== null && (!saved || saved.subject !== editor.subject || saved.body !== editor.body || saved.reviewed !== reviewed);
  const empty = !editor || !editor.subject.trim() || !editor.body.trim();
  const attemptsLeft = MAX_USER_ATTEMPTS - attempts;
  const words = editor ? editor.body.trim().split(/\s+/).filter(Boolean).length : 0;

  useEffect(() => {
    if (genState.kind !== "loading") return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [genState.kind]);

  async function generate() {
    if (inFlight.current || attemptsLeft <= 0) return;
    if (editor && dirty && !window.confirm("Replace your current text with a new AI draft?")) return;
    inFlight.current = true;
    setAttempts((n) => n + 1);
    setGenState({ kind: "loading" });
    try {
      const email = await api.generateOutreach(campaign.id, creator.id);
      setEditor({ subject: email.subject, body: email.body, note: email.personalizationNote, ai: true, model: email.model, serverAttempts: email.attempts });
      setReviewed(false);
      setGenState({ kind: "idle" });
      toast("Draft generated — review it before use", "info");
    } catch (err) {
      setGenState({ kind: "error", error: err instanceof ApiError ? err : new ApiError(0, (err as Error).message) });
    } finally {
      inFlight.current = false;
    }
  }

  function startBlank() {
    setEditor({ subject: `Partnership idea: ${campaign.brandName} x ${creator.name}`, body: `Hi ${creator.name},\n\n\n\nBest,\n[Your name]\n[Your role], ${campaign.brandName}`, note: null, ai: false, model: null });
    setGenState({ kind: "idle" });
  }

  function edit(field: "subject" | "body", value: string) {
    setEditor((e) => (e ? { ...e, [field]: value } : e));
    if (reviewed) setReviewed(false); // any change after review needs a fresh review
  }

  async function save() {
    if (!editor) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = saved
        ? await api.updateDraft(saved.id, { subject: editor.subject, body: editor.body, reviewed })
        : await api.createDraft({ campaignId: campaign.id, creatorId: creator.id, subject: editor.subject, body: editor.body, personalizationNote: editor.note, aiGenerated: editor.ai, aiModel: editor.model, reviewed });
      setSaved(result);
      toast(saved ? "Changes saved" : "Draft saved to your outreach drafts");
      if (!saved) navigate(`/outreach/${result.id}`, { replace: true });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save the draft");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!editor) return;
    try {
      await copyText(`Subject: ${editor.subject}\n\n${editor.body}`);
      toast("Email copied to clipboard");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  const notConfigured = genState.kind === "error" && genState.error.status === 503 && /ANTHROPIC_API_KEY/.test(genState.error.message);

  return (
    <>
      <PageHeader
        back={{ to: saved ? "/outreach" : `/campaigns/${campaign.id}`, label: saved ? "Outreach drafts" : `${campaign.brandName} matches` }}
        eyebrow={<span className="inline-flex items-center gap-1.5"><Icon name="sparkles" className="size-3.5" />AI outreach studio</span>}
        title={`Outreach to ${creator.name}`}
        description={`${campaign.brandName} · ${campaign.product} · ${label(campaign.goal)}`}
        actions={saved && <Badge tone={saved.reviewed && !dirty ? "green" : "amber"} icon={saved.reviewed && !dirty ? "checkCircle" : "edit"} className="h-8 px-3 text-sm">{saved.reviewed && !dirty ? "Reviewed & saved" : dirty ? "Unsaved changes" : "Saved · needs review"}</Badge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ------------------------------------------------ editor column */}
        <div className="min-w-0 space-y-4">
          {!editor && genState.kind !== "loading" && (
            <Card className="p-6 sm:p-8">
              <div className="mx-auto max-w-md text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-lavender-100 text-lavender-600"><Icon name="sparkles" className="size-6" /></span>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">Draft a personalised email</h2>
                <p className="mt-1.5 text-sm text-ink-muted">
                  Claude writes a first draft from your campaign brief and {creator.name}'s <b className="font-medium text-ink">verified</b> profile only. Every reply is checked for invented contacts, statistics, payments or prior contact before you see it.
                </p>
                {genState.kind === "error" && (
                  <div className="mt-5 text-left">
                    <ErrorBanner message={genState.error.message} details={genState.error.details}
                      hint={notConfigured ? <>Add <code className="rounded bg-white px-1">ANTHROPIC_API_KEY</code> to the <code className="rounded bg-white px-1">.env</code> file in the project root, then restart <code className="rounded bg-white px-1">npm run dev</code>.</> : genState.error.code && HINTS[genState.error.code]} />
                  </div>
                )}
                <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                  {!notConfigured && (
                    <Button variant="accent" size="lg" icon={genState.kind === "error" ? "refresh" : "sparkles"} onClick={generate} disabled={attemptsLeft <= 0 || (genState.kind === "error" && !genState.error.retryable)}>
                      {genState.kind === "error" ? `Try again (${attemptsLeft} left)` : "Generate with Claude"}
                    </Button>
                  )}
                  <Button variant="secondary" size="lg" icon="edit" onClick={startBlank}>Write it myself</Button>
                </div>
                {attemptsLeft <= 0 && <p className="mt-3 text-xs text-ink-muted">Retry limit reached for this visit. Write it yourself or come back later.</p>}
              </div>
            </Card>
          )}

          {genState.kind === "loading" && (
            <Card className="p-6" aria-busy="true">
              <div className="mb-5 flex items-center gap-3 text-sm font-medium" role="status" aria-live="polite">
                <Spinner className="size-4 text-lavender-600" /> Claude is drafting a personalised email… <span className="tabular-nums text-ink-faint">{elapsed}s</span>
              </div>
              <Skeleton className="h-10" /><Skeleton className="mt-4 h-4 w-11/12" /><Skeleton className="mt-2 h-4 w-10/12" /><Skeleton className="mt-2 h-4 w-9/12" /><Skeleton className="mt-6 h-4 w-8/12" /><Skeleton className="mt-2 h-4 w-10/12" />
              <p className="mt-5 text-xs text-ink-faint">Using verified creator information only. If a reply fails our checks, we automatically ask once more.</p>
            </Card>
          )}

          {editor && genState.kind !== "loading" && (
            <>
              {editor.ai && (
                <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm" role="note">
                  <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-amber-700" />
                  <div className="text-amber-900">
                    <p className="font-semibold">AI-generated draft — requires human review before use</p>
                    <p className="mt-0.5 text-amber-900/80">Written by {editor.model}{editor.serverAttempts && editor.serverAttempts > 1 ? ` (after ${editor.serverAttempts} attempts)` : ""}. Check every statement about the creator. Nothing is sent automatically.</p>
                  </div>
                </div>
              )}
              {genState.kind === "error" && <ErrorBanner message={genState.error.message} details={genState.error.details} hint={genState.error.code && HINTS[genState.error.code]} />}

              <Card className="overflow-hidden">
                <div className="flex items-center gap-3 border-b border-line bg-subtle/50 px-5 py-2.5 text-xs text-ink-muted">
                  <span className="font-medium text-ink">To:</span>
                  <span className="truncate">{creator.name} — contact via their verified profile or management (no email address is stored)</span>
                </div>
                <label htmlFor="draft-subject" className="sr-only">Subject</label>
                <input id="draft-subject" value={editor.subject} onChange={(e) => edit("subject", e.target.value)} maxLength={200} placeholder="Subject"
                  className="w-full border-b border-line px-5 py-4 text-base font-semibold tracking-tight outline-none placeholder:text-ink-faint focus:bg-lavender-50/30" />
                <label htmlFor="draft-body" className="sr-only">Email body</label>
                <textarea id="draft-body" value={editor.body} onChange={(e) => edit("body", e.target.value)} rows={16} maxLength={6000}
                  className="block w-full resize-y px-5 py-4 text-[15px] leading-relaxed outline-none focus:bg-lavender-50/30" />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-2.5 text-xs text-ink-faint">
                  <span>{words} words · {editor.ai ? "AI draft, edited by you" : "Written manually"}</span>
                  {editor.ai && attemptsLeft > 0 && <button onClick={generate} className="inline-flex items-center gap-1 font-medium text-lavender-600 hover:underline"><Icon name="refresh" className="size-3" />Regenerate ({attemptsLeft} left)</button>}
                  {editor.ai && attemptsLeft <= 0 && <span>Regeneration limit reached</span>}
                </div>
              </Card>
            </>
          )}
        </div>

        {/* ------------------------------------------------- side panel */}
        <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <CreatorAvatar name={creator.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold tracking-tight">{creator.name}</p>
                <p className="truncate text-xs text-ink-muted">{label(creator.niche)} · {PLATFORM_LABEL[creator.primaryPlatform]}</p>
              </div>
              <ScoreRing score={match.score} tier={match.tier} size={44} />
            </div>
            <Link to={`/creators/${creator.id}?campaign=${campaign.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-lavender-600 hover:underline">View profile & match breakdown <Icon name="arrowRight" className="size-3" /></Link>
            {match.conflicts.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">⚠ {match.conflicts[0].message}</p>}
          </Card>

          {editor?.note && (
            <Card>
              <CardHeader title="Why it's personalised" icon="sparkles" />
              <p className="px-5 py-4 text-sm leading-relaxed text-ink-muted">{editor.note}</p>
            </Card>
          )}

          <Card className="p-4">
            <label className={cx("flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition", !editor && "pointer-events-none opacity-50", reviewed ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/60")}>
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-lavender-600)]" checked={reviewed} disabled={!editor} onChange={(e) => setReviewed(e.target.checked)} />
              <span><span className="font-medium">I've reviewed this email for accuracy.</span> <span className="text-ink-muted">Check every claim and add the sender details.</span></span>
            </label>
            {saveError && <div className="mt-3"><ErrorBanner message={saveError} /></div>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" icon="save" onClick={save} loading={saving} disabled={empty || !dirty}>{saved ? "Save" : "Save draft"}</Button>
              <Button icon="copy" onClick={copy} disabled={!reviewed || empty} title={reviewed ? undefined : "Review the email first"}>Copy</Button>
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-faint">Copy unlocks after review. CreatorMatch never sends emails.</p>
          </Card>
        </div>
      </div>
    </>
  );
}

function StudioSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading outreach studio">
      <Skeleton className="h-4 w-32" /><Skeleton className="mt-4 h-8 w-72" /><Skeleton className="mt-2 h-4 w-60" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]"><Card className="p-6"><Skeleton className="h-64" /></Card><Card className="p-4"><Skeleton className="h-24" /></Card></div>
    </div>
  );
}
