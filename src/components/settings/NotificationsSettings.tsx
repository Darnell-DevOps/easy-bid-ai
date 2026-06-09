import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  FileSignature,
  CreditCard,
  Repeat,
  ClipboardList,
  CalendarClock,
  CalendarCheck,
  Inbox,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Loader2,
  CheckCircle2,
  PoundSterling,
  AlertTriangle,
} from "lucide-react";

type Channel = "in_app" | "email" | "sms" | "whatsapp";

type EventDef = { id: string; label: string; description?: string };

type CategoryDef = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  events: EventDef[];
};

const CATEGORIES: CategoryDef[] = [
  {
    id: "proposals",
    label: "Proposals",
    icon: FileText,
    events: [
      { id: "proposal_viewed", label: "Proposal viewed" },
      { id: "proposal_accepted", label: "Proposal accepted" },
      { id: "proposal_rejected", label: "Proposal rejected" },
      { id: "proposal_expired", label: "Proposal expired" },
    ],
  },
  {
    id: "contracts",
    label: "Contracts",
    icon: FileSignature,
    events: [
      { id: "contract_sent", label: "Contract sent" },
      { id: "contract_viewed", label: "Contract viewed" },
      { id: "contract_signed", label: "Contract signed" },
      { id: "contract_expired", label: "Contract expired" },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    icon: CreditCard,
    events: [
      { id: "payment_received", label: "Payment received" },
      { id: "payment_failed", label: "Payment failed" },
      { id: "invoice_overdue", label: "Invoice overdue" },
      { id: "retainer_charged", label: "Retainer charged" },
      { id: "subscription_cancelled", label: "Subscription cancelled" },
    ],
  },
  {
    id: "retainers",
    label: "Retainers",
    icon: Repeat,
    events: [
      { id: "retainer_started", label: "Retainer started" },
      { id: "retainer_renewed", label: "Retainer renewed" },
      { id: "retainer_cancelled", label: "Retainer cancelled" },
    ],
  },
  {
    id: "onboarding",
    label: "Onboarding",
    icon: ClipboardList,
    events: [
      { id: "onboarding_started", label: "Onboarding started" },
      { id: "onboarding_completed", label: "Onboarding completed" },
      { id: "onboarding_overdue", label: "Onboarding overdue" },
    ],
  },
  {
    id: "deadlines",
    label: "Deadlines",
    icon: CalendarClock,
    events: [
      { id: "deadline_7d", label: "Deadline due in 7 days" },
      { id: "deadline_3d", label: "Deadline due in 3 days" },
      { id: "deadline_1d", label: "Deadline due tomorrow" },
      { id: "deadline_overdue", label: "Deadline overdue" },
    ],
  },
  {
    id: "bookings",
    label: "Bookings",
    icon: CalendarCheck,
    events: [
      { id: "booking_new", label: "New booking" },
      { id: "booking_cancelled", label: "Booking cancelled" },
      { id: "booking_rescheduled", label: "Booking rescheduled" },
    ],
  },
  {
    id: "leads",
    label: "Leads",
    icon: Inbox,
    events: [
      { id: "lead_new", label: "New lead received" },
      { id: "lead_ai_reply", label: "AI reply generated" },
      { id: "lead_awaiting", label: "Lead awaiting response" },
    ],
  },
  {
    id: "system",
    label: "System Notifications",
    icon: Bell,
    events: [
      { id: "system_announcements", label: "Product announcements" },
      { id: "system_security", label: "Security alerts" },
      { id: "system_billing", label: "Billing & plan updates" },
    ],
  },
];

const DEFAULTS_ON: Record<string, Partial<Record<Channel, boolean>>> = {
  proposal_accepted: { in_app: true, email: true },
  proposal_rejected: { in_app: true, email: true },
  proposal_viewed: { in_app: true, email: false },
  proposal_expired: { in_app: true, email: true },
  contract_signed: { in_app: true, email: true },
  contract_sent: { in_app: true, email: false },
  contract_viewed: { in_app: true, email: false },
  contract_expired: { in_app: true, email: true },
  payment_received: { in_app: true, email: true },
  payment_failed: { in_app: true, email: true },
  invoice_overdue: { in_app: true, email: true },
  retainer_charged: { in_app: true, email: false },
  subscription_cancelled: { in_app: true, email: true },
  retainer_started: { in_app: true, email: true },
  retainer_renewed: { in_app: true, email: false },
  retainer_cancelled: { in_app: true, email: true },
  onboarding_started: { in_app: true, email: false },
  onboarding_completed: { in_app: true, email: true },
  onboarding_overdue: { in_app: true, email: true },
  deadline_7d: { in_app: true, email: false },
  deadline_3d: { in_app: true, email: true },
  deadline_1d: { in_app: true, email: true },
  deadline_overdue: { in_app: true, email: true },
  booking_new: { in_app: true, email: true },
  booking_cancelled: { in_app: true, email: true },
  booking_rescheduled: { in_app: true, email: true },
  lead_new: { in_app: true, email: true },
  lead_ai_reply: { in_app: true, email: false },
  lead_awaiting: { in_app: true, email: true },
  system_announcements: { in_app: true, email: false },
  system_security: { in_app: true, email: true },
  system_billing: { in_app: true, email: true },
};

type PrefsMap = Record<string, Partial<Record<Channel, boolean>>>;

function buildDefaults(): PrefsMap {
  const out: PrefsMap = {};
  CATEGORIES.forEach((c) =>
    c.events.forEach((e) => {
      out[e.id] = {
        in_app: DEFAULTS_ON[e.id]?.in_app ?? true,
        email: DEFAULTS_ON[e.id]?.email ?? false,
        sms: false,
        whatsapp: false,
      };
    }),
  );
  return out;
}

export default function NotificationsSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<PrefsMap>(buildDefaults());
  const [original, setOriginal] = useState<PrefsMap>(buildDefaults());

  const dirty = useMemo(() => JSON.stringify(prefs) !== JSON.stringify(original), [prefs, original]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      const { data } = await supabase
        .from("notification_preferences")
        .select("preferences")
        .eq("user_id", user.id)
        .maybeSingle();
      const defaults = buildDefaults();
      const merged = { ...defaults, ...(((data?.preferences as PrefsMap) || {})) };
      // ensure all events present
      for (const k of Object.keys(defaults)) {
        merged[k] = { ...defaults[k], ...(merged[k] || {}) };
      }
      setPrefs(merged);
      setOriginal(merged);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const setChannel = (eventId: string, channel: Channel, value: boolean) => {
    setPrefs((p) => ({ ...p, [eventId]: { ...p[eventId], [channel]: value } }));
  };

  const toggleCategoryAll = (cat: CategoryDef, channel: Channel, value: boolean) => {
    setPrefs((p) => {
      const next = { ...p };
      cat.events.forEach((e) => {
        next[e.id] = { ...next[e.id], [channel]: value };
      });
      return next;
    });
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, preferences: prefs }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    setOriginal(prefs);
    toast({ title: "Preferences saved", description: "Your notification settings are up to date." });
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
          <p className="text-sm text-foreground">You have unsaved notification changes.</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={discard} disabled={saving}>Discard</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* Channel legend */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium text-foreground text-sm">Delivery channels</span>
            <span className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> In-App</span>
            <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</span>
            <span className="flex items-center gap-1.5 opacity-50"><Smartphone className="w-3.5 h-3.5" /> SMS <Badge variant="outline" className="text-[9px] ml-1">Soon</Badge></span>
            <span className="flex items-center gap-1.5 opacity-50"><MessageSquare className="w-3.5 h-3.5" /> WhatsApp <Badge variant="outline" className="text-[9px] ml-1">Soon</Badge></span>
          </div>
        </CardContent>
      </Card>

      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const allInApp = cat.events.every((e) => prefs[e.id]?.in_app);
        const allEmail = cat.events.every((e) => prefs[e.id]?.email);
        return (
          <Card key={cat.id}>
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{cat.label}</h3>
                    <p className="text-xs text-muted-foreground">{cat.events.length} event types</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                  <button onClick={() => toggleCategoryAll(cat, "in_app", !allInApp)} className="hover:text-foreground transition-colors">
                    {allInApp ? "Disable all in-app" : "Enable all in-app"}
                  </button>
                  <button onClick={() => toggleCategoryAll(cat, "email", !allEmail)} className="hover:text-foreground transition-colors">
                    {allEmail ? "Disable all email" : "Enable all email"}
                  </button>
                </div>
              </div>
              <Separator />
              <div className="divide-y divide-border">
                <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px_80px] gap-3 px-5 py-2 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                  <span>Event</span>
                  <span className="text-center">In-App</span>
                  <span className="text-center">Email</span>
                  <span className="text-center opacity-50">SMS</span>
                  <span className="text-center opacity-50">WhatsApp</span>
                </div>
                {cat.events.map((ev) => {
                  const p = prefs[ev.id] || {};
                  return (
                    <div
                      key={ev.id}
                      className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_80px_80px_80px_80px] gap-3 px-5 py-3 items-center"
                    >
                      <div>
                        <p className="text-sm text-foreground">{ev.label}</p>
                      </div>
                      <div className="flex sm:contents items-center gap-4">
                        <div className="flex justify-center sm:justify-self-center">
                          <Switch checked={!!p.in_app} onCheckedChange={(v) => setChannel(ev.id, "in_app", v)} />
                        </div>
                        <div className="flex justify-center sm:justify-self-center">
                          <Switch checked={!!p.email} onCheckedChange={(v) => setChannel(ev.id, "email", v)} />
                        </div>
                        <div className="hidden sm:flex justify-center">
                          <Switch checked={false} disabled />
                        </div>
                        <div className="hidden sm:flex justify-center">
                          <Switch checked={false} disabled />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Notification Centre Preview */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Notification Centre Preview</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Examples of how notifications appear in CloseSync.
          </p>
          <div className="rounded-lg border border-border bg-background/50 divide-y divide-border">
            <PreviewRow icon={CheckCircle2} tone="text-emerald-400" title="Proposal accepted by Sarah Chen" meta="2 min ago · Brand strategy retainer" />
            <PreviewRow icon={PoundSterling} tone="text-emerald-400" title="Payment received — £1,200.00" meta="14 min ago · Acme Co" />
            <PreviewRow icon={FileSignature} tone="text-accent" title="Contract signed by James Patel" meta="1 hr ago · Website redesign agreement" />
            <PreviewRow icon={AlertTriangle} tone="text-amber-400" title="Deadline due tomorrow" meta="Logo concepts · Atlas Studio" />
            <PreviewRow icon={Inbox} tone="text-blue-400" title="New lead from contact form" meta="3 hrs ago · awaiting response" />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={resetDefaults}>
          Reset to defaults
        </Button>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

function PreviewRow({
  icon: Icon,
  tone,
  title,
  meta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  meta: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3">
      <div className={`w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0 ${tone}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-foreground truncate">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
      </div>
    </div>
  );
}
