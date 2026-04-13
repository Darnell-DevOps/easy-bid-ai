import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, DollarSign, TrendingUp, Calendar, CalendarDays } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

interface PaidProposal {
  id: string;
  client_name: string;
  budget: string;
  created_at: string;
  client_paid: boolean;
}

const chartConfig: ChartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--accent))",
  },
};

export default function RevenueDashboard() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<PaidProposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("proposals")
        .select("id, client_name, budget, created_at, client_paid")
        .order("created_at", { ascending: true });
      setProposals(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const parseBudget = (budget: string) => {
    const num = parseFloat(budget?.replace(/[^0-9.]/g, "") || "0");
    return isNaN(num) ? 0 : num;
  };

  const paidProposals = useMemo(() => proposals.filter((p) => p.client_paid), [proposals]);

  const totalRevenue = useMemo(
    () => paidProposals.reduce((acc, p) => acc + parseBudget(p.budget), 0),
    [paidProposals]
  );

  const now = new Date();

  const todayRevenue = useMemo(() => {
    const today = now.toDateString();
    return paidProposals
      .filter((p) => new Date(p.created_at).toDateString() === today)
      .reduce((acc, p) => acc + parseBudget(p.budget), 0);
  }, [paidProposals]);

  const monthlyRevenue = useMemo(() => {
    return paidProposals
      .filter((p) => {
        const d = new Date(p.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((acc, p) => acc + parseBudget(p.budget), 0);
  }, [paidProposals]);

  const quarterlyRevenue = useMemo(() => {
    const currentQ = Math.floor(now.getMonth() / 3);
    return paidProposals
      .filter((p) => {
        const d = new Date(p.created_at);
        return Math.floor(d.getMonth() / 3) === currentQ && d.getFullYear() === now.getFullYear();
      })
      .reduce((acc, p) => acc + parseBudget(p.budget), 0);
  }, [paidProposals]);

  // Build monthly chart data for last 6 months
  const chartData = useMemo(() => {
    const months: { name: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = d.toLocaleString("default", { month: "short" });
      const year = d.getFullYear();
      const month = d.getMonth();
      const rev = paidProposals
        .filter((p) => {
          const pd = new Date(p.created_at);
          return pd.getMonth() === month && pd.getFullYear() === year;
        })
        .reduce((acc, p) => acc + parseBudget(p.budget), 0);
      months.push({ name: monthName, revenue: rev });
    }
    return months;
  }, [paidProposals]);

  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;

  const breakdownCards = [
    { label: "Total Revenue", value: fmt(totalRevenue), icon: DollarSign, accent: "text-emerald-400" },
    { label: "This Quarter", value: fmt(quarterlyRevenue), icon: TrendingUp, accent: "text-primary" },
    { label: "This Month", value: fmt(monthlyRevenue), icon: CalendarDays, accent: "text-accent" },
    { label: "Today", value: fmt(todayRevenue), icon: Calendar, accent: "text-amber-400" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Revenue</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track revenue from paid proposals
            </p>
          </div>
        </div>

        {/* Breakdown cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {breakdownCards.map((s) => (
            <Card key={s.label} className="group hover:shadow-lg hover:border-accent/20 transition-all duration-300">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                    <s.icon className={`w-4 h-4 ${s.accent}`} />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Revenue Over Time</h2>
            {loading ? (
              <div className="h-64 bg-muted animate-pulse rounded-lg" />
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    className="text-xs"
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => `$${Number(value).toLocaleString()}`}
                      />
                    }
                  />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent paid proposals */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Paid Proposals
              {paidProposals.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({paidProposals.length})
                </span>
              )}
            </h2>
            {paidProposals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No paid proposals yet. Mark proposals as paid to track revenue.
              </p>
            ) : (
              <div className="space-y-2">
                {[...paidProposals].reverse().slice(0, 10).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/dashboard/proposal/${p.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.client_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-400">
                      ${parseBudget(p.budget).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
