import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import StatsCards from "@/components/dashboard/StatsCards";
import QuickActions from "@/components/dashboard/QuickActions";
import RecentActivity from "@/components/dashboard/RecentActivity";
import ProposalsList from "@/components/dashboard/ProposalsList";
import { supabase } from "@/integrations/supabase/client";

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
  status: string;
}

export default function Dashboard() {
  const [proposals, setProposals] = useState<FullProposal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProposals = async () => {
    const { data } = await supabase
      .from("proposals")
      .select("id, client_name, company_name, service_type, created_at, proposal_content, invoice_content, budget, client_paid, status")
      .order("created_at", { ascending: false });
    setProposals(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProposals(); }, []);

  const stats = useMemo(() => {
    const uniqueClients = new Set(proposals.map((p) => p.client_name.toLowerCase().trim())).size;
    const timeSaved = proposals.reduce((acc, p) => {
      let mins = 0;
      if (p.proposal_content) mins += 45;
      if (p.invoice_content) mins += 15;
      return acc + mins;
    }, 0);
    const revenue = proposals
      .filter((p) => p.client_paid)
      .reduce((acc, p) => {
        const num = parseFloat(p.budget?.replace(/[^0-9.]/g, "") || "0");
        return acc + (isNaN(num) ? 0 : num);
      }, 0);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeek = proposals.filter((p) => new Date(p.created_at) >= oneWeekAgo).length;

    const proposalStats = {
      total: proposals.length,
      accepted: proposals.filter((p) => p.status === "accepted").length,
      pending: proposals.filter((p) => p.status === "pending").length,
      rejected: proposals.filter((p) => p.status === "rejected").length,
      thisWeek,
    };

    return { total: proposals.length, revenue, clients: uniqueClients, timeSaved, proposalStats };
  }, [proposals]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back. Here's your overview.</p>
        </div>

        {/* Stats */}
        <StatsCards
          totalProposals={stats.total}
          revenueGenerated={stats.revenue}
          activeClients={stats.clients}
          timeSavedMinutes={stats.timeSaved}
          proposalStats={stats.proposalStats}
        />

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Quick Actions</h2>
          <QuickActions />
        </div>

        {/* Two column: Recent Activity + Proposals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-foreground mb-3">
              Saved Proposals
              {!loading && proposals.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">({proposals.length})</span>
              )}
            </h2>
            <ProposalsList proposals={proposals} loading={loading} onRefresh={fetchProposals} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Recent Activity</h2>
            <RecentActivity proposals={proposals} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
