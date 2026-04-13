import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle, Clock, XCircle, TrendingUp, Plus, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Proposal {
  id: string;
  status: string;
  created_at: string;
}

export default function ProposalsDashboard() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("proposals")
        .select("id, status, created_at")
        .order("created_at", { ascending: false });
      setProposals(data || []);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const total = proposals.length;
    const accepted = proposals.filter(p => p.status === "accepted").length;
    const pending = proposals.filter(p => p.status === "pending").length;
    const rejected = proposals.filter(p => p.status === "rejected").length;
    const conversionRate = total > 0 ? ((accepted / total) * 100).toFixed(1) : "0";

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thisWeek = proposals.filter(p => new Date(p.created_at) >= weekAgo).length;
    const lastWeek = proposals.filter(p => {
      const d = new Date(p.created_at);
      return d >= twoWeeksAgo && d < weekAgo;
    }).length;

    let trend = "";
    if (thisWeek > lastWeek) trend = `+${thisWeek} this week`;
    else if (thisWeek === lastWeek && thisWeek > 0) trend = "Same as last week";
    else if (thisWeek < lastWeek) trend = "Down from last week";
    else trend = "No proposals yet";

    return { total, accepted, pending, rejected, conversionRate, thisWeek, trend };
  }, [proposals]);

  const breakdownCards = [
    { label: "Accepted", value: stats.accepted, icon: CheckCircle, accent: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Pending", value: stats.pending, icon: Clock, accent: "text-amber-400", bg: "bg-amber-400/10" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, accent: "text-red-400", bg: "bg-red-400/10" },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Proposals Overview</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Track your proposal performance</p>
            </div>
          </div>
          <Button onClick={() => navigate("/dashboard/new")} className="gap-2">
            <Plus className="w-4 h-4" />
            New Proposal
          </Button>
        </div>

        {/* Main stat */}
        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Proposals</p>
                <p className="text-5xl font-bold text-foreground mt-1">{stats.total}</p>
                <div className="flex items-center gap-2 mt-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary font-medium">{stats.trend}</span>
                </div>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-3">
          {breakdownCards.map(c => (
            <Card key={c.label} className="hover:shadow-lg transition-all duration-300">
              <CardContent className="p-4 text-center">
                <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center mx-auto mb-2`}>
                  <c.icon className={`w-5 h-5 ${c.accent}`} />
                </div>
                <p className="text-2xl font-bold text-foreground">{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Conversion Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <div className="flex items-end gap-3">
              <p className="text-4xl font-bold text-foreground">{stats.conversionRate}%</p>
              <p className="text-sm text-muted-foreground pb-1">of proposals accepted</p>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 mt-4">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(parseFloat(stats.conversionRate), 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Insight */}
        <Card className="bg-accent/5 border-accent/20">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {stats.total === 0
                  ? "Create your first proposal to get started!"
                  : parseFloat(stats.conversionRate) >= 50
                    ? "Great conversion rate! Keep up the momentum."
                    : "Keep going — more proposals = more clients"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total > 0 ? `You've created ${stats.total} proposal${stats.total !== 1 ? "s" : ""} so far.` : "Your journey starts with one proposal."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
