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
  Sparkles,
  Loader2,
  FileText,
  FileSignature,
  Mail,
  Inbox,
  Building2,
  Wand2,
  RefreshCw,
} from "lucide-react";

type Prefs = {
  default_tone: string;
  proposal_length: string;
  proposal_style: string;
  contract_detail: string;
  contract_include_payment_terms: boolean;
  contract_include_revision_limits: boolean;
  contract_include_cancellation: boolean;
  lead_reply_tone: string;
  lead_reply_length: string;
  email_tone: string;
  email_length: string;
  business_what_you_do: string;
  business_services: string;
  business_target_audience: string;
  business_ideal_client: string;
  custom_instructions: string;
};

const DEFAULTS: Prefs = {
  default_tone: "professional",
  proposal_length: "standard",
  proposal_style: "professional",
  contract_detail: "standard",
  contract_include_payment_terms: true,
  contract_include_revision_limits: true,
  contract_include_cancellation: true,
  lead_reply_tone: "friendly",
  lead_reply_length: "standard",
  email_tone: "professional",
  email_length: "standard",
  business_what_you_do: "",
  business_services: "",
  business_target_audience: "",
  business_ideal_client: "",
  custom_instructions: "",
};

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
  { value: "consultative", label: "Consultative" },
  { value: "sales", label: "Sales-Focused" },
  { value: "premium", label: "Premium / Luxury" },
  { value: "technical", label: "Technical" },
];

const LENGTHS = [
  { value: "short", label: "Short" },
  { value: "standard", label: "Standard" },
  { value: "detailed", label: "Detailed" },
];

const PROPOSAL_STYLES = [
  { value: "direct", label: "Direct & Concise" },
  { value: "professional", label: "Professional" },
  { value: "consultative", label: "Consultative" },
  { value: "premium", label: "Premium Agency" },
];

const CONTRACT_DETAILS = [
  { value: "simple", label: "Simple Contracts" },
  { value: "standard", label: "Standard Contracts" },
  { value: "detailed", label: "Detailed Contracts" },
];

const LEAD_TONES = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "consultative", label: "Consultative" },
  { value: "sales", label: "Sales-Focused" },
];

const EMAIL_TONES = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "formal", label: "Formal" },
];

type Previews = {
  proposal_intro?: string;
  lead_response?: string;
  follow_up_email?: string;
};

