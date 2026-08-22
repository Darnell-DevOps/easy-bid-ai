import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";
import SmartFieldRenderer from "@/components/forms/SmartFieldRenderer";
import DynamicFavicon from "@/components/branding/DynamicFavicon";
import {
  groupSmartFields, isFieldVisible, missingRequired,
  type SmartField, type FieldResponses,
} from "@/lib/form-fields";

interface PublicForm {
  id: string;
  user_id: string;
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
  const [formError, setFormError] = useState("");
  const [invalidFieldIds, setInvalidFieldIds] = useState<string[]>([]);
  // Spam protection: honeypot field + min time-to-submit guard.
  const [honeypot, setHoneypot] = useState("");
  const [loadedAt] = useState(() => Date.now());


  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase.rpc("public_get_lead_form_by_slug" as any, { _slug: slug });
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) { setNotFound(true); setLoading(false); return; }
      setForm(row as any);
      setLoading(false);
      supabase.rpc("lead_form_record_view" as any, {
        _slug: slug,
        _user_agent: navigator.userAgent.slice(0, 200),
        _referer: document.referrer.slice(0, 200) || null,
      });
    })();
  }, [slug]);

  const grouped = useMemo(() => (form ? groupSmartFields(form.fields || []) : []), [form]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || !slug) return;
    setFormError("");
    setInvalidFieldIds([]);

    // Honeypot tripped — pretend success, don't call the RPC.
    if (honeypot.trim().length > 0) {
      setDone(true);
      return;
    }

    // Min time-to-submit (1.5s) — humans don't fill multi-section forms this fast.
    if (Date.now() - loadedAt < 1500) {
      setDone(true);
      return;
    }

    const missing = missingRequired(form.fields, responses);
    if (missing.length) {
      const missingLabels = missing.map((f) => f.label).join(", ");
      setFormError(`Please complete the required fields: ${missingLabels}.`);
      setInvalidFieldIds(missing.map((field) => field.id));
      window.requestAnimationFrame(() => {
        document.getElementById(`${missing[0].id}-field-wrapper`)?.focus();
      });
      toast({
        title: "Please complete required fields",
        description: missingLabels,
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
    const fingerprint = await computeFingerprint(form.id);
    const { data, error } = await supabase.rpc("lead_form_submit" as any, {
      _slug: slug,
      _responses: serialize(responses),
      _name: pick("name", "full_name", "fullname", "your_name"),
      _email: pick("email", "your_email"),
      _phone: pick("phone", "phone_number"),
      _company: pick("company", "company_name", "business"),
      _honeypot: null,
      _fingerprint: fingerprint,
    });
    setSubmitting(false);
    if (error) {
      const msg = String(error.message || "");
      if (msg.includes("rate_limited")) {
        setFormError("Too many submissions. Please wait a few minutes before trying again.");
        // Don't expose technical spam messaging — show a calm, generic note.
        toast({
          title: "Too many submissions",
          description: "Please wait a few minutes before submitting this form again.",
          variant: "destructive",
        });
        return;
      }
      setFormError("Submission failed. Please check your details and try again.");
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
    return (
      <main className="min-h-screen flex items-center justify-center bg-background" aria-busy="true">
        <Loader2 aria-hidden="true" className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="sr-only" role="status">Loading form.</span>
      </main>
    );
  }
  if (notFound || !form) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Form unavailable</h1>
          <p className="text-muted-foreground text-sm">This form link is invalid or no longer accepting responses.</p>
        </div>
      </main>
    );
  }

  if (done) {
    const { title: successTitle, body: successBody } = splitSuccessMessage(form.success_message);
    return (
      <main className={`${embed ? "" : "min-h-screen"} bg-background flex items-center justify-center px-4 py-12`}>
        <div className="relative max-w-lg w-full text-center rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-10 overflow-hidden" role="status" aria-live="polite">
          <div className="absolute inset-x-0 -top-24 h-48 bg-accent/10 blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/40 mb-5">
              <CheckCircle2 aria-hidden="true" className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 tracking-tight">
              {successTitle}
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {successBody}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const submitLabel =
    !form.submit_label || form.submit_label.trim().toLowerCase() === "submit"
      ? "Send Project Details"
      : form.submit_label;

  return (
    <div className={`${embed ? "" : "min-h-screen"} bg-background ${embed ? "" : "py-10 sm:py-14"}`}>
      <DynamicFavicon userId={form?.user_id} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur p-6 sm:p-10 overflow-hidden">
          {/* premium top gradient */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple/10 blur-3xl rounded-full pointer-events-none" />

          <header className="relative mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{form.title}</h1>
            {form.description && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xl">{form.description}</p>
            )}
          </header>

          <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          <div className="relative space-y-10">
            {grouped.map((g, gi) => (
              <section key={g.group} className="space-y-5" aria-labelledby={`lead-form-section-${gi}`}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-accent/15 text-accent text-[11px] font-semibold">
                    {gi + 1}
                  </span>
                  <h2 id={`lead-form-section-${gi}`} className="text-[11px] uppercase tracking-[0.22em] text-foreground/80 font-semibold">
                    {g.group}
                  </h2>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
                <div className="space-y-5">
                  {g.fields.map((f) => {
                    if (!isFieldVisible(f, responses)) return null;
                     const labelId = `${f.id}-label`;
                      const descriptionId = f.helpText ? `${f.id}-description` : undefined;
                      const errorId = `${f.id}-error`;
                      const invalid = invalidFieldIds.includes(f.id);
                    const usesGroupLabel = ["radio", "multi_select", "checkbox", "file"].includes(f.type);
                    const labelContent = (
                      <>
                        {f.label}
                        {f.required && (
                          <>
                            <span aria-hidden="true" className="text-rose-500 ml-1">*</span>
                            {f.type === "multi_select" && <span className="sr-only"> (required)</span>}
                          </>
                        )}
                      </>
                    );

                    return (
                      <div
                        key={f.id}
                        id={`${f.id}-field-wrapper`}
                        tabIndex={-1}
                        aria-labelledby={labelId}
                        aria-describedby={invalid ? errorId : descriptionId}
                        className="space-y-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
                      >
                        {usesGroupLabel ? (
                          <p id={labelId} className="text-sm font-medium text-foreground">{labelContent}</p>
                        ) : (
                          <Label id={labelId} htmlFor={f.id} className="text-sm font-medium text-foreground">
                            {labelContent}
                          </Label>
                        )}
                        <div className="[&_input]:transition-all [&_textarea]:transition-all [&_input]:focus-visible:ring-2 [&_textarea]:focus-visible:ring-2 [&_input]:focus-visible:ring-accent/40 [&_textarea]:focus-visible:ring-accent/40">
                          <SmartFieldRenderer
                            field={f}
                            value={responses[f.id]}
                            onChange={(v) => {
                             setFormError("");
                              setInvalidFieldIds((ids) => ids.filter((id) => id !== f.id));
                              setResponses((p) => ({ ...p, [f.id]: v }));
                            }}
                            formContext={{ slug }}
                            labelId={labelId}
                            descriptionId={descriptionId}
                            invalid={invalid}
                            errorId={errorId}
                          />
                        </div>
                        {f.helpText && <p id={descriptionId} className="text-[11px] text-muted-foreground">{f.helpText}</p>}
                        {invalid && <p id={errorId} className="text-xs text-destructive">This field is required.</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* Honeypot — hidden from real users, irresistible to naive bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" style={{ position: "absolute", left: "-9999px" }}>
            <label htmlFor="website_url_hp">Website (leave blank)</label>
            <input
              type="text"
              id="website_url_hp"
              name="website_url_hp"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>


          <div className="relative mt-10 pt-6 border-t border-border/60 space-y-4">
            {formError && (
              <p role="alert" aria-atomic="true" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}
            <p id="lead-form-submit-note" className="text-xs text-muted-foreground flex items-center justify-center gap-2 text-center">
              <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-emerald-400/80 flex-shrink-0" />
              Submit your details and we'll prepare the next step for your project.
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              aria-describedby="lead-form-submit-note"
              className="w-full gap-2 bg-accent text-accent-foreground font-semibold hover:bg-accent/90 h-12"
            >
              {submitting ? <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> : <Send aria-hidden="true" className="w-4 h-4" />}
              {submitLabel}
            </Button>
          </div>
          </form>
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

// Render the user's `success_message` inside the premium success screen.
// Splits "Title. Body…" or "Title\nBody" into heading + supporting text so
// editing the message stays consistent with the polished default layout.
function splitSuccessMessage(raw: string | null | undefined): { title: string; body: string } {
  const fallback = {
    title: "Project details received",
    body: "We've received your details and will review your project shortly.",
  };
  const msg = (raw || "").trim();
  if (!msg) return fallback;
  const nl = msg.indexOf("\n");
  if (nl > 0) {
    const title = msg.slice(0, nl).trim();
    const body = msg.slice(nl + 1).trim();
    if (title && body) return { title, body };
  }
  const m = msg.match(/^(.+?[.!?])\s+(.+)$/s);
  if (m) return { title: m[1].replace(/[.!?]+$/, "").trim(), body: m[2].trim() };
  return { title: fallback.title, body: msg };
}

// Stable per-form + per-browser fingerprint. Persisted in localStorage so the
// same visitor counts toward the same rate-limit bucket across reloads, but
// never tied to identifying info (no IP, no PII).
async function computeFingerprint(formId: string): Promise<string> {
  let visitorId: string | null = null;
  try {
    visitorId = localStorage.getItem("lf_visitor_id");
    if (!visitorId) {
      visitorId = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) + "-" + Date.now().toString(36);
      localStorage.setItem("lf_visitor_id", visitorId);
    }
  } catch {
    visitorId = Math.random().toString(36).slice(2);
  }
  const raw = [
    formId,
    visitorId,
    navigator.userAgent || "",
    navigator.language || "",
    String(screen?.width || 0) + "x" + String(screen?.height || 0),
    String(new Date().getTimezoneOffset()),
  ].join("|");
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback (older browsers): simple non-crypto hash, still stable per visitor.
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
    return "fb_" + (h >>> 0).toString(16) + "_" + visitorId;
  }
}

