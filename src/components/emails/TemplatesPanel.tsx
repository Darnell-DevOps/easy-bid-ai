import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CLIENT_TEMPLATES, ClientTemplate, ClientTemplateKey, TEMPLATE_BY_KEY, renderClientTemplate,
} from "@/lib/email-templates-defaults";
import BrandingCard, { Branding } from "./BrandingCard";
import { Loader2, RotateCcw, Save, Eye, Pencil } from "lucide-react";

interface SavedRow {
  template_key: string;
  subject: string | null;
  body: string | null;
  cta_text: string | null;
  sign_off: string | null;
  sender_display_name: string | null;
}

const SAMPLE_VARS: Record<string, string> = {
  client_name: "Jamie Rivera",
  proposal_link: "https://app.closesync.io/proposal/sample",
  contract_link: "https://app.closesync.io/sign/sample",
  payment_link: "https://app.closesync.io/pay/sample",
  booking_link: "https://app.closesync.io/book/sample",
  onboarding_link: "https://app.closesync.io/onboarding/sample",
  signature_link: "https://app.closesync.io/sign/sample",
  invoice_amount: "$2,400",
  retainer_amount: "$1,500/mo",
  due_date: "Friday, 6 June",
};

export default function TemplatesPanel() {
  const { toast } = useToast();
  const [activeKey, setActiveKey] = useState<ClientTemplateKey>("proposal_sent");
  const [saved, setSaved] = useState<Record<string, SavedRow>>({});
  const [branding, setBranding] = useState<Branding | null>(null);
  const [draft, setDraft] = useState<SavedRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const def = TEMPLATE_BY_KEY[activeKey];

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const [tplRes, brandRes] = await Promise.all([
      supabase.from("email_templates").select("template_key, subject, body, cta_text, sign_off, sender_display_name").eq("user_id", u.user.id),
      supabase.from("business_branding").select("*").eq("user_id", u.user.id).maybeSingle(),
    ]);
    const map: Record<string, SavedRow> = {};
    (tplRes.data || []).forEach((r: any) => { map[r.template_key] = r; });
    setSaved(map);
    if (brandRes.data) {
      setBranding({
        business_name: brandRes.data.business_name || "",
        logo_url: brandRes.data.logo_url || "",
        brand_color: brandRes.data.brand_color || "#3b82f6",
        default_sender_name: brandRes.data.default_sender_name || "",
        default_sign_off: brandRes.data.default_sign_off || "",
        reply_to_email: brandRes.data.reply_to_email || "",
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Initialise draft when active key or saved-data changes
  useEffect(() => {
    const s = saved[activeKey];
    setDraft({
      template_key: activeKey,
      subject: s?.subject ?? def.subject,
      body: s?.body ?? def.body,
      cta_text: s?.cta_text ?? def.cta_text,
      sign_off: s?.sign_off ?? def.sign_off,
      sender_display_name: s?.sender_display_name ?? branding?.default_sender_name ?? "",
    });
  }, [activeKey, saved, branding, def]);

  const insertVar = (name: string) => {
    if (!draft || !bodyRef.current) return;
    const ta = bodyRef.current;
    const start = ta.selectionStart ?? draft.body?.length ?? 0;
    const end = ta.selectionEnd ?? start;
    const before = (draft.body || "").slice(0, start);
    const after = (draft.body || "").slice(end);
    const token = `{{${name}}}`;
    setDraft({ ...draft, body: before + token + after });
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + token.length;
    }, 0);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(false); return; }
    const { error } = await supabase.from("email_templates").upsert({
      user_id: u.user.id,
      template_key: draft.template_key,
      subject: draft.subject || "",
      body: draft.body || "",
      cta_text: draft.cta_text || "",
      sign_off: draft.sign_off || "",
      sender_display_name: draft.sender_display_name || null,
      is_active: true,
    }, { onConflict: "user_id,template_key" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save template", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Template saved" });
    load();
  };

  const reset = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("email_templates").delete().eq("user_id", u.user.id).eq("template_key", activeKey);
    toast({ title: "Reset to default" });
    load();
  };

  const previewHtml = useMemo(() => {
    if (!draft) return "";
    const rendered = renderClientTemplate(def, {
      vars: SAMPLE_VARS,
      branding: {
        business_name: branding?.business_name || "Your business",
        logo_url: branding?.logo_url || "",
        brand_color: branding?.brand_color || "#3b82f6",
        sender_name: draft.sender_display_name || branding?.default_sender_name || "",
        sign_off: branding?.default_sign_off || "",
        reply_to_email: branding?.reply_to_email || "",
      },
    }, {
      subject: draft.subject || "",
      body: draft.body || "",
      cta_text: draft.cta_text || "",
      sign_off: draft.sign_off || "",
    });
    return rendered.html;
  }, [draft, branding, def]);

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <BrandingCard onSaved={(b) => setBranding(b)} />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar list */}
        <Card>
          <CardContent className="p-2">
            <div className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">Client emails</div>
            <div className="space-y-1">
              {CLIENT_TEMPLATES.map((t) => {
                const isActive = t.key === activeKey;
                const isCustom = !!saved[t.key];
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveKey(t.key)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${isActive ? "bg-accent/10 text-foreground" : "hover:bg-muted/50 text-muted-foreground"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{t.label}</span>
                      {isCustom && <Badge variant="outline" className="text-[10px] h-5">Custom</Badge>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t.description}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Editor / preview */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold">{def.label}</h3>
                <p className="text-xs text-muted-foreground">{def.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-md border border-border p-0.5">
                  <Button size="sm" variant={mode === "edit" ? "default" : "ghost"} onClick={() => setMode("edit")} className="h-7 gap-1.5">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant={mode === "preview" ? "default" : "ghost"} onClick={() => setMode("preview")} className="h-7 gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </Button>
                </div>
                {saved[activeKey] && (
                  <Button size="sm" variant="outline" onClick={reset} className="gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </Button>
                )}
                <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                </Button>
              </div>
            </div>

            {mode === "edit" && draft && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs">Subject</Label>
                    <Input className="mt-1.5" value={draft.subject || ""} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Sender display name (optional override)</Label>
                    <Input className="mt-1.5" value={draft.sender_display_name || ""} onChange={(e) => setDraft({ ...draft, sender_display_name: e.target.value })} placeholder={branding?.default_sender_name || "Use branding default"} />
                  </div>
                  <div>
                    <Label className="text-xs">Body</Label>
                    <Textarea ref={bodyRef} rows={12} className="mt-1.5 font-mono text-sm" value={draft.body || ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">CTA button text</Label>
                      <Input className="mt-1.5" value={draft.cta_text || ""} onChange={(e) => setDraft({ ...draft, cta_text: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">CTA links to</Label>
                      <Input className="mt-1.5 font-mono text-xs" value={`{{${def.cta_url_var}}}`} disabled />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Sign-off</Label>
                    <Textarea rows={3} className="mt-1.5 font-mono text-sm" value={draft.sign_off || ""} onChange={(e) => setDraft({ ...draft, sign_off: e.target.value })} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Available variables</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {def.variables.map((v) => (
                      <button
                        key={v}
                        onClick={() => insertVar(v)}
                        className="px-2 py-1 rounded-md text-[11px] font-mono bg-muted hover:bg-accent/20 text-foreground border border-border transition-colors"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                    Click to insert into the body. Variables are replaced with real client data when the email is sent.
                  </p>
                </div>
              </div>
            )}

            {mode === "preview" && (
              <div className="rounded-lg border border-border overflow-hidden bg-white">
                <iframe title="preview" srcDoc={previewHtml} className="w-full" style={{ height: 560, border: 0 }} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
