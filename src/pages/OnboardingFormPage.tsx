import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, ClipboardList, Sparkles, ArrowRight, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  groupFields,
  onboardingProgress,
  type OnboardingFormRow,
} from "@/lib/onboarding";
import { isFieldVisible, type FieldResponses } from "@/lib/form-fields";
import SmartFieldRenderer from "@/components/forms/SmartFieldRenderer";
import OnboardingProgressTracker from "@/components/onboarding/OnboardingProgressTracker";
import DynamicFavicon from "@/components/branding/DynamicFavicon";
import { calculateCommercialTotals, formatCents } from "@/lib/commercial-calc";

interface ProposalSummary {
  service_type?: string | null;
  client_name?: string | null;
  company_name?: string | null;
  amount_cents?: number | null;
  currency?: string | null;
  budget?: string | null;
  timeline?: string | null;
  tax_rate?: number | null;
  tax_mode?: string | null;
}

function hydrate(raw: Record<string, string> | undefined): FieldResponses {
  const out: FieldResponses = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    // Best-effort split for previously-stored multi-selects
    if (typeof v === "string" && v.includes(", ")) {
      out[k] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function serialize(r: FieldResponses): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (v == null) continue;
    if (Array.isArray(v)) out[k] = v.join(", ");
    else if (typeof v === "boolean") out[k] = v ? "yes" : "";
    else out[k] = String(v);
  }
  return out;
}

