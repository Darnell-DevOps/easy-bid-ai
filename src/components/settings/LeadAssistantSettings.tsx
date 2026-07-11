import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Loader2,
  Inbox,
  MessageSquareQuote,
  CalendarClock,
  ShieldAlert,
  Lock,
  PenLine,
} from "lucide-react";

type Prefs = {
  business_name: string;
  business_services: string;
  business_ideal_client: string;
  business_target_audience: string;
  booking_link: string;
  lead_reply_tone: string;
  lead_reply_style: string;
  lead_reply_length: string;
  email_signature: string;
  lead_auto_send_enabled: boolean;
  lead_auto_send_min_confidence: string;
  lead_auto_send_only_new_leads: boolean;
  lead_auto_send_block_keywords: string[];
};

const DEFAULT_BLOCK_KEYWORDS = [
  "complaint", "lawsuit", "refund", "chargeback", "dispute", "legal",
  "attorney", "sue", "court", "fraud", "scam", "cancel", "angry", "urgent issue",
];

const DEFAULTS: Prefs = {
  business_name: "",
  business_services: "",
  business_ideal_client: "",
  business_target_audience: "",
  booking_link: "",
  lead_reply_tone: "friendly",
  lead_reply_style: "consultative",
  lead_reply_length: "standard",
  email_signature: "",
  lead_auto_send_enabled: false,
  lead_auto_send_min_confidence: "high",
  lead_auto_send_only_new_leads: true,
  lead_auto_send_block_keywords: DEFAULT_BLOCK_KEYWORDS,
};

const TONES = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "consultative", label: "Consultative" },
  { value: "sales", label: "Sales-Focused" },
  { value: "formal", label: "Formal" },
];

const STYLES = [
  { value: "consultative", label: "Consultative — ask smart qualifying questions" },
  { value: "concise", label: "Concise — short and direct" },
  { value: "warm", label: "Warm — relationship-first" },
  { value: "sales-forward", label: "Sales-forward — push toward next step" },
];

const LENGTHS = [
  { value: "short", label: "Short (≤80 words)" },
  { value: "standard", label: "Standard (≤180 words)" },
  { value: "detailed", label: "Detailed (≤300 words)" },
];

const CONFIDENCE = [
  { value: "high", label: "High confidence only (recommended)" },
  { value: "medium", label: "Medium and above" },
  { value: "low", label: "Any confidence" },
];