export default function AiPreferencesSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [original, setOriginal] = useState<Prefs>(DEFAULTS);
  const [previews, setPreviews] = useState<Previews>({});

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

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

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
    toast({ title: "AI preferences saved", description: "Your assistant will use these settings from now on." });
  };

  const discard = () => setPrefs(original);
  const resetDefaults = () => setPrefs(DEFAULTS);

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-preview", { body: { prefs } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setPreviews((data || {}) as Previews);
    } catch (e) {
      toast({
        title: "Preview failed",
        description: e instanceof Error ? e.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setPreviewing(false);
    }
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
          <p className="text-sm text-foreground">You have unsaved AI preferences.</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={discard} disabled={saving}>Discard</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* AI Writing Tone */}
      <SettingsSection
        icon={Sparkles}
        title="Default AI Tone"
        description="The base writing voice used everywhere unless a section overrides it."
      >
        <div className="max-w-xs">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Tone</Label>
          <SelectField value={prefs.default_tone} onChange={(v) => set("default_tone", v)} options={TONES} />
        </div>
      </SettingsSection>

      {/* Proposal Generation */}
      <SettingsSection
        icon={FileText}
        title="Proposal Generation Style"
        description="Controls how AI writes new proposals."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Length</Label>
            <SelectField value={prefs.proposal_length} onChange={(v) => set("proposal_length", v)} options={LENGTHS} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Style</Label>
            <SelectField value={prefs.proposal_style} onChange={(v) => set("proposal_style", v)} options={PROPOSAL_STYLES} />
          </div>
        </div>
      </SettingsSection>

      {/* Contract Generation */}
      <SettingsSection
        icon={FileSignature}
        title="Contract Generation Preferences"
        description="Defaults applied to AI-generated contracts."
      >
        <div className="max-w-xs mb-4">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Detail level</Label>
          <SelectField value={prefs.contract_detail} onChange={(v) => set("contract_detail", v)} options={CONTRACT_DETAILS} />
        </div>
        <Separator className="mb-3" />
        <ToggleRow
          label="Include payment terms automatically"
          checked={prefs.contract_include_payment_terms}
          onChange={(v) => set("contract_include_payment_terms", v)}
        />
        <ToggleRow
          label="Include revision limits automatically"
          checked={prefs.contract_include_revision_limits}
          onChange={(v) => set("contract_include_revision_limits", v)}
        />
        <ToggleRow
          label="Include cancellation clauses automatically"
          checked={prefs.contract_include_cancellation}
          onChange={(v) => set("contract_include_cancellation", v)}
        />
      </SettingsSection>

      {/* Lead Response */}
      <SettingsSection
        icon={Inbox}
        title="Lead Response Preferences"
        description="How AI replies to new leads on your behalf."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Tone</Label>
            <SelectField value={prefs.lead_reply_tone} onChange={(v) => set("lead_reply_tone", v)} options={LEAD_TONES} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Length</Label>
            <SelectField value={prefs.lead_reply_length} onChange={(v) => set("lead_reply_length", v)} options={LENGTHS} />
          </div>
        </div>
      </SettingsSection>

      {/* Email Generation */}
      <SettingsSection
        icon={Mail}
        title="Email Generation Preferences"
        description="Used for onboarding, proposal, contract and follow-up emails."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Tone</Label>
            <SelectField value={prefs.email_tone} onChange={(v) => set("email_tone", v)} options={EMAIL_TONES} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Length</Label>
            <SelectField value={prefs.email_length} onChange={(v) => set("email_length", v)} options={LENGTHS} />
          </div>
        </div>
      </SettingsSection>

      {/* Business Context */}
      <SettingsSection
        icon={Building2}
        title="My Business"
        description="Used as context whenever AI generates content. The more detail, the more personalised the output."
        highlight
      >
        <div className="space-y-4">
          <Field
            label="What you do"
            placeholder="e.g. I run a brand strategy studio for early-stage SaaS founders."
            value={prefs.business_what_you_do}
            onChange={(v) => set("business_what_you_do", v)}
            max={500}
            multiline
          />
          <Field
            label="Services offered"
            placeholder="e.g. Brand identity, messaging frameworks, website copy."
            value={prefs.business_services}
            onChange={(v) => set("business_services", v)}
            max={500}
            multiline
          />
          <Field
            label="Target audience"
            placeholder="e.g. B2B SaaS companies with 5–50 employees."
            value={prefs.business_target_audience}
            onChange={(v) => set("business_target_audience", v)}
            max={300}
          />
          <Field
            label="Ideal client"
            placeholder="e.g. Technical founders raising seed/Series A who care about brand."
            value={prefs.business_ideal_client}
            onChange={(v) => set("business_ideal_client", v)}
            max={300}
          />
        </div>
      </SettingsSection>

      {/* Custom AI Instructions */}
      <SettingsSection
        icon={Wand2}
        title="Additional AI Instructions"
        description='Free-form rules the AI should follow. Examples: "Always write in British English." · "Never use aggressive sales language."'
      >
        <Textarea
          value={prefs.custom_instructions}
          onChange={(e) => set("custom_instructions", e.target.value.slice(0, 1500))}
          placeholder="Add any specific writing rules, vocabulary preferences or things to avoid…"
          rows={4}
        />
        <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
          {prefs.custom_instructions.length} / 1500
        </p>
      </SettingsSection>

      {/* AI Preview */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">AI Preview</h3>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                  See how the assistant writes with your current settings. Save first for the most accurate results.
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={runPreview} disabled={previewing} className="gap-2 flex-shrink-0">
              {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {previewing ? "Generating…" : previews.proposal_intro ? "Regenerate" : "Generate preview"}
            </Button>
          </div>

          <div className="space-y-3">
            <PreviewBlock label="Proposal introduction" icon={FileText} text={previews.proposal_intro} loading={previewing} />
            <PreviewBlock label="Lead response" icon={Inbox} text={previews.lead_response} loading={previewing} />
            <PreviewBlock label="Follow-up email" icon={Mail} text={previews.follow_up_email} loading={previewing} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={resetDefaults}>Reset to defaults</Button>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-accent/40" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              {highlight && (
                <Badge variant="outline" className="text-[10px] border-accent/40 text-accent">Powers all AI</Badge>
              )}
            </div>
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
      <SelectTrigger className="h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-foreground">{label}</span>
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
          rows={2}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(max ? e.target.value.slice(0, max) : e.target.value)}
          placeholder={placeholder}
          className="h-9"
        />
      )}
      {max && (
        <p className="text-[10px] text-muted-foreground mt-1 text-right">
          {value.length} / {max}
        </p>
      )}
    </div>
  );
}

function PreviewBlock({
  label,
  icon: Icon,
  text,
  loading,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  text?: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-accent" />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      {loading && !text ? (
        <div className="space-y-1.5">
          <div className="h-3 bg-muted/60 rounded animate-pulse w-full" />
          <div className="h-3 bg-muted/60 rounded animate-pulse w-11/12" />
          <div className="h-3 bg-muted/60 rounded animate-pulse w-3/4" />
        </div>
      ) : text ? (
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{text}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">Click "Generate preview" to see a sample.</p>
      )}
    </div>
  );
}
