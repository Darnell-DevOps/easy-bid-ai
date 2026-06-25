import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import InboundEmailSettings from "@/components/settings/InboundEmailSettings";
import ProfileSettings from "@/components/settings/ProfileSettings";
import BrandingSettings from "@/components/settings/BrandingSettings";
import NotificationsSettings from "@/components/settings/NotificationsSettings";
import AutomationsSettings from "@/components/settings/AutomationsSettings";
import AiPreferencesSettings from "@/components/settings/AiPreferencesSettings";
import LeadAssistantSettings from "@/components/settings/LeadAssistantSettings";
import IntegrationsSettings from "@/components/settings/IntegrationsSettings";
import SecuritySettings from "@/components/settings/SecuritySettings";
import BillingSettings from "@/components/settings/BillingSettings";
import DataExportsSettings from "@/components/settings/DataExportsSettings";
import BusinessInformationSettings from "@/components/settings/BusinessInformationSettings";
import {
  User,
  Palette,
  Building2,
  Mail,
  Calendar,
  CreditCard,
  FileText,
  FileSignature,
  Globe,
  Bell,
  Zap,
  Sparkles,
  Plug,
  Shield,
  Receipt,
  Database,
  KeyRound,
  Sun,
  Moon,
  Lock,
  LifeBuoy,
  ExternalLink,
  ChevronRight,
  Search,
} from "lucide-react";

type SectionId =
  | "profile"
  | "branding"
  | "business"
  | "email"
  | "calendar"
  | "payments"
  | "proposals"
  | "contracts"
  | "portal"
  | "notifications"
  | "automations"
  | "ai"
  | "lead-assistant"
  | "integrations"
  | "security"
  | "billing"
  | "data";

type SectionGroup = {
  label: string;
  items: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[];
};

