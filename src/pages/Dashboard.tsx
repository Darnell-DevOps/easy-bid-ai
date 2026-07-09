import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import AttentionCenter from "@/components/dashboard/AttentionCenter";
import ConversionPipeline from "@/components/dashboard/ConversionPipeline";
import BusinessPulse from "@/components/dashboard/BusinessPulse";
import UpcomingAndRecent from "@/components/dashboard/UpcomingAndRecent";
import ActivationChecklist from "@/components/dashboard/ActivationChecklist";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getOnboardingKey } from "@/pages/Onboarding";

interface FullProposal {
  id: string;
  client_name: string;
  company_name: string;
  service_type: string;
  created_at: string;
  proposal_content: string | null;
  invoice_content: string | null;
  budget: string;
  client_paid: boolean;
  status?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  paid_at?: string | null;
}

interface ClientLite {
  id: string;
  name: string;
  status: string;
  created_at: string;
  company?: string | null;
  service_requested?: string | null;
  budget?: string | null;
  timeline?: string | null;
  goals?: string | null;
  project_description?: string | null;
  lead_score?: string | null;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<FullProposal[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [firstName, setFirstName] = useState<string>("");

  const fetchData = async () => {
    const [propRes, clientRes, userRes] = await Promise.all([
      supabase
        .from("proposals")
        .select(
          "id, client_name, company_name, service_type, created_at, proposal_content, invoice_content, budget, client_paid, status, sent_at, viewed_at, accepted_at, rejected_at, paid_at",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("id, name, status, created_at, company, service_requested, budget, timeline, goals, project_description, lead_score")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase.auth.getUser(),
    ]);
    setProposals(propRes.data || []);
    setClients(clientRes.data || []);

    const user = userRes.data.user;
    if (user) {
      // Prefer user_profiles.first_name → user_metadata → email local part (skip generic "admin")
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("first_name, last_name, business_name")
        .eq("user_id", user.id)
        .maybeSingle();
      const meta = (user.user_metadata as any) || {};
      const raw: string =
        (prof?.first_name || "").trim() ||
        (meta.full_name || meta.name || "").split(" ")[0] ||
        "";
      const first = raw && raw.toLowerCase() !== "admin" ? raw : "";
      setFirstName(first);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Redirect first-time users to onboarding
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const done = localStorage.getItem(getOnboardingKey(user.id));
      const params = new URLSearchParams(window.location.search);
      if (!done && params.get("onboarded") !== "1") {
        navigate("/onboarding", { replace: true });
      }
    });
  }, [navigate]);

  const proposalClientNames = useMemo(
    () => new Set(proposals.map((p) => p.client_name.toLowerCase().trim())),
    [proposals],
  );

  // Contextual primary CTA
  const primaryCta = useMemo(() => {
    const acceptedUnpaid = proposals.some(
      (p) => (p.status || "").toLowerCase() === "accepted" && !p.client_paid,
    );
    if (acceptedUnpaid) {
      const first = proposals.find(
        (p) => (p.status || "").toLowerCase() === "accepted" && !p.client_paid,
      )!;
      return { label: "Request payment", href: `/dashboard/proposal/${first.id}`, icon: null };
    }
    if (proposals.length === 0 && clients.length === 0) {
      return { label: "Add first lead", href: "/dashboard/clients/new", icon: UserPlus };
    }
    // Warm/hot lead without proposal → nudge to proposal
    const hotLead = clients.find(
      (c) =>
        (c.status || "").toLowerCase() === "new" &&
        !proposalClientNames.has(c.name.toLowerCase().trim()),
    );
    if (hotLead) {
      return { label: "New lead", href: "/dashboard/clients/new", icon: UserPlus };
    }
    return { label: "New lead", href: "/dashboard/clients/new", icon: UserPlus };
  }, [proposals, clients, proposalClientNames]);

  const CtaIcon = primaryCta.icon;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {greeting()}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              Here's what needs your attention and where your next revenue could come from.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="h-11 px-5 gap-2 self-start sm:self-auto shrink-0"
          >
            <Link to={primaryCta.href}>
              {CtaIcon && <CtaIcon className="w-4 h-4" />}
              {primaryCta.label}
            </Link>
          </Button>
        </header>

        <ActivationChecklist />

        {/* MAIN ROW: Attention + Business Pulse */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <AttentionCenter
              proposals={proposals}
              clients={clients}
              proposalClientNames={proposalClientNames}
            />
          </div>
          <div className="lg:col-span-4">
            <BusinessPulse proposals={proposals} />
          </div>
        </div>

        {/* CONVERSION PIPELINE */}
        <ConversionPipeline
          proposals={proposals}
          clients={clients}
          proposalClientNames={proposalClientNames}
        />

        {/* SECONDARY: Upcoming & Recent (auto-hides if empty) */}
        <UpcomingAndRecent proposals={proposals} />
      </div>
    </DashboardLayout>
  );
}
