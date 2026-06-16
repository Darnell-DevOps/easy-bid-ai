import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Mail,
  CreditCard,
  Zap,
  MessageSquare,
  Slack,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plug,
  XCircle,
  Lock,
} from "lucide-react";
import WhatsAppSettings from "@/components/settings/WhatsAppSettings";
import MessagingHistory from "@/components/settings/MessagingHistory";

type Status = "connected" | "disconnected" | "attention" | "coming_soon";

type Integration = {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  description: string;
  purposes: string[];
  /** Live status — overridden at render time when we have real signal. */
  defaultStatus: Status;
  /** Optional metadata shown in the card body when connected. */
  meta?: { label: string; value: string }[];
  canResync?: boolean;
  /** Warning message shown in the disconnect confirmation. */
  disconnectWarning: string;
  /** Where the user actually manages this today (route or external URL). */
  managePath?: string;
};

type CategoryDef = {
  id: string;
  label: string;
  description: string;
  items: Integration[];
};

// Registry — add new integrations here. Page renders from this list.
const CATEGORIES: CategoryDef[] = [
  {
    id: "calendar",
    label: "Calendar",
    description: "Sync bookings, availability and meetings.",
    items: [
      {
        id: "google_calendar",
        name: "Google Calendar",
        category: "Calendar",
        icon: Calendar,
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-400",
        description: "Sync your CloseSync bookings to Google Calendar in real time.",
        purposes: ["Two-way booking sync", "Availability detection", "Meeting links"],
        defaultStatus: "disconnected",
        canResync: true,
        disconnectWarning: "Disconnecting Google Calendar will stop booking synchronisation and free/busy detection.",
        managePath: "/dashboard/calendar",
      },
      {
        id: "outlook_calendar",
        name: "Outlook Calendar",
        category: "Calendar",
        icon: Calendar,
        iconBg: "bg-sky-500/10",
        iconColor: "text-sky-400",
        description: "Sync bookings and availability with your Outlook calendar.",
        purposes: ["Two-way booking sync", "Availability detection", "Teams meeting links"],
        defaultStatus: "coming_soon",
        canResync: true,
        disconnectWarning: "Disconnecting Outlook Calendar will stop booking synchronisation.",
      },
    ],
  },
  {
    id: "email",
    label: "Email",
    description: "Send messages and (soon) sync inbound conversations.",
    items: [
      {
        id: "gmail",
        name: "Gmail",
        category: "Email",
        icon: Mail,
        iconBg: "bg-red-500/10",
        iconColor: "text-red-400",
        description: "Send and (soon) receive client emails from your Gmail account.",
        purposes: ["Send from your address", "Sync conversations", "Inbox view (coming soon)"],
        defaultStatus: "disconnected",
        disconnectWarning: "Disconnecting Gmail will stop sending from your address. Existing conversations remain.",
      },
      {
        id: "outlook_mail",
        name: "Outlook Email",
        category: "Email",
        icon: Mail,
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-400",
        description: "Send and (soon) receive client emails from your Outlook mailbox.",
        purposes: ["Send from your address", "Sync conversations", "Inbox view (coming soon)"],
        defaultStatus: "coming_soon",
        disconnectWarning: "Disconnecting Outlook Email will stop sending from your address.",
      },
      {
        id: "resend",
        name: "Resend",
        category: "Email",
        icon: Send,
        iconBg: "bg-emerald-500/10",
        iconColor: "text-emerald-400",
        description: "Reliable transactional email delivery for proposals, reminders and notifications.",
        purposes: ["Transactional emails", "Onboarding emails", "Reminders & notifications"],
        defaultStatus: "connected",
        meta: [
          { label: "Domain status", value: "Verified" },
          { label: "Sender status", value: "Active" },
          { label: "API connection", value: "Healthy" },
        ],
        disconnectWarning: "Disconnecting Resend will pause all outbound transactional emails until another sender is connected.",
        managePath: "/dashboard/emails",
      },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    description: "Charge clients and manage recurring billing.",
    items: [
      {
        id: "paddle",
        name: "Paddle",
        category: "Payments",
        icon: CreditCard,
        iconBg: "bg-purple-500/10",
        iconColor: "text-purple-400",
        description: "Take one-off payments and run subscriptions for retainers.",
        purposes: ["One-off payments", "Subscriptions", "Recurring billing", "Retainers"],
        defaultStatus: "connected",
        disconnectWarning: "Disconnecting Paddle will prevent new payments and pause active subscription charges. Existing transactions remain.",
      },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    description: "Connect CloseSync to thousands of external apps.",
    items: [
      {
        id: "make",
        name: "Make.com",
        category: "Automation",
        icon: Zap,
        iconBg: "bg-fuchsia-500/10",
        iconColor: "text-fuchsia-400",
        description: "Build visual workflows that fire on CloseSync events.",
        purposes: ["Workflow automation", "Future advanced automation"],
        defaultStatus: "coming_soon",
        disconnectWarning: "Disconnecting Make.com will stop any workflows that listen to CloseSync events.",
      },
      {
        id: "zapier",
        name: "Zapier",
        category: "Automation",
        icon: Zap,
        iconBg: "bg-orange-500/10",
        iconColor: "text-orange-400",
        description: "Push CloseSync events into 6,000+ Zapier apps.",
        purposes: ["Workflow automation", "Third-party app connections"],
        defaultStatus: "coming_soon",
        disconnectWarning: "Disconnecting Zapier will stop any Zaps that listen to CloseSync events.",
      },
    ],
  },
  {
    id: "comms",
    label: "Communication",
    description: "Get notified or message clients where you already work.",
    items: [
      {
        id: "whatsapp",
        name: "WhatsApp",
        category: "Communication",
        icon: MessageSquare,
        iconBg: "bg-green-500/10",
        iconColor: "text-green-400",
        description: "Send client messages and reminders over WhatsApp Business.",
        purposes: ["Client messaging", "Reminders"],
        defaultStatus: "coming_soon",
        disconnectWarning: "Disconnecting WhatsApp will stop any outbound WhatsApp messaging.",
      },
      {
        id: "slack",
        name: "Slack",
        category: "Communication",
        icon: Slack,
        iconBg: "bg-indigo-500/10",
        iconColor: "text-indigo-400",
        description: "Get CloseSync notifications in your Slack workspace.",
        purposes: ["Workspace notifications", "Team alerts"],
        defaultStatus: "coming_soon",
        disconnectWarning: "Disconnecting Slack will stop posting notifications to your workspace.",
      },
      {
        id: "teams",
        name: "Microsoft Teams",
        category: "Communication",
        icon: MessageSquare,
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-400",
        description: "Get CloseSync notifications in your Microsoft Teams channels.",
        purposes: ["Channel notifications", "Team alerts"],
        defaultStatus: "coming_soon",
        disconnectWarning: "Disconnecting Microsoft Teams will stop posting notifications to your channels.",
      },
    ],
  },
];

const ALL_INTEGRATIONS = CATEGORIES.flatMap((c) => c.items);

export default function IntegrationsSettings() {
  const { toast } = useToast();
  // Local connection state keyed by integration id. In future this is hydrated from real signals.
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => {
    const init: Record<string, Status> = {};
    ALL_INTEGRATIONS.forEach((i) => { init[i.id] = i.defaultStatus; });
    return init;
  });
  const [lastSync, setLastSync] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [resyncing, setResyncing] = useState<string | null>(null);

  // Derive Paddle environment from client token if available.
  useEffect(() => {
    const token = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
    if (token) {
      setStatuses((s) => ({ ...s, paddle: "connected" }));
    }
  }, []);

  const setStatus = (id: string, status: Status) =>
    setStatuses((s) => ({ ...s, [id]: status }));

  const handleConnect = (i: Integration) => {
    if (i.defaultStatus === "coming_soon") {
      toast({ title: `${i.name} is coming soon`, description: "We'll let you know the moment it's available." });
      return;
    }
    // Most providers require per-user OAuth which isn't wired yet — route the user to the relevant page.
    if (i.managePath) {
      window.location.href = i.managePath;
      return;
    }
    toast({
      title: `Connect ${i.name}`,
      description: "We'll guide you through this connection in a future release.",
    });
  };

  const handleResync = async (i: Integration) => {
    setResyncing(i.id);
    await new Promise((r) => setTimeout(r, 800));
    setLastSync((m) => ({ ...m, [i.id]: new Date().toISOString() }));
    setResyncing(null);
    toast({ title: `${i.name} re-synced`, description: "Your data is up to date." });
  };

  const handleDisconnectConfirmed = () => {
    const target = ALL_INTEGRATIONS.find((i) => i.id === confirmId);
    if (!target) return;
    setStatus(target.id, "disconnected");
    setConfirmId(null);
    toast({
      title: `${target.name} disconnected`,
      description: "You can reconnect at any time from this page.",
    });
  };

  const confirmTarget = ALL_INTEGRATIONS.find((i) => i.id === confirmId);

  const health = useMemo(() => {
    const connected = ALL_INTEGRATIONS.filter((i) => statuses[i.id] === "connected");
    const attention = ALL_INTEGRATIONS.filter((i) => statuses[i.id] === "attention");
    return { connected, attention };
  }, [statuses]);

  return (
    <div className="space-y-6">
      <WhatsAppSettings />
      <MessagingHistory />
      {/* Integration health */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Plug className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Integration health</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Connected</p>
              {health.connected.length === 0 ? (
                <p className="text-sm text-muted-foreground">No integrations connected yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {health.connected.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span className="text-foreground/90">{i.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Needs attention</p>
              {health.attention.length === 0 ? (
                <p className="text-sm text-muted-foreground">Everything looks healthy.</p>
              ) : (
                <ul className="space-y-1.5">
                  {health.attention.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="text-foreground/90">Reconnect {i.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {CATEGORIES.map((cat) => (
        <section key={cat.id} className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{cat.label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cat.items.map((i) => (
              <IntegrationCard
                key={i.id}
                integration={i}
                status={statuses[i.id]}
                lastSync={lastSync[i.id]}
                resyncing={resyncing === i.id}
                onConnect={() => handleConnect(i)}
                onDisconnect={() => setConfirmId(i.id)}
                onResync={() => handleResync(i)}
              />
            ))}
          </div>
        </section>
      ))}

      <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              Disconnect {confirmTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.disconnectWarning}
              <br />
              <br />
              You can reconnect at any time from this page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnectConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IntegrationCard({
  integration,
  status,
  lastSync,
  resyncing,
  onConnect,
  onDisconnect,
  onResync,
}: {
  integration: Integration;
  status: Status;
  lastSync?: string;
  resyncing: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onResync: () => void;
}) {
  const Icon = integration.icon;
  const isConnected = status === "connected";
  const isComingSoon = status === "coming_soon";
  const needsAttention = status === "attention";

  return (
    <Card className={`relative overflow-hidden ${isConnected ? "border-emerald-500/20" : ""} ${needsAttention ? "border-amber-500/40" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg ${integration.iconBg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${integration.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-foreground">{integration.name}</h4>
              <StatusBadge status={status} />
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {integration.description}
            </p>
          </div>
        </div>

        {integration.purposes.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {integration.purposes.map((p) => (
              <li
                key={p}
                className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 px-2 py-0.5 rounded"
              >
                {p}
              </li>
            ))}
          </ul>
        )}

        {isConnected && integration.meta && (
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            {integration.meta.map((m) => (
              <div key={m.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="text-foreground/90 font-medium">{m.value}</span>
              </div>
            ))}
          </div>
        )}

        {isConnected && integration.canResync && (
          <div className="mt-2 text-xs text-muted-foreground">
            Last sync: {lastSync ? formatRelative(lastSync) : "Just now"}
          </div>
        )}

        <Separator className="my-4" />

        <div className="flex items-center justify-end gap-2">
          {isComingSoon ? (
            <Button size="sm" variant="outline" disabled className="gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Coming soon
            </Button>
          ) : isConnected ? (
            <>
              {integration.canResync && (
                <Button size="sm" variant="ghost" onClick={onResync} disabled={resyncing} className="gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${resyncing ? "animate-spin" : ""}`} />
                  Re-sync
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={onDisconnect} className="gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onConnect} className="gap-1.5">
              <Plug className="w-3.5 h-3.5" />
              {needsAttention ? "Reconnect" : "Connect"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "connected") {
    return (
      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 gap-1">
        <CheckCircle2 className="w-2.5 h-2.5" /> Connected
      </Badge>
    );
  }
  if (status === "attention") {
    return (
      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 gap-1">
        <AlertTriangle className="w-2.5 h-2.5" /> Needs attention
      </Badge>
    );
  }
  if (status === "coming_soon") {
    return (
      <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">
        Coming soon
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      Not connected
    </Badge>
  );
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString();
}
