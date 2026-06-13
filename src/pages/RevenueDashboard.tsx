import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Calendar,
  CalendarDays,
  Repeat,
  AlertTriangle,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { monthlyEquivalentCents, formatMoney } from "@/lib/retainers";

interface PaidProposal {
  id: string;
  client_name: string;
  budget: string;
  created_at: string;
  client_paid: boolean;
}

interface RetainerRow {
  id: string;
  client_name: string;
  amount_cents: number;
  currency: string;
  billing_interval: string;
  custom_interval_days: number | null;
  status: string;
  has_failed_payment: boolean;
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
  const [retainers, setRetainers] = useState<RetainerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [proposalsRes, retainersRes] = await Promise.all([
        supabase
          .from("proposals")
          .select("id, client_name, budget, created_at, client_paid")
          .order("created_at", { ascending: true }),
        supabase
          .from("retainers")
          .select(
            "id, client_name, amount_cents, currency, billing_interval, custom_interval_days, status, has_failed_payment"
          ),
      ]);
      setProposals((proposalsRes.data as PaidProposal[]) || []);
      setRetainers((retainersRes.data as RetainerRow[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const parseBudget = (budget: string) => {
    const num = parseFloat(budget?.replace(/[^0-9.]/g, "") || "0");
    return isNaN(num) ? 0 : num;
  };

  const paidProposals = useMemo(() => proposals.filter((p) => p.client_paid), [proposals]);
  const unpaidProposals = useMemo(() => proposals.filter((p) => !p.client_paid), [proposals]);

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

  // ---- New KPI computations ----
  const activeRetainers = useMemo(
    () => retainers.filter((r) => r.status === "active"),
    [retainers]
  );

  const mrrCents = useMemo(
    () =>
      activeRetainers.reduce(
        (acc, r) =>
          acc + monthlyEquivalentCents(r.amount_cents, r.billing_interval, r.custom_interval_days),
        0
      ),
    [activeRetainers]
  );
  const mrrCurrency = activeRetainers[0]?.currency || "USD";

  const outstandingAmount = useMemo(
    () => unpaidProposals.reduce((acc, p) => acc + parseBudget(p.budget), 0),
    [unpaidProposals]
  );

  const failedPayments = useMemo(
    () => retainers.filter((r) => r.has_failed_payment),
    [retainers]
  );

  const failedAmountCents = useMemo(
    () => failedPayments.reduce((acc, r) => acc + (r.amount_cents || 0), 0),
    [failedPayments]
  );
  const failedCurrency = failedPayments[0]?.currency || mrrCurrency;

  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;

  const primaryCards = [
    {
      label: "Total Revenue",
      value: fmt(totalRevenue),
      icon: DollarSign,
      accent: "text-emerald-400",
      bg: "bg-emerald-500/10",
      hint: "All-time from paid proposals",
    },
    {
      label: "This Quarter",
      value: fmt(quarterlyRevenue),
      icon: TrendingUp,
      accent: "text-primary",
      bg: "bg-primary/10",
      hint: "Q" + (Math.floor(now.getMonth() / 3) + 1) + " " + now.getFullYear(),
    },
    {
      label: "This Month",
      value: fmt(monthlyRevenue),
      icon: CalendarDays,
      accent: "text-accent",
      bg: "bg-accent/10",
      hint: now.toLocaleString("default", { month: "long", year: "numeric" }),
    },
    {
      label: "Today",
      value: fmt(todayRevenue),
      icon: Calendar,
      accent: "text-amber-400",
      bg: "bg-amber-500/10",
      hint: now.toLocaleDateString(),
    },
  ];

  const secondaryCards = [
    {
      label: "MRR",
      value: formatMoney(mrrCents, mrrCurrency),
      icon: Repeat,
      accent: "text-purple-400",
      bg: "bg-purple-500/10",
      hint: `${activeRetainers.length} active retainer${activeRetainers.length !== 1 ? "s" : ""}`,
      link: "/dashboard/retainers",
    },
    {
      label: "Outstanding",
      value: fmt(outstandingAmount),
      icon: Clock,
      accent: "text-sky-400",
      bg: "bg-sky-500/10",
      hint: `${unpaidProposals.length} unpaid proposal${unpaidProposals.length !== 1 ? "s" : ""}`,
      link: "/dashboard/proposals",
    },
    {
      label: "Failed Payments",
      value: failedPayments.length > 0 ? formatMoney(failedAmountCents, failedCurrency) : "$0",
      icon: AlertTriangle,
      accent: "text-rose-400",
      bg: "bg-rose-500/10",
      hint:
        failedPayments.length > 0
          ? `${failedPayments.length} failed payment${failedPayments.length !== 1 ? "s" : ""}`
          : "All payments healthy",
      link: "/dashboard/recovery",
      alert: failedPayments.length > 0,
    },
    {
      label: "Active Retainers",
      value: String(activeRetainers.length),
      icon: Repeat,
      accent: "text-violet-400",
      bg: "bg-violet-500/10",
      hint: "Recurring clients",
      link: "/dashboard/retainers",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="h-9 w-9"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Revenue</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your revenue command centre
              </p>
            </div>
          </div>
          {failedPayments.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              onClick={() => navigate("/dashboard/recovery")}
            >
              <AlertCircle className="w-4 h-4 mr-1.5" />
              {failedPayments.length} failed payment{failedPayments.length > 1 ? "s" : ""}
            </Button>
          )}
        </div>

        {/* Primary KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {primaryCards.map((s) => (
            <Card
              key={s.label}
              className="group hover:shadow-lg hover:border-accent/20 transition-all duration-300"
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`w-4 h-4 ${s.accent}`} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                    {s.label}
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                  {s.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">{s.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Secondary KPI row */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Pipeline & Recurring
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {secondaryCards.map((s) => (
              <Card
                key={s.label}
                className={`group hover:shadow-lg hover:border-accent/20 transition-all duration-300 cursor-pointer ${
                  s.alert ? "border-rose-500/30" : ""
                }`}
                onClick={() => s.link && navigate(s.link)}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                      <s.icon className={`w-4 h-4 ${s.accent}`} />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                      {s.label}
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                    {s.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">{s.hint}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Chart */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Revenue Over Time</h2>
              <span className="text-xs text-muted-foreground">Last 6 months</span>
            </div>
            {loading ? (
              <div className="h-64 bg-muted animate-pulse rounded-lg" />
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis
                    dataKey="name"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
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

        {/* Paid Proposals */}
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