export default function OnboardingFormPage() {
  const { token } = useParams();
  const { toast } = useToast();
  const [form, setForm] = useState<OnboardingFormRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [responses, setResponses] = useState<FieldResponses>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmedAccurate, setConfirmedAccurate] = useState(false);
  const [proposalSummary, setProposalSummary] = useState<ProposalSummary | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data: rows, error } = (await supabase.rpc(
        "public_get_onboarding_by_token" as never,
        { _token: token } as never,
      )) as { data: any; error: any };
      const data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const row = data as unknown as OnboardingFormRow;
      setForm(row);
      setResponses(hydrate(row.responses));
      setLoading(false);

      if (row.proposal_id) {
        try {
          const { data: pRows } = (await supabase.rpc(
            "public_get_proposal_by_id" as never,
            { _id: row.proposal_id } as never,
          )) as { data: any };
          const p = Array.isArray(pRows) && pRows.length > 0 ? pRows[0] : null;
          if (p) setProposalSummary(p as ProposalSummary);
        } catch {
          // Silently skip — summary card is best-effort.
        }
      }
    })();
  }, [token]);

  const groups = useMemo(() => (form ? groupFields(form.fields) : []), [form]);
  const serialized = useMemo(() => serialize(responses), [responses]);
  const progress = useMemo(
    () => (form ? onboardingProgress({ fields: form.fields, responses: serialized }) : 0),
    [form, serialized],
  );

  const handleChange = (id: string, value: string | string[] | boolean) => {
    setResponses((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (complete: boolean) => {
    if (!form || !token) return;
    const payload = serialize(responses);
    if (complete) {
      const missing = form.fields.filter(
        (f) => f.required && isFieldVisible(f, responses) && !(payload[f.id] || "").trim(),
      );
      if (missing.length) {
        toast({
          title: "Please fill the required fields",
          description: `${missing.length} field${missing.length > 1 ? "s" : ""} still need to be completed.`,
          variant: "destructive",
        });
        return;
      }
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("onboarding_submit", {
      _token: token,
      _responses: payload,
      _complete: complete,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Couldn't save onboarding", description: error.message, variant: "destructive" });
      return;
    }
    setForm({
      ...form,
      responses: payload,
      status: complete ? "completed" : "in_progress",
      completed_at: complete ? new Date().toISOString() : form.completed_at,
      started_at: form.started_at || new Date().toISOString(),
    });
    toast({
      title: complete ? "Onboarding submitted" : "Progress saved",
      description: complete
        ? "Thanks — your information has been sent successfully. We'll review everything and let you know when the next step is ready."
        : "You can return to this link anytime to finish.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Onboarding not found</h1>
          <p className="text-muted-foreground text-sm">This link may be invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  if (form.status === "completed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Onboarding complete</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Thanks{form.client_name ? `, ${form.client_name}` : ""}! We'll review everything and let you know when the next step is ready.
          </p>
          {form.proposal_id && (
            <Button asChild variant="outline">
              <Link to={`/proposal/view/${form.proposal_id}`}>Back to proposal</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <DynamicFavicon userId={form?.user_id} />
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-5 h-5 text-purple shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">Project Onboarding</span>
          </div>
          <span className="text-xs text-muted-foreground">{progress}% complete</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-6">
        <OnboardingProgressTracker currentStage="onboarding" />

        {proposalSummary && (() => {
          const money =
            (proposalSummary.amount_cents != null
              ? formatCents(
                  calculateCommercialTotals(
                    proposalSummary.amount_cents,
                    proposalSummary.tax_rate ?? null,
                    (proposalSummary.tax_mode as any) ?? null,
                  ).totalCents,
                  proposalSummary.currency ?? null,
                )
              : null) ||
            proposalSummary.budget ||
            null;
          const rows: { label: string; value: string }[] = [];
          if (proposalSummary.service_type) rows.push({ label: "Project", value: proposalSummary.service_type });
          const client = proposalSummary.company_name || proposalSummary.client_name;
          if (client) rows.push({ label: "Client", value: client });
          if (money) rows.push({ label: "Budget", value: money });
          if (proposalSummary.timeline) rows.push({ label: "Timeline", value: proposalSummary.timeline });
          rows.push({ label: "Status", value: "Awaiting onboarding" });
          return (
            <section className="rounded-xl border border-border bg-card p-6 lg:p-8">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple/15 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-purple" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-purple font-semibold">Project summary</p>
                  <h2 className="text-lg font-semibold text-foreground mt-1">Here's what we already have on file</h2>
                </div>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {rows.map((r) => (
                  <div key={r.label} className="flex flex-col">
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{r.label}</dt>
                    <dd className="text-sm text-foreground mt-0.5 break-words">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })()}



        <section className="rounded-xl border border-border bg-card p-6 lg:p-8">
          <div className="flex items-start gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple/15 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground">Tell us about your project</h1>
              <p className="text-sm text-muted-foreground mt-1">
                The more we know up front, the faster we can deliver. Answers save automatically when you tap Save progress.
              </p>
            </div>
          </div>
          <div className="mt-4 h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        {groups.map((group) => {
          const visible = group.fields.filter((f) => isFieldVisible(f, responses));
          if (visible.length === 0) return null;
          return (
            <section key={group.group} className="rounded-xl border border-border bg-card p-6 lg:p-8 space-y-5">
              <p className="text-xs uppercase tracking-[0.2em] text-purple font-semibold">{group.group}</p>
              {visible.map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <Label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span className="text-rose-500 ml-1">*</span>}
                  </Label>
                  <SmartFieldRenderer
                    field={field}
                    value={responses[field.id]}
                    onChange={(v) => handleChange(field.id, v)}
                    formContext={{ token }}
                  />
                  {field.helpText && (
                    <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
                  )}
                </div>
              ))}
            </section>
          );
        })}

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="confirm-accurate"
              checked={confirmedAccurate}
              onCheckedChange={(c) => setConfirmedAccurate(c === true)}
              className="mt-0.5"
            />
            <label htmlFor="confirm-accurate" className="text-sm text-foreground/90 leading-relaxed cursor-pointer select-none">
              I confirm the information provided is accurate and ready for review.
            </label>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sticky bottom-3">
          <Button
            size="lg"
            onClick={() => handleSubmit(true)}
            disabled={submitting || !confirmedAccurate}
            className="flex-1 gap-2 bg-accent text-accent-foreground font-semibold hover:bg-accent/90 h-12 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Submit onboarding
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="h-12"
          >
            Save progress
          </Button>
        </div>
      </main>
    </div>
  );
}