const SECTION_GROUPS: SectionGroup[] = [
  {
    label: "Account",
    items: [
      { id: "profile", label: "Profile", icon: User, description: "Your personal account details" },
      { id: "security", label: "Security", icon: Shield, description: "Password and account protection" },
      { id: "billing", label: "Billing", icon: Receipt, description: "Plan, usage and invoices" },
      { id: "notifications", label: "Notifications", icon: Bell, description: "How and when we contact you" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { id: "branding", label: "Branding", icon: Palette, description: "Logo, colours and proposal styling" },
      { id: "business", label: "Business Information", icon: Building2, description: "Company details shown to clients" },
      { id: "email", label: "Email", icon: Mail, description: "Sending domains and inbound replies" },
      { id: "calendar", label: "Calendar", icon: Calendar, description: "Availability and booking links" },
    ],
  },
  {
    label: "Product",
    items: [
      { id: "proposals", label: "Proposals", icon: FileText, description: "Defaults for new proposals" },
      { id: "contracts", label: "Contracts", icon: FileSignature, description: "Signing and contract defaults" },
      { id: "portal", label: "Client Portal", icon: Globe, description: "What your clients see" },
      { id: "payments", label: "Payments", icon: CreditCard, description: "Connect a payment processor" },
    ],
  },
  {
    label: "Advanced",
    items: [
      { id: "automations", label: "Automations", icon: Zap, description: "Follow-ups, reminders and triggers" },
      { id: "ai", label: "AI Preferences", icon: Sparkles, description: "Tone, model and assistant behaviour" },
      { id: "lead-assistant", label: "Lead Assistant", icon: Inbox, description: "Voice, signature, booking link and auto-send rules" },
      { id: "integrations", label: "Integrations", icon: Plug, description: "Third-party connections" },
      { id: "data", label: "Data & Exports", icon: Database, description: "Export, import and delete your data" },
    ],
  },
];

const ALL_SECTIONS = SECTION_GROUPS.flatMap((g) => g.items);

export default function SettingsPage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [active, setActive] = useState<SectionId>(() => {
    if (typeof window === "undefined") return "profile";
    const hash = window.location.hash.replace("#", "") as SectionId;
    return ALL_SECTIONS.some((s) => s.id === hash) ? hash : "profile";
  });
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [proposalCount, setProposalCount] = useState(0);
  const [loadingReset, setLoadingReset] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { count } = await supabase
          .from("proposals")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startOfMonth);
        setProposalCount(count || 0);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${active}`);
    }
  }, [active]);

  const handleResetPassword = async () => {
    setLoadingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoadingReset(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password reset email sent", description: "Check your inbox for the reset link." });
    }
  };

  const currentSection = ALL_SECTIONS.find((s) => s.id === active)!;

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SECTION_GROUPS;
    return SECTION_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  return (
    <DashboardLayout>
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, workspace and product preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-10">
        {/* Settings sidebar */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search settings"
              className="pl-9 h-9"
            />
          </div>

          {/* Mobile select-style top bar */}
          <div className="lg:hidden mb-4 -mx-1 overflow-x-auto">
            <div className="flex gap-2 px-1 pb-1">
              {ALL_SECTIONS.map((s) => {
                const isActive = s.id === active;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActive(s.id)}
                    className={`flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-md text-xs border transition-colors ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-accent"
                        : "bg-card text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    <s.icon className="w-3.5 h-3.5" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <nav className="hidden lg:block space-y-6">
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <p className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.id === active;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActive(item.id)}
                        className={`w-full group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40"
                        }`}
                      >
                        <item.icon className={`w-4 h-4 ${isActive ? "text-accent" : ""}`} />
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-opacity ${
                            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {filteredGroups.length === 0 && (
              <p className="px-2 text-xs text-muted-foreground">No settings match "{search}".</p>
            )}
          </nav>
        </aside>

        {/* Content area */}
        <div className="min-w-0 max-w-3xl">
          <div className="mb-6 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <currentSection.icon className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{currentSection.label}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{currentSection.description}</p>
            </div>
          </div>

          <div className="space-y-6">
            {active === "profile" && <ProfileSettings />}

            {active === "security" && <SecuritySettings />}

            {active === "billing" && <BillingSettings />}

            {active === "branding" && <BrandingSettings />}

            {active === "email" && <InboundEmailSettings />}

            {active === "notifications" && <NotificationsSettings />}

            {active === "business" && <BusinessInformationSettings />}
            {active === "calendar" && (
              <ComingSoonCard
                title="Calendar defaults"
                description="Manage availability, buffers and timezone defaults here. For now, edit per booking link on the Calendar page."
                action={{ label: "Go to Calendar", href: "/dashboard/calendar" }}
              />
            )}
            {active === "payments" && (
              <ComingSoonCard
                title="Payments"
                description="Connect Stripe or Paddle to accept payments on proposals, retainers and invoices."
              />
            )}
            {active === "proposals" && (
              <ComingSoonCard
                title="Proposal defaults"
                description="Set default currency, validity period, footer text and tone for newly generated proposals."
              />
            )}
            {active === "contracts" && (
              <ComingSoonCard
                title="Contract defaults"
                description="Default signing order, witness requirements, expiry windows and auto-reminders."
              />
            )}
            {active === "portal" && (
              <ComingSoonCard
                title="Client Portal"
                description="Customise the welcome message, accent colour and sections shown to clients in their portal."
              />
            )}
            {active === "automations" && <AutomationsSettings />}
            {active === "ai" && <AiPreferencesSettings />}
            {active === "integrations" && <IntegrationsSettings />}
            {active === "data" && <DataExportsSettings />}

            {/* Support always at bottom */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                    <LifeBuoy className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Need a hand?</h3>
                    <p className="text-xs text-muted-foreground">We usually reply within a few hours</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="gap-2 flex-1"
                    onClick={() => window.open("mailto:support@closesync.io", "_blank")}
                  >
                    <Mail className="w-4 h-4" /> Contact Support
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 flex-1"
                    onClick={() => toast({ title: "Coming soon", description: "Help centre is being built." })}
                  >
                    <ExternalLink className="w-4 h-4" /> Help & FAQ
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ToggleRow({
  title,
  description,
  defaultChecked,
}: {
  title: string;
  description: string;
  defaultChecked?: boolean;
}) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
}

function ComingSoonRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Badge variant="outline" className="text-xs">Coming soon</Badge>
    </div>
  );
}

function ComingSoonCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">
                Coming soon
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
            {action && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-2"
                onClick={() => (window.location.href = action.href)}
              >
                {action.label}
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
