import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ApiError, api } from "../api/client";
import { Icon, PLATFORM_ICON, type IconName } from "../components/Icon";
import { useToast } from "../components/Toast";
import { Button, Card, ErrorBanner, PageHeader, cx } from "../components/ui";
import { CURRENCIES, GOALS, INDUSTRIES, PLATFORMS, label, type CampaignInput } from "../types";

/** Form state keeps numbers as strings so inputs can be empty while typing. */
export interface FormState {
  brandName: string; product: string; industry: string; description: string; targetAudience: string;
  ageMin: string; ageMax: string; platforms: string[]; budget: string; currency: string; goal: string;
}

export const EMPTY: FormState = {
  brandName: "", product: "", industry: "", description: "", targetAudience: "",
  ageMin: "18", ageMax: "34", platforms: [], budget: "", currency: "GBP", goal: "",
};

/** A realistic example so the demo can be filled in one click. Fictional brand. */
export const EXAMPLE: FormState = {
  brandName: "Glow Lab",
  product: "Vitamin C brightening serum",
  industry: "skincare",
  description: "We're launching a fragrance-free vitamin C serum made for sensitive skin. We want creators who give honest skincare product reviews and explain ingredients clearly, rather than hype.",
  targetAudience: "Skincare enthusiasts with sensitive skin who research ingredients",
  ageMin: "18", ageMax: "34", platforms: ["youtube", "tiktok"], budget: "5000", currency: "GBP", goal: "product_launch",
};

type Errors = Partial<Record<keyof FormState, string>>;

/** Client-side checks mirror the server's zod rules for instant feedback. The server still validates everything. */
export function validate(f: FormState): Errors {
  const e: Errors = {};
  const len = (s: string) => s.trim().length;
  if (len(f.brandName) < 2) e.brandName = "Brand name must be at least 2 characters";
  if (len(f.product) < 2) e.product = "Tell us what you're promoting";
  if (!f.industry) e.industry = "Choose an industry";
  if (len(f.description) < 20) e.description = "Describe the campaign in at least 20 characters";
  if (len(f.targetAudience) < 5) e.targetAudience = "Describe your target audience";
  const min = Number(f.ageMin), max = Number(f.ageMax);
  if (!Number.isInteger(min) || min < 13 || min > 100) e.ageMin = "Minimum age must be 13–100";
  if (!Number.isInteger(max) || max < 13 || max > 100) e.ageMax = "Maximum age must be 13–100";
  else if (!e.ageMin && min > max) e.ageMax = "Must be at least the minimum age";
  if (f.platforms.length === 0) e.platforms = "Select at least one platform";
  if (!(Number(f.budget) > 0)) e.budget = "Enter a budget greater than 0";
  if (!f.goal) e.goal = "Choose a campaign goal";
  return e;
}

const SECTIONS: { title: string; fields: (keyof FormState)[] }[] = [
  { title: "Brand & product", fields: ["brandName", "product", "industry"] },
  { title: "Campaign brief", fields: ["description", "goal"] },
  { title: "Audience & channels", fields: ["targetAudience", "ageMin", "ageMax", "platforms"] },
  { title: "Budget", fields: ["budget"] },
];

