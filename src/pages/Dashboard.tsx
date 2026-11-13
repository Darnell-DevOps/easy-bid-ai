import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import RetainerActions from "@/components/dashboard/RetainerActions";
import AttentionCenter from "@/components/dashboard/AttentionCenter";
import ConversionPipeline from "@/components/dashboard/ConversionPipeline";
import RevenueActivity from "@/components/dashboard/RevenueActivity";
import BusinessPulse from "@/components/dashboard/BusinessPulse";
import UpcomingAndRecent from "@/components/dashboard/UpcomingAndRecent";
import ActivationChecklist from "@/components/dashboard/ActivationChecklist";
import { ArrowUpRight, MessagesSquare, Calendar, FileText, LayoutDashboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FullProposal {
  id: string;
  client_id: string | null;
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
  fit_score?: number | null;
  fit_factors?: Array<{ label: string; impact: "positive" | "negative" }> | null;
  missing_info?: string[] | null;
  lead_quality?: string | null;
  lead_reply_sent_at?: string | null;
  lead_thread?: unknown;
  not_a_lead?: boolean | null;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const [proposals, setProposals] = useState<FullProposal[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [firstName, setFirstName] = useState<string>("");

  const fetchData = async () => {
    const [propRes, clientRes, userRes] = await Promise.all([
      supabase
        .from("proposals")
        .select(
          "id, client_id, client_name, company_name, service_type, created_at, proposal_content, invoice_content, budget, client_paid, status, sent_at, viewed_at, accepted_at, rejected_at, paid_at",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("id, name, status, created_at, company, service_requested, budget, timeline, goals, project_description, lead_score, fit_score, fit_factors, missing_info, lead_quality, lead_reply_sent_at, lead_thread, not_a_lead")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase.auth.getUser(),
    ]);
    setProposals((propRes.data as any) || []);
    setClients((clientRes.data as any) || []);

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

  // client_id-based set — used by AttentionCenter's next-action logic so we
  // don't match proposals to leads by (potentially duplicated) name string.
  const proposalClientIds = useMemo(
    () => new Set(proposals.map((p) => p.client_id).filter((v): v is string => !!v)),
    [proposals],
  );

  return (
    <DashboardLayout>
      <div className="cs-dashboard cs-dashboard-studio max-w-7xl mx-auto">
        <div className="cs-dashboard-toolbar"><span><LayoutDashboard aria-hidden="true" /> Dashboard</span><Link to="/dashboard/calendar"><Calendar aria-hidden="true" /> Calendar <ArrowUpRight aria-hidden="true" /></Link></div>
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="cs-workspace-page-title cs-dashboard-title">
              {greeting()}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              Review your monthly retainers and follow up on client decisions.
            </p>
          </div>
        </header>

        <RetainerActions />

        <details className="space-y-4">
          <summary className="cursor-pointer rounded-sm py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Sales and recent activity</summary>
          <BusinessPulse proposals={proposals} />
          <div className="cs-dashboard-grid">
            <div className="cs-dashboard-primary-column">
              <RevenueActivity proposals={proposals} />
              <ConversionPipeline proposals={proposals} clients={clients} proposalClientIds={proposalClientIds} />
              <UpcomingAndRecent proposals={proposals} />
            </div>
            <div className="cs-dashboard-priorities">
              <AttentionCenter proposals={proposals} clients={clients} proposalClientIds={proposalClientIds} />
              <ActivationChecklist />
              <section className="cs-dashboard-panel cs-dashboard-shortcuts" aria-labelledby="shortcuts-heading">
                <div className="cs-dashboard-panel-heading"><div><h2 id="shortcuts-heading">Keep work moving</h2><p>Pick up the next step.</p></div></div>
                <Link to="/dashboard/leads"><MessagesSquare aria-hidden="true" /><span><strong>Lead Assistant</strong><small>Review and qualify enquiries</small></span><ArrowUpRight aria-hidden="true" /></Link>
                <Link to="/dashboard/new"><FileText aria-hidden="true" /><span><strong>Create a proposal</strong><small>Turn a brief into your next offer</small></span><ArrowUpRight aria-hidden="true" /></Link>
                <Link to="/dashboard/calendar"><Calendar aria-hidden="true" /><span><strong>Open your calendar</strong><small>Stay on top of client meetings</small></span><ArrowUpRight aria-hidden="true" /></Link>
              </section>
            </div>
          </div>
        </details>
      </div>
    </DashboardLayout>
  );
}
