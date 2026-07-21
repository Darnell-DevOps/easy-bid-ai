import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Lock,
  Mail,
  MessageSquare,
  Send,
  Slack,
  Wrench,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import WhatsAppSettings from "@/components/settings/WhatsAppSettings";
import MessagingHistory from "@/components/settings/MessagingHistory";
import { publicClientConfig } from "@/config/public-client-config";

type Status = "managed" | "attention" | "coming_soon";

type Integration = {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  description: string;
  purposes: string[];
  status: Status;
  managePath?: string;
  manageLabel?: string;
};

type Category = {
  id: string;
  label: string;
  description: string;
  items: Integration[];
};

const CATEGORIES: Category[] = [
  {
    id: "calendar",
    label: "Calendar",
    description: "Calendar account connections are not available yet.",
    items: [
      {
        id: "google_calendar",
        name: "Google Calendar",
        icon: Calendar,
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-400",
        description: "Two-way booking sync and availability detection are planned.",
        purposes: ["Booking sync", "Availability detection", "Meeting links"],
        status: "coming_soon",
      },
      {
        id: "outlook_calendar",
        name: "Outlook Calendar",
        icon: Calendar,
        iconBg: "bg-sky-500/10",
        iconColor: "text-sky-400",
        description: "Outlook booking sync and Teams meeting links are planned.",
        purposes: ["Booking sync", "Availability detection", "Teams links"],
        status: "coming_soon",
      },
    ],
  },
  {
    id: "email",
    label: "Email",
    description: "Transactional email is platform-managed; mailbox connections are planned.",
    items: [
      {
        id: "gmail",
        name: "Gmail",
        icon: Mail,
        iconBg: "bg-red-500/10",
        iconColor: "text-red-400",
        description: "Sending from and syncing a personal Gmail mailbox are not available yet.",
        purposes: ["Send from your address", "Conversation sync", "Inbox"],
        status: "coming_soon",
      },
      {
        id: "outlook_mail",
        name: "Outlook Email",
        icon: Mail,
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-400",
        description: "Sending from and syncing an Outlook mailbox are not available yet.",
        purposes: ["Send from your address", "Conversation sync", "Inbox"],
        status: "coming_soon",
      },
      {
        id: "resend",
        name: "Transactional email",
        icon: Send,
        iconBg: "bg-emerald-500/10",
        iconColor: "text-emerald-400",
        description: "CloseSync manages delivery for proposals, reminders and notifications. Configure your sender separately.",
        purposes: ["Transactional emails", "Reminders", "Custom sending domains"],
        status: "managed",
        managePath: "/dashboard/emails",
        manageLabel: "Manage email",
      },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    description: "Paddle processes plan billing, client payments and retainers.",
    items: [
      {
        id: "paddle",
        name: "Paddle payments",
        icon: CreditCard,
        iconBg: "bg-purple-500/10",
        iconColor: "text-purple-400",
        description: "Payments are configured for the CloseSync deployment rather than connected per user.",
        purposes: ["Client payments", "Subscriptions", "Retainers"],
        status: "managed",
        managePath: "/dashboard/billing",
        manageLabel: "Manage plan",
      },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    description: "External automation connectors are planned.",
    items: [
      {
        id: "make",
        name: "Make.com",
        icon: Zap,
        iconBg: "bg-fuchsia-500/10",
        iconColor: "text-fuchsia-400",
        description: "Trigger visual workflows from CloseSync events.",
        purposes: ["Workflow automation", "External app actions"],
        status: "coming_soon",
      },
      {
        id: "zapier",
        name: "Zapier",
        icon: Zap,
        iconBg: "bg-orange-500/10",
        iconColor: "text-orange-400",
        description: "Send CloseSync events to Zapier apps.",
        purposes: ["Workflow automation", "External app actions"],
        status: "coming_soon",
      },
    ],
  },
  {
    id: "communication",
    label: "Team notifications",
    description: "Workspace notification connectors are planned.",
    items: [
      {
        id: "slack",
        name: "Slack",
        icon: Slack,
        iconBg: "bg-indigo-500/10",
        iconColor: "text-indigo-400",
        description: "Post CloseSync notifications to a Slack workspace.",
        purposes: ["Workspace notifications", "Team alerts"],
        status: "coming_soon",
      },
      {
        id: "teams",
        name: "Microsoft Teams",
        icon: MessageSquare,
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-400",
        description: "Post CloseSync notifications to Teams channels.",
        purposes: ["Channel notifications", "Team alerts"],
        status: "coming_soon",
      },
    ],
  },
];

function displayStatus(integration: Integration): Status {
  if (
    integration.id === "paddle" &&
    !publicClientConfig.paymentsClientToken
  ) {
    return "attention";
  }
  return integration.status;
}

export default function IntegrationsSettings() {
  const hasPaymentClientToken = Boolean(publicClientConfig.paymentsClientToken);

  return (
    <div className="space-y-6">
      <WhatsAppSettings />
      <MessagingHistory />

      <Card>
        <CardContent className="p-5 flex items-start gap-3">
          <Wrench className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">How connections work</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Email delivery and payments are managed by CloseSync. Their cards do not claim provider health or offer simulated connect, sync, or disconnect actions. User-managed providers are marked coming soon until a real connection is available.
            </p>
            {!hasPaymentClientToken && (
              <p className="text-xs text-amber-400 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Payments need deployment configuration before checkout can open.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {CATEGORIES.map((category) => (
        <section key={category.id} className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{category.label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{category.description}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {category.items.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                status={displayStatus(integration)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function IntegrationCard({
  integration,
  status,
}: {
  integration: Integration;
  status: Status;
}) {
  const Icon = integration.icon;

  return (
    <Card className={status === "attention" ? "border-amber-500/40" : ""}>
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

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {integration.purposes.map((purpose) => (
            <li
              key={purpose}
              className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 px-2 py-0.5 rounded"
            >
              {purpose}
            </li>
          ))}
        </ul>

        <Separator className="my-4" />

        <div className="flex justify-end">
          {integration.managePath ? (
            <Button size="sm" variant="outline" asChild className="gap-1.5">
              <Link to={integration.managePath}>
                {integration.manageLabel} <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled className="gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Coming soon
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "managed") {
    return (
      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 gap-1">
        <CheckCircle2 className="w-2.5 h-2.5" /> Platform managed
      </Badge>
    );
  }
  if (status === "attention") {
    return (
      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 gap-1">
        <AlertTriangle className="w-2.5 h-2.5" /> Needs setup
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">
      Coming soon
    </Badge>
  );
}