export function CampaignBuilderPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const togglePlatform = (p: string) => set("platforms", form.platforms.includes(p) ? form.platforms.filter((x) => x !== p) : [...form.platforms, p]);
  const sectionDone = (fields: (keyof FormState)[]) => fields.every((f) => !validate(form)[f]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = document.getElementById(`field-${Object.keys(found)[0]}`);
      first?.focus();
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setSaving(true);
    try {
      const input: CampaignInput = {
        ...form,
        industry: form.industry as CampaignInput["industry"],
        platforms: form.platforms as CampaignInput["platforms"],
        currency: form.currency as CampaignInput["currency"],
        goal: form.goal as CampaignInput["goal"],
        ageMin: Number(form.ageMin), ageMax: Number(form.ageMax), budget: Number(form.budget),
      };
      const campaign = await api.createCampaign(input);
      toast(`Campaign "${campaign.brandName}" saved — creators ranked`);
      navigate(`/campaigns/${campaign.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length) {
        setErrors(Object.fromEntries(err.fieldErrors.map((fe) => [fe.field.split(".")[0], fe.message])));
      }
      setSubmitError(err instanceof Error ? err.message : "Could not save the campaign");
    } finally {
      setSaving(false);
    }
  }

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <>
      <PageHeader eyebrow="Campaign builder" title="Create a campaign brief"
        description="Describe the brand and what you're looking for. We'll rank every creator in the database and explain each score."
        back={{ to: "/campaigns", label: "Campaigns" }}
        actions={<Button variant="secondary" icon="wand" type="button" onClick={() => (setForm(EXAMPLE), setErrors({}), setSubmitError(null))}>Fill with example</Button>} />

      <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <Section n={1} icon="campaign" title="Brand & product" subtitle="Who is running this campaign, and what are they promoting?">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="brandName" label="Brand name" error={errors.brandName}>
                <input id="field-brandName" className={inputClass(errors.brandName)} value={form.brandName} onChange={(e) => set("brandName", e.target.value)} placeholder="e.g. Glow Lab" maxLength={80} />
              </Field>
              <Field id="product" label="Product or service" error={errors.product}>
                <input id="field-product" className={inputClass(errors.product)} value={form.product} onChange={(e) => set("product", e.target.value)} placeholder="e.g. Vitamin C serum" maxLength={120} />
              </Field>
            </div>
            <Field id="industry" label="Industry" error={errors.industry}>
              <ChipGroup id="field-industry" options={INDUSTRIES} selected={[form.industry]} onToggle={(v) => set("industry", v)} />
            </Field>
          </Section>

          <Section n={2} icon="edit" title="Campaign brief" subtitle="Specific words (e.g. “acne”, “running”, “laptop”) improve keyword matching.">
            <Field id="description" label="Campaign description" error={errors.description} hint={`${form.description.trim().length}/1500`}>
              <textarea id="field-description" rows={5} className={inputClass(errors.description)} value={form.description} onChange={(e) => set("description", e.target.value)}
                placeholder="What are you launching, and what kind of content are you looking for?" maxLength={1500} />
            </Field>
            <Field id="goal" label="Campaign goal" error={errors.goal}>
              <ChipGroup id="field-goal" options={GOALS} selected={[form.goal]} onToggle={(v) => set("goal", v)} />
            </Field>
          </Section>

          <Section n={3} icon="creators" title="Audience & channels">
            <Field id="targetAudience" label="Target audience" error={errors.targetAudience}>
              <input id="field-targetAudience" className={inputClass(errors.targetAudience)} value={form.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} placeholder="e.g. Skincare enthusiasts with sensitive skin" maxLength={300} />
            </Field>
            <div className="grid grid-cols-2 gap-5 sm:max-w-sm">
              <Field id="ageMin" label="Minimum age" error={errors.ageMin}>
                <input id="field-ageMin" type="number" inputMode="numeric" min={13} max={100} className={inputClass(errors.ageMin)} value={form.ageMin} onChange={(e) => set("ageMin", e.target.value)} />
              </Field>
              <Field id="ageMax" label="Maximum age" error={errors.ageMax}>
                <input id="field-ageMax" type="number" inputMode="numeric" min={13} max={100} className={inputClass(errors.ageMax)} value={form.ageMax} onChange={(e) => set("ageMax", e.target.value)} />
              </Field>
            </div>
            <Field id="platforms" label="Preferred platforms" error={errors.platforms} hint="Select all that apply">
              <ChipGroup id="field-platforms" multiple options={PLATFORMS} selected={form.platforms} onToggle={togglePlatform} icons={PLATFORM_ICON} />
            </Field>
          </Section>

          <Section n={4} icon="save" title="Budget">
            <Field id="budget" label="Campaign budget" error={errors.budget}>
              <div className="flex gap-2 sm:max-w-sm">
                <select aria-label="Currency" className={inputClass(undefined, "w-24 shrink-0")} value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <input id="field-budget" type="number" inputMode="decimal" min={1} className={inputClass(errors.budget, "min-w-0 flex-1")} value={form.budget} onChange={(e) => set("budget", e.target.value)} placeholder="5000" />
              </div>
            </Field>
            <p className="text-xs leading-relaxed text-ink-faint">Stored with the campaign for your records. It isn't used in scoring or sent to the AI, because verified creator rates aren't available.</p>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Brief checklist</h2>
            <ul className="mt-3 space-y-2">
              {SECTIONS.map((s) => {
                const done = sectionDone(s.fields);
                return (
                  <li key={s.title} className="flex items-center gap-2.5 text-sm">
                    <span className={cx("grid size-5 place-items-center rounded-full transition", done ? "bg-emerald-500 text-white" : "bg-subtle ring-1 ring-line")}>
                      {done && <Icon name="check" className="size-3" strokeWidth={2.5} />}
                    </span>
                    <span className={done ? "text-ink" : "text-ink-muted"}>{s.title}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 space-y-3">
              {submitError && <ErrorBanner message={submitError} />}
              {!submitError && errorCount > 0 && <p className="text-xs font-medium text-red-600" role="alert">Fix {errorCount} field{errorCount === 1 ? "" : "s"} to continue.</p>}
              <Button type="submit" variant="accent" size="lg" icon="search" loading={saving} className="w-full">
                {saving ? "Finding creators…" : "Find creators"}
              </Button>
              <p className="text-center text-xs text-ink-faint">Saves the brief and ranks all creators instantly.</p>
            </div>
          </Card>
        </aside>
      </form>
    </>
  );
}

// ---------------------------------------------------------------- pieces ---

function inputClass(error?: string, width = "w-full") {
  return cx(
    width,
    "rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink shadow-[var(--shadow-card)] outline-none transition placeholder:text-ink-faint",
    "focus:border-lavender-500 focus:ring-4 focus:ring-lavender-100",
    error ? "border-red-300 bg-red-50/30" : "border-line hover:border-lavender-200",
  );
}

function Section({ n, icon, title, subtitle, children }: { n: number; icon: IconName; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card as="section" className="p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lavender-50 text-lavender-600"><Icon name={icon} /></span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Step {n}</p>
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </Card>
  );
}

function Field({ id, label: text, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={`field-${id}`} className="text-sm font-medium">{text}</label>
        {hint && <span className="text-xs text-ink-faint">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600" role="alert"><Icon name="alert" className="size-3" />{error}</p>}
    </div>
  );
}

function ChipGroup({ id, options, selected, onToggle, multiple = false, icons }: { id: string; options: readonly string[]; selected: string[]; onToggle: (v: string) => void; multiple?: boolean; icons?: Record<string, IconName> }) {
  return (
    <div id={id} tabIndex={-1} role={multiple ? "group" : "radiogroup"} className="flex flex-wrap gap-2 outline-none">
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <button key={o} type="button" role={multiple ? "checkbox" : "radio"} aria-checked={active} onClick={() => onToggle(o)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition duration-150 active:scale-[0.97]",
              active ? "border-lavender-500 bg-lavender-600 text-white shadow-sm shadow-lavender-600/20" : "border-line bg-white text-ink-muted hover:border-lavender-300 hover:text-ink",
            )}>
            {icons?.[o] && <Icon name={icons[o]} className="size-3.5" />}
            {active && multiple && !icons && <Icon name="check" className="size-3.5" />}
            {label(o)}
          </button>
        );
      })}
    </div>
  );
}
