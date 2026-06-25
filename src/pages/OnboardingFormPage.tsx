import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, ClipboardList, Sparkles, ArrowRight } from "lucide-react";
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

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase
        .from("onboarding_forms")
        .select("*")
        .eq("access_token", token)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const row = data as unknown as OnboardingFormRow;
      setForm(row);
      setResponses(hydrate(row.responses));
      setLoading(false);
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
        ? "Thank you! We'll be in touch shortly to kick things off."
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
            Thanks{form.client_name ? `, ${form.client_name}` : ""}! Your project is ready to begin. We'll be in touch shortly.
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
              className="h-full bg-gradient-to-r from-purple to-accent transition-all"
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

        <div className="flex flex-col sm:flex-row gap-3 sticky bottom-3">
          <Button
            size="lg"
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="flex-1 gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 h-12"
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
