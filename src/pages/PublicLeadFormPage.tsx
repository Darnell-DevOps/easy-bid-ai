import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Send, ShieldCheck, ArrowLeft } from "lucide-react";
import SmartFieldRenderer from "@/components/forms/SmartFieldRenderer";
import {
  groupSmartFields, isFieldVisible, missingRequired,
  type SmartField, type FieldResponses,
} from "@/lib/form-fields";

interface PublicForm {
  id: string;
  slug: string;
  title: string;
  description: string;
  fields: SmartField[];
  submit_label: string;
  success_message: string;
  redirect_url: string | null;
  is_active: boolean;
}

export default function PublicLeadFormPage() {
  const { slug } = useParams();
  const [search] = useSearchParams();
  const embed = search.get("embed") === "1";
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [responses, setResponses] = useState<FieldResponses>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("lead_forms" as any)
        .select("id, slug, title, description, fields, submit_label, success_message, redirect_url, is_active")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (!data) { setNotFound(true); setLoading(false); return; }
      setForm(data as any);
      setLoading(false);
      supabase.rpc("lead_form_record_view" as any, {
        _slug: slug,
        _user_agent: navigator.userAgent.slice(0, 200),
        _referer: document.referrer.slice(0, 200) || null,
      });
    })();
  }, [slug]);

  const grouped = useMemo(() => (form ? groupSmartFields(form.fields || []) : []), [form]);

  const handleSubmit = async () => {
    if (!form || !slug) return;
    const missing = missingRequired(form.fields, responses);
    if (missing.length) {
      toast({
        title: "Please complete required fields",
        description: missing.map((f) => f.label).join(", "),
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = responses[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return null;
    };
    const { data, error } = await supabase.rpc("lead_form_submit" as any, {
      _slug: slug,
      _responses: serialize(responses),
      _name: pick("name", "full_name", "fullname", "your_name"),
      _email: pick("email", "your_email"),
      _phone: pick("phone", "phone_number"),
      _company: pick("company", "company_name", "business"),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
      return;
    }
    if (embed && typeof window !== "undefined" && window.parent !== window) {
      try { window.parent.postMessage({ type: "lovable-form-submitted", slug }, "*"); } catch { /* no-op */ }
    }
    const redirect = (data as any)?.redirect_url || form.redirect_url;
    if (redirect) {
      window.location.href = redirect;
      return;
    }
    setDone(true);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (notFound || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Form unavailable</h1>
          <p className="text-muted-foreground text-sm">This form link is invalid or no longer accepting responses.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={`${embed ? "" : "min-h-screen"} bg-background flex items-center justify-center px-4 py-12`}>
        <div className="relative max-w-lg w-full text-center rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-10 overflow-hidden">
          <div className="absolute inset-x-0 -top-24 h-48 bg-gradient-to-b from-accent/20 via-purple/10 to-transparent blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-500/10 ring-1 ring-emerald-500/40 mb-5">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 tracking-tight">
              Project details received
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              We've received your details and will review your project shortly.
            </p>
            {!embed && (
              <Button
                onClick={() => navigate("/")}
                size="lg"
                className="mt-7 gap-2 bg-gradient-to-r from-accent via-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110"
              >
                <ArrowLeft className="w-4 h-4" /> Back to homepage
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const submitLabel =
    !form.submit_label || form.submit_label.trim().toLowerCase() === "submit"
      ? "Send Project Details"
      : form.submit_label;

  return (
    <div className={`${embed ? "" : "min-h-screen"} bg-background ${embed ? "" : "py-10 sm:py-14"}`}>
      <main className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur p-6 sm:p-10 overflow-hidden">
          {/* premium top gradient */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple/10 blur-3xl rounded-full pointer-events-none" />

          <header className="relative mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{form.title}</h1>
            {form.description && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xl">{form.description}</p>
            )}
          </header>

          <div className="relative space-y-10">
            {grouped.map((g, gi) => (
              <section key={g.group} className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-accent/15 text-accent text-[11px] font-semibold">
                    {gi + 1}
                  </span>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-foreground/80 font-semibold">
                    {g.group}
                  </p>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
                <div className="space-y-5">
                  {g.fields.map((f) => isFieldVisible(f, responses) && (
                    <div key={f.id} className="space-y-1.5">
                      <Label htmlFor={f.id} className="text-sm font-medium text-foreground">
                        {f.label}{f.required && <span className="text-rose-500 ml-1">*</span>}
                      </Label>
                      <div className="[&_input]:transition-all [&_textarea]:transition-all [&_input]:focus-visible:ring-2 [&_textarea]:focus-visible:ring-2 [&_input]:focus-visible:ring-accent/40 [&_textarea]:focus-visible:ring-accent/40">
                        <SmartFieldRenderer
                          field={f}
                          value={responses[f.id]}
                          onChange={(v) => setResponses((p) => ({ ...p, [f.id]: v }))}
                          formContext={{ slug }}
                        />
                      </div>
                      {f.helpText && <p className="text-[11px] text-muted-foreground">{f.helpText}</p>}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="relative mt-10 pt-6 border-t border-border/60 space-y-4">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-2 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80 flex-shrink-0" />
              Submit your details and we'll prepare the next step for your project.
            </p>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full gap-2 bg-gradient-to-r from-accent via-purple to-accent text-accent-foreground font-semibold shadow-lg shadow-accent/20 hover:brightness-110 h-12"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitLabel}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function serialize(r: FieldResponses): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (v == null) continue;
    if (Array.isArray(v)) out[k] = v.join(", ");
    else if (typeof v === "boolean") out[k] = v ? "yes" : "no";
    else out[k] = String(v);
  }
  return out;
}
