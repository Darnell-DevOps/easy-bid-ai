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
  CheckCircle2,
  FileCheck,
  RefreshCw,
  BellRing,
  Activity,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
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
  failed_payment_at: string | null;
  renewed_at: string | null;
  next_billing_date: string | null;
  last_billed_date: string | null;
  service_type: string | null;
  total_billed_cents: number | null;
}

interface RetainerInvoiceRow {
  id: string;
  retainer_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

interface ClientRow {
  id: string;
  name: string;
  company: string | null;
  is_active: boolean;
  status: string | null;
}

type ActivityEvent = {
  id: string;
  type: "payment_received" | "retainer_renewed" | "invoice_paid" | "payment_failed" | "renewal_approaching";
  client: string;
  amount?: string;
  timestamp: Date;
  detail?: string;
};

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
  const [retainerInvoices, setRetainerInvoices] = useState<RetainerInvoiceRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [proposalsRes, retainersRes, invoicesRes] = await Promise.all([
        supabase
          .from("proposals")
          .select("id, client_name, budget, created_at, client_paid")
          .order("created_at", { ascending: true }),
        supabase
          .from("retainers")
          .select(
            "id, client_name, amount_cents, currency, billing_interval, custom_interval_days, status, has_failed_payment, failed_payment_at, renewed_at, next_billing_date, last_billed_date, service_type, total_billed_cents"
          ),
        supabase
          .from("retainer_invoices")
          .select("id, retainer_id, amount_cents, currency, status, paid_at, failed_at, failure_reason, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      setProposals((proposalsRes.data as PaidProposal[]) || []);
      setRetainers((retainersRes.data as RetainerRow[]) || []);
      setRetainerInvoices((invoicesRes.data as RetainerInvoiceRow[]) || []);
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

  // ---- Activity feed ----
  const activityEvents = useMemo<ActivityEvent[]>(() => {
    const events: ActivityEvent[] = [];
    const retainerById = new Map(retainers.map((r) => [r.id, r] as const));

    paidProposals.forEach((p) => {
      events.push({
        id: `prop-${p.id}`,
        type: "payment_received",
        client: p.client_name,
        amount: `$${parseBudget(p.budget).toLocaleString()}`,
        timestamp: new Date(p.created_at),
        detail: "Proposal paid",
      });
    });

    retainerInvoices.forEach((inv) => {
      const r = retainerById.get(inv.retainer_id);
      const client = r?.client_name || "Client";
      if (inv.paid_at) {
        events.push({
          id: `inv-paid-${inv.id}`,
          type: "invoice_paid",
          client,
          amount: formatMoney(inv.amount_cents, inv.currency),
          timestamp: new Date(inv.paid_at),
          detail: "Retainer invoice paid",
        });
      } else if (inv.failed_at) {
        events.push({
          id: `inv-failed-${inv.id}`,
          type: "payment_failed",
          client,
          amount: formatMoney(inv.amount_cents, inv.currency),
          timestamp: new Date(inv.failed_at),
          detail: inv.failure_reason || "Payment failed",
        });
      }
    });

    retainers.forEach((r) => {
      if (r.renewed_at) {
        events.push({
          id: `ren-${r.id}`,
          type: "retainer_renewed",
          client: r.client_name,
          amount: formatMoney(r.amount_cents, r.currency),
          timestamp: new Date(r.renewed_at),
          detail: "Retainer renewed",
        });
      }
      if (r.status === "active" && r.next_billing_date) {
        const next = new Date(r.next_billing_date);
        const days = Math.ceil((next.getTime() - now.getTime()) / 86400000);
        if (days >= 0 && days <= 7) {
          events.push({
            id: `upc-${r.id}`,
            type: "renewal_approaching",
            client: r.client_name,
            amount: formatMoney(r.amount_cents, r.currency),
            timestamp: next,
            detail: days === 0 ? "Renews today" : `Renews in ${days} day${days === 1 ? "" : "s"}`,
          });
        }
      }
    });

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 12);
  }, [paidProposals, retainerInvoices, retainers]);

  const activityStyle = (t: ActivityEvent["type"]) => {
    switch (t) {
      case "payment_received":
        return { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Payment received" };
      case "invoice_paid":
        return { icon: FileCheck, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Invoice paid" };
      case "retainer_renewed":
        return { icon: RefreshCw, color: "text-purple-400", bg: "bg-purple-500/10", label: "Retainer renewed" };
      case "payment_failed":
        return { icon: AlertTriangle, color: "text-rose-400", bg: "bg-rose-500/10", label: "Payment failed" };
      case "renewal_approaching":
        return { icon: BellRing, color: "text-amber-400", bg: "bg-amber-500/10", label: "Renewal approaching" };
    }
  };

  const formatRelative = (d: Date) => {
    const diff = d.getTime() - now.getTime();
    const abs = Math.abs(diff);
    const mins = Math.round(abs / 60000);
    const hrs = Math.round(abs / 3600000);
    const days = Math.round(abs / 86400000);
    const suffix = diff < 0 ? "ago" : "from now";
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ${suffix}`;
    if (hrs < 24) return `${hrs}h ${suffix}`;
    if (days < 30) return `${days}d ${suffix}`;
    return d.toLocaleDateString();
  };

  // ---- Revenue Breakdown ----
  const categoriseRetainer = (svc: string | null): "Retainers" | "Consulting" | "Maintenance" | "Other" => {
    const s = (svc || "").toLowerCase();
    if (!s) return "Retainers";
    if (/(consult|advisor|advisory|strateg|coach)/.test(s)) return "Consulting";
    if (/(maint|support|hosting|care|managed)/.test(s)) return "Maintenance";
    if (/(retain|monthly|subscription)/.test(s)) return "Retainers";
    return "Other";
  };

  const breakdownData = useMemo(() => {
    const buckets: Record<string, number> = {
      "One-Time Projects": 0,
      "Retainers": 0,
      "Consulting": 0,
      "Maintenance": 0,
      "Other": 0,
    };
    paidProposals.forEach((p) => {
      buckets["One-Time Projects"] += parseBudget(p.budget);
    });
    // Use actual paid retainer invoices for accuracy
    const retainerById = new Map(retainers.map((r) => [r.id, r] as const));
    retainerInvoices.forEach((inv) => {
      if (!inv.paid_at) return;
      const r = retainerById.get(inv.retainer_id);
      const cat = categoriseRetainer(r?.service_type ?? null);
      buckets[cat] += (inv.amount_cents || 0) / 100;
    });
    // Fallback: if no invoices but retainers have total_billed_cents
    if (retainerInvoices.filter((i) => i.paid_at).length === 0) {
      retainers.forEach((r) => {
        const cat = categoriseRetainer(r.service_type);
        buckets[cat] += (r.total_billed_cents || 0) / 100;
      });
    }
    const colors: Record<string, string> = {
      "One-Time Projects": "hsl(var(--accent))",
      "Retainers": "hsl(262 83% 65%)",
      "Consulting": "hsl(199 89% 60%)",
      "Maintenance": "hsl(160 84% 50%)",
      "Other": "hsl(38 92% 60%)",
    };
    return Object.entries(buckets)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, color: colors[name] }));
  }, [paidProposals, retainers, retainerInvoices]);

  const breakdownTotal = useMemo(
    () => breakdownData.reduce((acc, b) => acc + b.value, 0),
    [breakdownData]
  );




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

        {/* Recent Revenue Activity */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Recent Revenue Activity</h2>
                  <p className="text-xs text-muted-foreground">Live feed of payments, renewals & alerts</p>
                </div>
              </div>
              {activityEvents.length > 0 && (
                <span className="text-xs text-muted-foreground">{activityEvents.length} event{activityEvents.length === 1 ? "" : "s"}</span>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : activityEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No recent activity yet. Payments and renewals will appear here.
              </p>
            ) : (
              <div className="space-y-2">
                {activityEvents.map((e) => {
                  const s = activityStyle(e.type);
                  const Icon = s.icon;
                  const isAlert = e.type === "payment_failed" || e.type === "renewal_approaching";
                  return (
                    <div
                      key={e.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isAlert
                          ? e.type === "payment_failed"
                            ? "border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10"
                            : "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"
                          : "border-transparent bg-secondary/30 hover:bg-secondary/50"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 ${s.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">{e.client}</p>
                          <span className={`text-[10px] uppercase tracking-wider font-medium ${s.color}`}>
                            {s.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{e.detail}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {e.amount && (
                          <p className={`text-sm font-semibold ${
                            e.type === "payment_failed" ? "text-rose-400" :
                            e.type === "renewal_approaching" ? "text-amber-400" :
                            "text-emerald-400"
                          }`}>
                            {e.amount}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5">{formatRelative(e.timestamp)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Breakdown */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Revenue Breakdown</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Where your revenue is coming from</p>
              </div>
              <span className="text-xs text-muted-foreground">All time</span>
            </div>
            {loading ? (
              <div className="h-64 bg-muted animate-pulse rounded-lg" />
            ) : breakdownData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No revenue yet. Paid proposals and retainers will appear here.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div className="relative h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={breakdownData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={95}
                        paddingAngle={2}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      >
                        {breakdownData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Total</span>
                    <span className="text-2xl font-bold text-foreground">{fmt(breakdownTotal)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {breakdownData
                    .slice()
                    .sort((a, b) => b.value - a.value)
                    .map((b) => {
                      const pct = breakdownTotal > 0 ? (b.value / breakdownTotal) * 100 : 0;
                      return (
                        <div
                          key={b.name}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: b.color }}
                            />
                            <span className="text-sm font-medium text-foreground truncate">{b.name}</span>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="text-sm font-semibold text-foreground">{fmt(b.value)}</p>
                            <p className="text-[11px] text-muted-foreground">{pct.toFixed(1)}%</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
