import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  FileSignature,
  CreditCard,
  ClipboardList,
  Repeat,
  CalendarClock,
  Loader2,
  Sparkles,
  Zap,
  Check,
  Plug,
  Webhook,
  MessageSquare,
  Slack,
} from "lucide-react";

type AutomationDef = {
  id: string;
  label: string;
  description: string;
  defaultOn?: boolean;
};

type CategoryDef = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  items: AutomationDef[];
};

const CATEGORIES: CategoryDef[] = [
  {
    id: "proposals",
    label: "Proposal Automations",
    description: "Hands-off workflows that fire when proposals move through the pipeline.",
    icon: FileText,
    items: [
      { id: "proposal_auto_send", label: "Auto-send proposal email after proposal creation", description: "Skip the manual send step once a proposal is ready.", defaultOn: false },
      { id: "proposal_follow_up", label: "Create follow-up reminder after proposal sent", description: "Schedule a nudge if the client hasn't responded.", defaultOn: true },
      { id: "proposal_create_deadline", label: "Create deadline when proposal contains a timeline", description: "Detect dates in the proposal and add them to your calendar.", defaultOn: true },
      { id: "proposal_notify_viewed", label: "Notify me when proposal is viewed", description: "Get an instant ping the moment a client opens the document.", defaultOn: true },
      { id: "proposal_notify_expired", label: "Notify me when proposal expires", description: "So you can re-engage before the lead goes cold.", defaultOn: true },
    ],
  },
  {
    id: "contracts",
    label: "Contract Automations",
    description: "Reduce the manual chase between acceptance and signature.",
    icon: FileSignature,
    items: [
      { id: "contract_auto_generate", label: "Automatically generate contract after proposal acceptance", description: "Drafts a contract from the accepted proposal.", defaultOn: true },
      { id: "contract_auto_send", label: "Automatically send contract after proposal acceptance", description: "Emails the generated contract for signature.", defaultOn: false },
      { id: "contract_follow_up", label: "Create follow-up reminder if contract not signed", description: "Schedules a polite reminder after 48 hours.", defaultOn: true },
      { id: "contract_notify_signed", label: "Notify me when contract is signed", description: "Real-time alert in-app and via email.", defaultOn: true },
    ],
  },
  {
    id: "payments",
    label: "Payment Automations",
    description: "Keep cash moving without manual invoicing.",
    icon: CreditCard,
    items: [
      { id: "payment_auto_request", label: "Automatically send payment request after contract signing", description: "Triggers the first invoice immediately after sign-off.", defaultOn: true },
      { id: "payment_auto_confirmation", label: "Automatically send payment confirmation", description: "Receipt email to the client after a successful payment.", defaultOn: true },
      { id: "payment_notify_received", label: "Notify me when payment received", description: "Instant alert with amount and client.", defaultOn: true },
      { id: "payment_notify_failed", label: "Notify me when payment fails", description: "So you can reach out before the relationship stalls.", defaultOn: true },
      { id: "payment_follow_up_unpaid", label: "Create follow-up reminder for unpaid invoices", description: "Auto-schedules reminders 3 and 7 days after due.", defaultOn: true },
    ],
  },
  {
    id: "onboarding",
    label: "Onboarding Automations",
    description: "Get new clients started without lifting a finger.",
    icon: ClipboardList,
    items: [
      { id: "onboarding_auto_send", label: "Automatically send onboarding after payment", description: "Sends your onboarding form once the first invoice is paid.", defaultOn: true },
      { id: "onboarding_auto_task", label: "Automatically create onboarding task", description: "Adds an onboarding task to your dashboard for follow-through.", defaultOn: true },
      { id: "onboarding_notify_completed", label: "Notify me when onboarding completed", description: "Know the moment a client finishes the form.", defaultOn: true },
      { id: "onboarding_remind_client", label: "Remind client if onboarding not completed", description: "Sends a friendly reminder after 3 days of inactivity.", defaultOn: true },
    ],
  },
  {
    id: "retainers",
    label: "Retainer Automations",
    description: "Stay ahead of renewals and recurring revenue.",
    icon: Repeat,
    items: [
      { id: "retainer_renewal_reminder", label: "Create renewal reminder", description: "Adds a task 14 days before each renewal.", defaultOn: true },
      { id: "retainer_notify_before_renewal", label: "Notify me before retainer renewal", description: "Alerts you in-app and via email 3 days prior.", defaultOn: true },
      { id: "retainer_notify_failed", label: "Notify me when recurring payment fails", description: "Catch failed charges before they affect service.", defaultOn: true },
      { id: "retainer_generate_proposal_draft", label: "Generate renewal proposal draft", description: "AI drafts a renewal proposal based on the existing retainer.", defaultOn: false },
    ],
  },
  {
    id: "deadlines",
    label: "Deadline Automations",
    description: "Never miss a milestone — even ones you didn't add by hand.",
    icon: CalendarClock,
    items: [
      { id: "deadlines_from_contracts", label: "Automatically create deadlines from contracts", description: "Extracts dates from signed contracts.", defaultOn: true },
      { id: "deadlines_from_proposals", label: "Automatically create deadlines from proposals", description: "Extracts dates from accepted proposals.", defaultOn: true },
      { id: "deadlines_notify_before", label: "Notify me before deadlines", description: "Reminders at 7 days, 3 days and 1 day before.", defaultOn: true },
      { id: "deadlines_notify_overdue", label: "Notify me when deadlines become overdue", description: "Daily nudges until completed.", defaultOn: true },
    ],
  },
];

