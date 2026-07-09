import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
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
  Users,
  ExternalLink,
  CalendarClock,
  FilePlus,
  ArrowUpRight,
  Filter,
  CalendarRange,
  Sparkles,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { monthlyEquivalentCents, formatMoney } from "@/lib/retainers";

type FilterPreset = "30d" | "90d" | "12m" | "custom";

interface PaidProposal {
  id: string;
  client_name: string;
  client_id: string | null;
  budget: string;
  created_at: string;
  client_paid: boolean;
}

interface RetainerRow {
  id: string;
  client_name: string;
  client_id: string | null;
  title: string;
  company_name: string | null;
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
  const [filterPreset, setFilterPreset] = useState<FilterPreset>("12m");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [proposalsRes, retainersRes, invoicesRes, clientsRes] = await Promise.all([
        supabase
          .from("proposals")
          .select("id, client_name, client_id, budget, created_at, client_paid")
          .order("created_at", { ascending: true }),
        supabase
          .from("retainers")
          .select(
            "id, client_name, client_id, title, company_name, amount_cents, currency, billing_interval, custom_interval_days, status, has_failed_payment, failed_payment_at, renewed_at, next_billing_date, last_billed_date, service_type, total_billed_cents"
          )
          .is("deleted_at", null),
        supabase
          .from("retainer_invoices")
          .select("id, retainer_id, amount_cents, currency, status, paid_at, failed_at, failure_reason, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("clients")
          .select("id, name, company, is_active, status")
          .order("created_at", { ascending: false }),
      ]);
      setProposals((proposalsRes.data as PaidProposal[]) || []);
      setRetainers((retainersRes.data as RetainerRow[]) || []);
      setRetainerInvoices((invoicesRes.data as RetainerInvoiceRow[]) || []);
      setClients((clientsRes.data as ClientRow[]) || []);
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

  // ---- Filter range ----
  const filterRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    if (filterPreset === "30d") start.setDate(end.getDate() - 30);
    else if (filterPreset === "90d") start.setDate(end.getDate() - 90);
    else if (filterPreset === "12m") start.setMonth(end.getMonth() - 12);
    else if (filterPreset === "custom") {
      return {
        start: customRange.from || new Date(end.getFullYear(), end.getMonth() - 1, 1),
        end: customRange.to || end,
      };
    }
    return { start, end };
  }, [filterPreset, customRange]);

  const filterLabel = useMemo(() => {
    if (filterPreset === "30d") return "Last 30 days";
    if (filterPreset === "90d") return "Last 90 days";
    if (filterPreset === "12m") return "Last 12 months";
    if (customRange.from && customRange.to)
      return `${format(customRange.from, "MMM d")} – ${format(customRange.to, "MMM d, yyyy")}`;
    if (customRange.from) return `From ${format(customRange.from, "MMM d, yyyy")}`;
    return "Custom range";
  }, [filterPreset, customRange]);

  const inRange = (d: Date) => d >= filterRange.start && d <= filterRange.end;

  const filteredPaidProposals = useMemo(
    () => paidProposals.filter((p) => inRange(new Date(p.created_at))),
    [paidProposals, filterRange]
  );

  const filteredInvoices = useMemo(
    () => retainerInvoices.filter((i) => i.paid_at && inRange(new Date(i.paid_at))),
    [retainerInvoices, filterRange]
  );

  // Build chart data dynamically based on range
  const chartData = useMemo(() => {
    const { start, end } = filterRange;
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const useMonthly = days > 120;
    const buckets: { name: string; revenue: number; key: string }[] = [];

    if (useMonthly) {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
      while (cursor <= endCursor) {
        buckets.push({
          name: cursor.toLocaleString("default", { month: "short" }),
          key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
          revenue: 0,
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      filteredPaidProposals.forEach((p) => {
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const b = buckets.find((x) => x.key === key);
        if (b) b.revenue += parseBudget(p.budget);
      });
    } else {
      const weekMs = 7 * 86400000;
      const numWeeks = Math.max(1, Math.ceil(days / 7));
      for (let i = numWeeks - 1; i >= 0; i--) {
        const bEnd = new Date(end.getTime() - i * weekMs);
        buckets.push({
          name: bEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          key: String(i),
          revenue: 0,
        });
      }
      filteredPaidProposals.forEach((p) => {
        const d = new Date(p.created_at);
        const ageDays = Math.floor((end.getTime() - d.getTime()) / 86400000);
        const weekIdx = Math.floor(ageDays / 7);
        const bucketIdx = numWeeks - 1 - weekIdx;
        if (bucketIdx >= 0 && bucketIdx < buckets.length) {
          buckets[bucketIdx].revenue += parseBudget(p.budget);
        }
      });
    }
    return buckets;
  }, [filteredPaidProposals, filterRange]);

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

    return events
      .filter((e) => inRange(e.timestamp))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 12);
  }, [paidProposals, retainerInvoices, retainers, filterRange]);

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

  // ---- Empty State Component ----
  const RevenueEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-4">
        <DollarSign className="w-7 h-7 text-primary/40" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">
        Your revenue data will appear here as clients begin paying.
      </p>
      <p className="text-xs text-muted-foreground mb-5 max-w-xs">
        Get started by creating proposals, setting up retainers, or managing your client list.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs border-primary/20 hover:bg-primary/10 hover:text-primary"
          onClick={() => navigate("/dashboard/new")}
        >
          <FilePlus className="w-3.5 h-3.5 mr-1.5" />
          Create Proposal
          <ArrowUpRight className="w-3 h-3 ml-1 opacity-50" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs border-primary/20 hover:bg-primary/10 hover:text-primary"
          onClick={() => navigate("/dashboard/retainers/new")}
        >
          <Repeat className="w-3.5 h-3.5 mr-1.5" />
          Create Retainer
          <ArrowUpRight className="w-3 h-3 ml-1 opacity-50" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs border-primary/20 hover:bg-primary/10 hover:text-primary"
          onClick={() => navigate("/dashboard/clients")}
        >
          <Users className="w-3.5 h-3.5 mr-1.5" />
          View Clients
          <ArrowUpRight className="w-3 h-3 ml-1 opacity-50" />
        </Button>
      </div>
    </div>
  );

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
    filteredPaidProposals.forEach((p) => {
      buckets["One-Time Projects"] += parseBudget(p.budget);
    });
    // Use actual paid retainer invoices for accuracy (filtered by range)
    const retainerById = new Map(retainers.map((r) => [r.id, r] as const));
    filteredInvoices.forEach((inv) => {
      const r = retainerById.get(inv.retainer_id);
      const cat = categoriseRetainer(r?.service_type ?? null);
      buckets[cat] += (inv.amount_cents || 0) / 100;
    });
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
  }, [filteredPaidProposals, filteredInvoices, retainers]);

  const breakdownTotal = useMemo(
    () => breakdownData.reduce((acc, b) => acc + b.value, 0),
    [breakdownData]
  );

  // ---- Top Clients ----
  const topClients = useMemo(() => {
    const revenueByClientId = new Map<string, number>();
    const nameByClientId = new Map<string, string>();

    paidProposals.forEach((p) => {
      const key = p.client_id || p.client_name;
      revenueByClientId.set(key, (revenueByClientId.get(key) || 0) + parseBudget(p.budget));
      if (!nameByClientId.has(key)) nameByClientId.set(key, p.client_name);
    });

    const retainerById = new Map(retainers.map((r) => [r.id, r] as const));
    retainerInvoices.forEach((inv) => {
      if (!inv.paid_at) return;
      const r = retainerById.get(inv.retainer_id);
      const key = r?.client_id || r?.client_name || inv.retainer_id;
      if (!key) return;
      revenueByClientId.set(key, (revenueByClientId.get(key) || 0) + (inv.amount_cents || 0) / 100);
      if (!nameByClientId.has(key)) nameByClientId.set(key, r?.client_name || "Client");
    });

    const clientMap = new Map(clients.map((c) => [c.id, c] as const));
    const entries = Array.from(revenueByClientId.entries())
      .map(([key, revenue]) => {
        const clientRecord = clientMap.get(key);
        const displayName = clientRecord?.name || clientRecord?.company || nameByClientId.get(key) || key;
        const isActive = clientRecord ? clientRecord.is_active : true;
        const clientId = clientRecord?.id || null;
        return { key, displayName, revenue, isActive, clientId };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return entries;
  }, [paidProposals, retainerInvoices, retainers, clients]);

  // ---- Upcoming Renewals ----
  const upcomingRenewals = useMemo(() => {
    const future = activeRetainers
      .filter((r) => r.next_billing_date)
      .map((r) => {
        const next = new Date(r.next_billing_date!);
        const days = Math.ceil((next.getTime() - now.getTime()) / 86400000);
        return { ...r, next, days };
      })
      .filter((r) => r.days >= 0)
      .sort((a, b) => a.days - b.days);
    return future;
  }, [activeRetainers]);

  const renewalUrgency = (days: number) => {
    if (days <= 7) return { label: "7 days", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" };
    if (days <= 14) return { label: "14 days", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
    return { label: "30 days", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" };
  };

  // ---- Revenue Insights ----
  const revenueInsights = useMemo(() => {
    const insights: { id: string; text: string; tone: "positive" | "warning" | "neutral" | "negative"; icon: typeof TrendingUp }[] = [];

    // 1. Top revenue source
    if (breakdownData.length > 0) {
      const topSource = [...breakdownData].sort((a, b) => b.value - a.value)[0];
      const pct = breakdownTotal > 0 ? ((topSource.value / breakdownTotal) * 100).toFixed(0) : "0";
      insights.push({
        id: "top-source",
        text: `Most revenue comes from ${topSource.name} (${pct}%)`,
        tone: "positive",
        icon: TrendingUp,
      });
    }

    // 2. Month-over-month revenue change (using paid proposals as proxy)
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const currMonthRev = paidProposals
      .filter((p) => {
        const d = new Date(p.created_at);
        return d >= currentMonthStart;
      })
      .reduce((acc, p) => acc + parseBudget(p.budget), 0);
    const prevMonthRev = paidProposals
      .filter((p) => {
        const d = new Date(p.created_at);
        return d >= prevMonthStart && d <= prevMonthEnd;
      })
      .reduce((acc, p) => acc + parseBudget(p.budget), 0);

    if (prevMonthRev > 0) {
      const change = ((currMonthRev - prevMonthRev) / prevMonthRev) * 100;
      const absChange = Math.abs(change).toFixed(0);
      if (change > 0) {
        insights.push({
          id: "mom-up",
          text: `Revenue increased ${absChange}% compared to last month`,
          tone: "positive",
          icon: TrendingUp,
        });
      } else if (change < 0) {
        insights.push({
          id: "mom-down",
          text: `Revenue decreased ${absChange}% compared to last month`,
          tone: "negative",
          icon: TrendingDown,
        });
      } else {
        insights.push({
          id: "mom-flat",
          text: `Revenue is flat compared to last month`,
          tone: "neutral",
          icon: Minus,
        });
      }
    }

    // 3. Upcoming renewals count (next 14 days)
    const renewals14Days = upcomingRenewals.filter((r) => r.days <= 14).length;
    if (renewals14Days > 0) {
      insights.push({
        id: "renewals",
        text: `${renewals14Days} renewal${renewals14Days === 1 ? "" : "s"} due in the next 14 days`,
        tone: "warning",
        icon: BellRing,
      });
    }

    // 4. Outstanding payments
    if (outstandingAmount > 0) {
      insights.push({
        id: "outstanding",
        text: `Outstanding payments total ${fmt(outstandingAmount)}`,
        tone: "warning",
        icon: Clock,
      });
    }

    // 5. Failed payments
    if (failedPayments.length > 0) {
      insights.push({
        id: "failed",
        text: `${failedPayments.length} failed payment${failedPayments.length === 1 ? "" : "s"} need${failedPayments.length === 1 ? "s" : ""} attention`,
        tone: "negative",
        icon: AlertTriangle,
      });
    }

    // 6. Top client
    if (topClients.length > 0) {
      const top = topClients[0];
      insights.push({
        id: "top-client",
        text: `${top.displayName} is your top revenue generator`,
        tone: "positive",
        icon: Users,
      });
    }

    return insights.slice(0, 4);
  }, [breakdownData, breakdownTotal, paidProposals, upcomingRenewals, outstandingAmount, failedPayments, topClients]);

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
      <div className="space-y-5">
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

        {/* Revenue Filters */}
        <Card className="border-border/60 bg-card/40 backdrop-blur-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground/80 font-medium pr-2 border-r border-border/50">
                <Filter className="w-3.5 h-3.5" />
                Filter
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {([
                  { id: "30d", label: "Last 30 Days" },
                  { id: "90d", label: "Last 90 Days" },
                  { id: "12m", label: "Last 12 Months" },
                ] as { id: FilterPreset; label: string }[]).map((opt) => {
                  const active = filterPreset === opt.id;
                  return (
                    <Button
                      key={opt.id}
                      size="sm"
                      variant="outline"
                      onClick={() => setFilterPreset(opt.id)}
                      className={cn(
                        "h-8 text-xs transition-all",
                        active
                          ? "border-primary/40 bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary shadow-[0_0_20px_-8px_hsl(var(--primary)/0.6)]"
                          : "border-border/60 hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      )}
                    >
                      {opt.label}
                    </Button>
                  );
                })}
                <Popover open={customOpen} onOpenChange={setCustomOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFilterPreset("custom")}
                      className={cn(
                        "h-8 text-xs transition-all gap-1.5",
                        filterPreset === "custom"
                          ? "border-primary/40 bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary shadow-[0_0_20px_-8px_hsl(var(--primary)/0.6)]"
                          : "border-border/60 hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      )}
                    >
                      <CalendarRange className="w-3.5 h-3.5" />
                      {filterPreset === "custom" && customRange.from
                        ? customRange.to
                          ? `${format(customRange.from, "MMM d")} – ${format(customRange.to, "MMM d")}`
                          : format(customRange.from, "MMM d, yyyy")
                        : "Custom Range"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="range"
                      selected={{ from: customRange.from, to: customRange.to } as any}
                      onSelect={(range: any) => {
                        setCustomRange({ from: range?.from, to: range?.to });
                        if (range?.from && range?.to) setCustomOpen(false);
                      }}
                      numberOfMonths={2}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
                Showing <span className="text-foreground font-medium">{filterLabel}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Insights */}
        {revenueInsights.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {revenueInsights.map((insight) => {
              const toneStyles = {
                positive: {
                  border: "border-emerald-500/20",
                  bg: "bg-emerald-500/5",
                  iconBg: "bg-emerald-500/10",
                  iconColor: "text-emerald-400",
                },
                warning: {
                  border: "border-amber-500/20",
                  bg: "bg-amber-500/5",
                  iconBg: "bg-amber-500/10",
                  iconColor: "text-amber-400",
                },
                neutral: {
                  border: "border-border/40",
                  bg: "bg-secondary/20",
                  iconBg: "bg-muted",
                  iconColor: "text-muted-foreground",
                },
                negative: {
                  border: "border-rose-500/20",
                  bg: "bg-rose-500/5",
                  iconBg: "bg-rose-500/10",
                  iconColor: "text-rose-400",
                },
              };
              const style = toneStyles[insight.tone];
              const Icon = insight.icon;
              return (
                <Card
                  key={insight.id}
                  className={`border ${style.border} ${style.bg} hover:brightness-110 transition-all`}
                >
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg ${style.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`w-4 h-4 ${style.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground leading-snug">{insight.text}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

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

        {/* Row: Chart (2/3) + Revenue Breakdown (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart */}
          <Card className="lg:col-span-2">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Revenue Over Time</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Trends and growth across the selected window</p>
                </div>
                <span className="text-xs text-muted-foreground">{filterLabel}</span>
              </div>
              {loading ? (
                <div className="h-72 bg-muted animate-pulse rounded-lg" />
              ) : (
                <ChartContainer config={chartConfig} className="h-72 w-full">
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

          {/* Revenue Breakdown */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Breakdown</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Revenue by source</p>
                </div>
              </div>
              {loading ? (
                <div className="h-72 bg-muted animate-pulse rounded-lg" />
              ) : breakdownData.length === 0 ? (
                <RevenueEmptyState />
              ) : (
                <div className="space-y-4">
                  <div className="relative h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={breakdownData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={80}
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
                      <span className="text-xl font-bold text-foreground">{fmt(breakdownTotal)}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {breakdownData
                      .slice()
                      .sort((a, b) => b.value - a.value)
                      .map((b) => {
                        const pct = breakdownTotal > 0 ? (b.value / breakdownTotal) * 100 : 0;
                        return (
                          <div
                            key={b.name}
                            className="flex items-center justify-between py-1.5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: b.color }}
                              />
                              <span className="text-xs font-medium text-foreground truncate">{b.name}</span>
                            </div>
                            <div className="text-right shrink-0 ml-3 flex items-center gap-2">
                              <p className="text-xs font-semibold text-foreground">{fmt(b.value)}</p>
                              <p className="text-[10px] text-muted-foreground w-9 text-right">{pct.toFixed(0)}%</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row: Top Clients + Upcoming Renewals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Clients */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Top Clients</h2>
                    <p className="text-xs text-muted-foreground">Highest revenue generators</p>
                  </div>
                </div>
                {topClients.length > 0 && (
                  <span className="text-xs text-muted-foreground">Top {topClients.length}</span>
                )}
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : topClients.length === 0 ? (
                <RevenueEmptyState />
              ) : (
                <div className="space-y-1.5">
                  {topClients.map((client, index) => (
                    <div
                      key={client.key}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer group"
                      onClick={() => {
                        if (client.clientId) navigate(`/dashboard/clients/${client.clientId}`);
                      }}
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">{client.displayName}</p>
                          {client.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              <span className="w-1 h-1 rounded-full bg-emerald-400" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{fmt(client.revenue)}</p>
                        {client.clientId && (
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Renewals */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <CalendarClock className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Upcoming Renewals</h2>
                    <p className="text-xs text-muted-foreground">Active retainer billing schedule</p>
                  </div>
                </div>
                {upcomingRenewals.length > 0 && (
                  <span className="text-xs text-muted-foreground">{upcomingRenewals.length} upcoming</span>
                )}
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : upcomingRenewals.length === 0 ? (
                <RevenueEmptyState />
              ) : (
                <div className="space-y-1.5">
                  {upcomingRenewals.map((r) => {
                    const urgency = renewalUrgency(r.days);
                    return (
                      <div
                        key={r.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border ${urgency.border} ${urgency.bg} hover:brightness-110 transition-all cursor-pointer group`}
                        onClick={() => navigate(`/dashboard/retainers/${r.id}`)}
                      >
                        <div className={`w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center shrink-0`}>
                          <Repeat className={`w-4 h-4 ${urgency.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground truncate">{r.client_name}</p>
                            <span className={`text-[10px] uppercase tracking-wider font-medium ${urgency.color} bg-background/50 px-1.5 py-0.5 rounded`}>
                              {r.days === 0 ? "Today" : r.days === 1 ? "1 day" : `${r.days}d`}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.title}
                            {r.company_name ? ` · ${r.company_name}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {formatMoney(r.amount_cents, r.currency)}
                          </p>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row: Recent Activity (2/3) + Paid Proposals (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Revenue Activity */}
          <Card className="lg:col-span-2">
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
                <RevenueEmptyState />
              ) : (
                <div className="space-y-1.5">
                  {activityEvents.map((e) => {
                    const s = activityStyle(e.type);
                    const Icon = s.icon;
                    const isAlert = e.type === "payment_failed" || e.type === "renewal_approaching";
                    return (
                      <div
                        key={e.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                          isAlert
                            ? e.type === "payment_failed"
                              ? "border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10"
                              : "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"
                            : "border-transparent bg-secondary/30 hover:bg-secondary/50"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
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

          {/* Paid Proposals */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Paid Proposals</h2>
                    <p className="text-xs text-muted-foreground">Most recent wins</p>
                  </div>
                </div>
                {paidProposals.length > 0 && (
                  <span className="text-xs text-muted-foreground">{paidProposals.length}</span>
                )}
              </div>
              {paidProposals.length === 0 ? (
                <RevenueEmptyState />
              ) : (
                <div className="space-y-1.5">
                  {[...paidProposals].reverse().slice(0, 8).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/dashboard/proposal/${p.id}`)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.client_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-400 shrink-0 ml-2">
                        ${parseBudget(p.budget).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