export default function LeadAssistantSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [original, setOriginal] = useState<Prefs>(DEFAULTS);
  const [keywordDraft, setKeywordDraft] = useState("");

  const dirty = useMemo(() => JSON.stringify(prefs) !== JSON.stringify(original), [prefs, original]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await supabase
        .from("ai_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const merged: Prefs = { ...DEFAULTS };
        for (const k of Object.keys(DEFAULTS) as (keyof Prefs)[]) {
          const v = (data as Record<string, unknown>)[k as string];
          if (v !== null && v !== undefined) {
            (merged as Record<string, unknown>)[k as string] = v;
          }
        }
        setPrefs(merged);
        setOriginal(merged);
      }
      setLoading(false);
    };
    load();
  }, []);

  const set = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("ai_preferences")
      .upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    setOriginal(prefs);
    toast({ title: "Lead Assistant updated", description: "New replies will use these settings." });
  };

  const addKeyword = () => {
    const v = keywordDraft.trim().toLowerCase();
    if (!v) return;
    if (prefs.lead_auto_send_block_keywords.includes(v)) {
      setKeywordDraft("");
      return;
    }
    set("lead_auto_send_block_keywords", [...prefs.lead_auto_send_block_keywords, v]);
    setKeywordDraft("");
  };

  const removeKeyword = (k: string) => {
    set("lead_auto_send_block_keywords", prefs.lead_auto_send_block_keywords.filter((x) => x !== k));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dirty && (
        <div className="sticky top-2 z-10 flex items-center justify-between gap-3 p-3 rounded-lg border border-accent/40 bg-accent/5 backdrop-blur">
          <p className="text-sm text-foreground">Unsaved Lead Assistant changes.</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPrefs(original)} disabled={saving}>Discard</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      <Section icon={Building2} title="Business profile" description="Shown to AI when drafting replies on your behalf.">
        <div className="space-y-4">
          <Field
            label="Business name"
            placeholder="e.g. Northbound Studio"
            value={prefs.business_name}
            onChange={(v) => set("business_name", v)}
            max={120}
          />
          <Field
            label="Services offered"
            placeholder="e.g. Brand identity, websites, retainer creative direction."
            value={prefs.business_services}
            onChange={(v) => set("business_services", v)}
            max={500}
            multiline
          />
          <Field
            label="Ideal client"
            placeholder="e.g. Series A SaaS founders needing a rebrand; established coaches launching a course."
            value={prefs.business_ideal_client}
            onChange={(v) => set("business_ideal_client", v)}
            max={400}
            multiline
            helper="Who you do your best work for — used by AI to score how well an inbound lead fits."
          />
          <Field
            label="Who this isn't for / target audience"
            placeholder="e.g. Not a fit for pre-launch bootstrappers under $5k or one-off logo tweaks."
            value={prefs.business_target_audience}
            onChange={(v) => set("business_target_audience", v)}
            max={400}
            multiline
            helper="Helps AI mark leads as Cold when they clearly don't match."
          />
          <Field
            label="Booking link"
            placeholder="https://cal.com/yourname/intro"
            value={prefs.booking_link}
            onChange={(v) => set("booking_link", v)}
            max={300}
          />
          <p className="text-[11px] text-muted-foreground">
            The booking link is offered as a CTA when AI suggests a call.
          </p>
        </div>
      </Section>

      <Section icon={MessageSquareQuote} title="Voice & style" description="Controls how the assistant writes your replies.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Tone of voice</Label>
            <SelectField value={prefs.lead_reply_tone} onChange={(v) => set("lead_reply_tone", v)} options={TONES} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Default reply style</Label>
            <SelectField value={prefs.lead_reply_style} onChange={(v) => set("lead_reply_style", v)} options={STYLES} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Length</Label>
            <SelectField value={prefs.lead_reply_length} onChange={(v) => set("lead_reply_length", v)} options={LENGTHS} />
          </div>
        </div>
      </Section>

      <Section icon={PenLine} title="Signature" description="Appended to every drafted reply.">
        <Textarea
          value={prefs.email_signature}
          onChange={(e) => set("email_signature", e.target.value.slice(0, 600))}
          placeholder={"Best,\nYour name\nNorthbound Studio · northbound.studio"}
          rows={4}
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
          {prefs.email_signature.length} / 600
        </p>
      </Section>

      <Card className="border-amber-500/30">
        <CardContent className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground">Auto-send rules</h3>
                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500 gap-1">
                  <Lock className="w-3 h-3" /> Preview · Disabled by default
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Configure the guardrails for the upcoming auto-send feature. Even if you enable it here, the
                server keeps every drafted reply in your review queue until auto-send is fully released.
              </p>
            </div>
          </div>

          <ToggleRow
            label="Enable auto-send (when available)"
            sublabel="Save your preference now — actual sending stays off until we launch this feature."
            checked={prefs.lead_auto_send_enabled}
            onChange={(v) => set("lead_auto_send_enabled", v)}
          />
          <Separator className="my-3" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Minimum AI confidence</Label>
              <SelectField
                value={prefs.lead_auto_send_min_confidence}
                onChange={(v) => set("lead_auto_send_min_confidence", v)}
                options={CONFIDENCE}
              />
            </div>
          </div>

          <ToggleRow
            label="Only auto-send to brand-new inbound leads"
            sublabel="Never auto-respond on threads with existing clients or known senders."
            checked={prefs.lead_auto_send_only_new_leads}
            onChange={(v) => set("lead_auto_send_only_new_leads", v)}
          />

          <div className="mt-4">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Block-list keywords</Label>
            <p className="text-[11px] text-muted-foreground mb-2">
              If any of these words appear in the subject or body, the message will never be auto-sent —
              it will land in your review queue instead.
            </p>
            <div className="flex gap-2 mb-2">
              <Input
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                placeholder="Add a keyword and press Enter"
                className="h-9"
              />
              <Button type="button" variant="outline" size="sm" onClick={addKeyword}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {prefs.lead_auto_send_block_keywords.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">No keywords — anything could match.</p>
              )}
              {prefs.lead_auto_send_block_keywords.map((k) => (
                <Badge
                  key={k}
                  variant="outline"
                  className="text-[11px] gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                  onClick={() => removeKeyword(k)}
                  title="Click to remove"
                >
                  {k} ×
                </Badge>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
            <Inbox className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Every auto-send decision (sent, blocked by keyword, blocked by confidence, blocked because the
              feature is off) is recorded in your audit log so nothing happens without an explanation.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5" /> Changes apply to drafts created from now on.
        </p>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ToggleRow({
  label,
  sublabel,
  checked,
  onChange,
}: {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {sublabel && <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  max,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max?: number;
  multiline?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(max ? e.target.value.slice(0, max) : e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(max ? e.target.value.slice(0, max) : e.target.value)}
          placeholder={placeholder}
          className="h-9"
        />
      )}
    </div>
  );
}
