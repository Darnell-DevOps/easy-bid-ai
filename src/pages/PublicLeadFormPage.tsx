import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Send } from "lucide-react";
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
      // record view (fire and forget)
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
    // Pull name/email/phone/company from common-ID matches if present
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
    // Notify embedding parent
    if (embed && typeof window !== "undefined" && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "lovable-form-submitted", slug }, "*");
      } catch { /* no-op */ }
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
        <div className="max-w-lg w-full text-center rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Thanks!</h1>
          <p className="text-sm text-muted-foreground">{form.success_message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${embed ? "" : "min-h-screen"} bg-background ${embed ? "" : "py-10"}`}>
      <main className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="rounded-xl border border-border bg-card p-6 lg:p-8 space-y-6">
          <header>
            <h1 className="text-2xl font-bold text-foreground">{form.title}</h1>
            {form.description && <p className="text-sm text-muted-foreground mt-2">{form.description}</p>}
          </header>

          {grouped.map((g) => (
            <section key={g.group} className="space-y-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-purple font-semibold">{g.group}</p>
              {g.fields.map((f) => isFieldVisible(f, responses) && (
                <div key={f.id} className="space-y-1.5">
                  <Label htmlFor={f.id}>
                    {f.label}{f.required && <span className="text-rose-500 ml-1">*</span>}
                  </Label>
                  <SmartFieldRenderer
                    field={f}
                    value={responses[f.id]}
                    onChange={(v) => setResponses((p) => ({ ...p, [f.id]: v }))}
                    formContext={{ slug }}
                  />
                  {f.helpText && <p className="text-[11px] text-muted-foreground">{f.helpText}</p>}
                </div>
              ))}
            </section>
          ))}

          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 h-12"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {form.submit_label || "Submit"}
          </Button>
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
