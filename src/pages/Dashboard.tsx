import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import SalesMetrics from "@/components/dashboard/SalesMetrics";
import PipelineView from "@/components/dashboard/PipelineView";
import PriorityActions from "@/components/dashboard/PriorityActions";
import DealActivity from "@/components/dashboard/DealActivity";
import ProposalsList from "@/components/dashboard/ProposalsList";
import OnboardingHighlight from "@/components/dashboard/OnboardingHighlight";
import UpcomingBookings from "@/components/dashboard/UpcomingBookings";
import ContractsWidget from "@/components/dashboard/ContractsWidget";
import OnboardingWidget from "@/components/dashboard/OnboardingWidget";
import RetainersWidget from "@/components/dashboard/RetainersWidget";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ArrowRight, UserPlus, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getOnboardingKey } from "@/pages/Onboarding";
import { getFollowUpScenario } from "@/lib/follow-up";

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
}

function parseAmount(s?: string | null): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<FullProposal[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [propRes, clientRes] = await Promise.all([
      supabase
        .from("proposals")
        .select(
          "id, client_name, company_name, service_type, created_at, proposal_content, invoice_content, budget, client_paid, status, sent_at, viewed_at, accepted_at, rejected_at, paid_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("id, name, status, created_at, company, service_requested, budget, timeline, goals, project_description")
        .order("created_at", { ascending: false }),
    ]);
    setProposals(propRes.data || []);
    setClients(clientRes.data || []);
    setLoading(false);
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

  const metrics = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const sentThisMonth = proposals.filter((p) => {
      if (!p.sent_at) return false;
      return new Date(p.sent_at).getTime() >= monthStart;
    }).length;

    const accepted = proposals.filter((p) => (p.status || "").toLowerCase() === "accepted" || p.client_paid).length;
    const revenuePaid = proposals.filter((p) => p.client_paid).reduce((acc, p) => acc + parseAmount(p.budget), 0);
    const pendingPayments = proposals
      .filter((p) => (p.status || "").toLowerCase() === "accepted" && !p.client_paid)
      .reduce((acc, p) => acc + parseAmount(p.budget), 0);

    return { sentThisMonth, accepted, revenuePaid, pendingPayments };
  }, [proposals]);

  // Dynamic tip based on user state
  const tip = useMemo(() => {
    if (proposals.length === 0)
      return {
        title: "Get started",
        body: "Add your first client, then generate a proposal in under 2 minutes.",
      };
    const acceptedUnpaid = proposals.filter(
      (p) => (p.status || "").toLowerCase() === "accepted" && !p.client_paid,
    ).length;
    if (acceptedUnpaid > 0)
      return {
        title: "Request payment",
        body: "A client said yes. Open the proposal and send the payment link to close the deal.",
      };
    const drafts = proposals.filter((p) => !p.status || p.status === "draft").length;
    if (drafts > 0)
      return {
        title: "Send your draft",
        body: "Drafts don't get paid. Share your draft proposal with the client today.",
      };
    const sent = proposals.filter((p) => {
      const s = (p.status || "").toLowerCase();
      return s === "sent" || s === "viewed";
    }).length;
    if (sent > 0)
      return {
        title: "Follow up",
        body: "Most deals close after a follow-up. Nudge clients who haven't responded yet.",
      };
    return {
      title: "Keep growing",
      body: "Add more clients to your pipeline and generate proposals to scale revenue.",
    };
  }, [proposals]);

  const priorityCount = useMemo(() => {
    let n = 0;
    for (const p of proposals) if (getFollowUpScenario(p) !== "none") n++;
    for (const c of clients) {
      if ((c.status || "").toLowerCase() === "new" && !proposalClientNames.has(c.name.toLowerCase().trim())) n++;
    }
    return n;
  }, [proposals, clients, proposalClientNames]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Command Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {priorityCount > 0
              ? `${priorityCount} action${priorityCount > 1 ? "s" : ""} need your attention to close more deals.`
              : "You're caught up. Keep momentum by adding leads or sending new proposals."}
          </p>
        </div>

        <OnboardingHighlight />

        {/* PRIORITY ACTIONS — top of the dashboard */}
        <PriorityActions
          proposals={proposals}
          clients={clients}
          proposalClientNames={proposalClientNames}
        />

        {/* METRICS */}
        <SalesMetrics
          proposalsSentThisMonth={metrics.sentThisMonth}
          acceptedProposals={metrics.accepted}
          revenuePaid={metrics.revenuePaid}
          pendingPayments={metrics.pendingPayments}
        />

        {/* PIPELINE */}
        <PipelineView proposals={proposals} clients={clients} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* LEFT: Hero + Saved Proposals */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Hero */}
            <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-accent/10 via-card to-purple/10">
              <CardContent className="p-7 sm:p-8 space-y-5">
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                    Create a proposal and get paid faster
                  </h2>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Turn your next lead into a paying client in minutes.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="bg-gradient-to-r from-accent to-purple text-white hover:brightness-110 gap-2 h-12 px-6 text-base font-semibold shadow-lg shadow-accent/20"
                  >
                    <Link to="/dashboard/new">
                      <Sparkles className="w-4 h-4" /> Create Proposal <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="gap-2 h-12 px-5">
                    <Link to="/dashboard/clients/new">
                      <UserPlus className="w-4 h-4" /> Add Client
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Saved Proposals */}
            <div>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Saved Proposals
                    {!loading && proposals.length > 0 && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">({proposals.length})</span>
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Pick up where you left off.</p>
                </div>
              </div>
              <ProposalsList proposals={proposals} loading={loading} onRefresh={fetchData} />
            </div>
          </div>

          {/* RIGHT: Tip + Deal Activity */}
          <aside className="lg:col-span-5 xl:col-span-4 lg:border-l lg:border-border/50 lg:pl-6 xl:pl-8 space-y-6">
            <Card className="border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
              <CardContent className="p-4 flex gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{tip.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tip.body}</p>
                </div>
              </CardContent>
            </Card>

            <UpcomingBookings />

            <ContractsWidget />

            <RetainersWidget />

            <OnboardingWidget />

            <div>
              <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground/80">
                Deal Activity
              </h2>
              <DealActivity proposals={proposals} />
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