type PrefsMap = Record<string, boolean>;

function buildDefaults(): PrefsMap {
  const out: PrefsMap = {};
  CATEGORIES.forEach((c) => c.items.forEach((i) => { out[i.id] = !!i.defaultOn; }));
  return out;
}

export default function AutomationsSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<PrefsMap>(buildDefaults());
  const [original, setOriginal] = useState<PrefsMap>(buildDefaults());

  const dirty = useMemo(() => JSON.stringify(prefs) !== JSON.stringify(original), [prefs, original]);
  const enabledCount = useMemo(() => Object.values(prefs).filter(Boolean).length, [prefs]);
  const totalCount = useMemo(() => CATEGORIES.reduce((n, c) => n + c.items.length, 0), []);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await supabase
        .from("automation_preferences")
        .select("preferences")
        .eq("user_id", user.id)
        .maybeSingle();
      const defaults = buildDefaults();
      const merged = { ...defaults, ...((data?.preferences as PrefsMap) || {}) };
      setPrefs(merged);
      setOriginal(merged);
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

  const toggle = (id: string, value: boolean) => setPrefs((p) => ({ ...p, [id]: value }));
  const toggleAllInCategory = (cat: CategoryDef, value: boolean) => {
    setPrefs((p) => {
      const next = { ...p };
      cat.items.forEach((i) => { next[i.id] = value; });
      return next;
    });
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("automation_preferences")
      .upsert({ user_id: userId, preferences: prefs }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    setOriginal(prefs);
    toast({ title: "Automations saved", description: "Your workflow preferences are up to date." });
  };

  const discard = () => setPrefs(original);
  const resetDefaults = () => setPrefs(buildDefaults());

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
          <p className="text-sm text-foreground">You have unsaved automation changes.</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={discard} disabled={saving}>Discard</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* Summary */}
      <Card>
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {enabledCount} of {totalCount} automations active
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                CloseSync handles these workflows for you in the background.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-accent/30 text-accent gap-1">
            <Sparkles className="w-3 h-3" /> AI-assisted
          </Badge>
        </CardContent>
      </Card>

      {/* Active automations summary */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Active automations</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                What CloseSync is doing for you right now.
              </p>
            </div>
            <Badge variant="secondary" className="text-[10px]">{enabledCount} running</Badge>
          </div>
          {enabledCount === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No automations are active. Toggle any item below to let CloseSync run it for you.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {CATEGORIES.flatMap((c) => c.items.filter((i) => prefs[i.id]).map((i) => ({ cat: c, item: i })))
                .slice(0, 8)
                .map(({ cat, item }) => (
                  <li key={item.id} className="flex items-start gap-2.5 text-sm">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                    </div>
                    <span className="text-foreground/90">{item.label}</span>
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground flex-shrink-0">
                      {cat.label.replace(" Automations", "")}
                    </span>
                  </li>
                ))}
              {enabledCount > 8 && (
                <li className="text-xs text-muted-foreground pl-6 pt-1">
                  + {enabledCount - 8} more active
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Future integrations / delivery channels */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Plug className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Send automations elsewhere</h3>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                  Soon you'll be able to route any automation through external tools and channels.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">Coming soon</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FUTURE_CHANNELS.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-muted/20 opacity-70"
              >
                <ch.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground/80 truncate">{ch.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const allOn = cat.items.every((i) => prefs[i.id]);
        const onCount = cat.items.filter((i) => prefs[i.id]).length;
        return (
          <Card key={cat.id}>
            <CardContent className="p-0">
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{cat.label}</h3>
                      <Badge variant="secondary" className="text-[10px]">{onCount}/{cat.items.length} on</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleAllInCategory(cat, !allOn)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                >
                  {allOn ? "Disable all" : "Enable all"}
                </button>
              </div>
              <Separator />
              <div className="divide-y divide-border">
                {cat.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                    </div>
                    <Switch
                      checked={!!prefs[item.id]}
                      onCheckedChange={(v) => toggle(item.id, v)}
                      className="mt-0.5 flex-shrink-0"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={resetDefaults}>Reset to defaults</Button>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
