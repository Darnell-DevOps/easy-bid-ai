import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  Repeat,
  Plus,
  Search,
  AlertTriangle,
  CalendarClock,
  TrendingUp,
} from "lucide-react";
import {
  formatMoney,
  monthlyEquivalentCents,
  intervalLabel,
  statusBadgeClasses,
  daysUntil,
} from "@/lib/retainers";

interface Retainer {
  id: string;
  client_name: string;
  company_name: string | null;
  title: string;
  amount_cents: number;
  currency: string;
  billing_interval: string;
  custom_interval_days: number | null;
  status: string;
  next_billing_date: string | null;
  end_date: string | null;
  has_failed_payment: boolean;
  total_billed_cents: number;
  created_at: string;
}

export default function RetainersPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Retainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("retainers")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      setRows((data as Retainer[]) || []);
      setLoading(false);
    })();
  }, []);

  const metrics = useMemo(() => {
    const active = rows.filter((r) => r.status === "active");
    const mrrCents = active.reduce(
      (acc, r) =>
        acc + monthlyEquivalentCents(r.amount_cents, r.billing_interval, r.custom_interval_days),
      0,
    );
    const upcomingThisWeek = active.filter((r) => {
      const d = daysUntil(r.next_billing_date);
      return d !== null && d >= 0 && d <= 7;
    }).length;
    const failed = rows.filter((r) => r.has_failed_payment).length;
    const renewingSoon = active.filter((r) => {
      const d = daysUntil(r.end_date);
      return d !== null && d >= 0 && d <= 14;
    }).length;
    const currency = active[0]?.currency || "USD";
    return { mrrCents, currency, active: active.length, upcomingThisWeek, failed, renewingSoon };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !`${r.client_name} ${r.company_name || ""} ${r.title}`.toLowerCase().includes(q.toLowerCase()))
        return false;
      return true;
    });
  }, [rows, q, statusFilter]);

  const statuses = ["all", "active", "draft", "paused", "pending_renewal", "cancelled", "completed"];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Repeat className="w-6 h-6 text-accent" /> Retainers
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Recurring revenue, retainers, and ongoing client billing.
            </p>
          </div>
          <Button
            onClick={() => navigate("/dashboard/retainers/new")}
            className="bg-gradient-to-r from-accent to-purple text-white hover:brightness-110 gap-2"
          >
            <Plus className="w-4 h-4" /> New Retainer
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="MRR"
            value={formatMoney(metrics.mrrCents, metrics.currency)}
            tone="accent"
          />
          <MetricCard
            icon={<Repeat className="w-4 h-4" />}
            label="Active"
            value={String(metrics.active)}
          />
          <MetricCard
            icon={<CalendarClock className="w-4 h-4" />}
            label="Charging this week"
            value={String(metrics.upcomingThisWeek)}
            tone={metrics.upcomingThisWeek > 0 ? "purple" : undefined}
          />
          <MetricCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Failed payments"
            value={String(metrics.failed)}
            tone={metrics.failed > 0 ? "rose" : undefined}
          />
        </div>

        {/* Priority alerts */}
        {(metrics.failed > 0 || metrics.renewingSoon > 0) && (
          <div className="space-y-2">
            {metrics.failed > 0 && (
              <Card className="border-rose-500/30 bg-rose-500/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-rose-200">
                      {metrics.failed} payment{metrics.failed > 1 ? "s" : ""} need recovery
                    </p>
                    <p className="text-xs text-rose-200/70">
                      Retry charges or send a manual payment request to keep retainers active.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            {metrics.renewingSoon > 0 && (
              <Card className="border-purple/30 bg-purple/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <CalendarClock className="w-5 h-5 text-purple shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-purple-200">
                      {metrics.renewingSoon} retainer{metrics.renewingSoon > 1 ? "s" : ""} renewing within 14 days
                    </p>
                    <p className="text-xs text-purple-200/70">
                      Send a renewal proposal to lock in the next term.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by client, company, or title…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors capitalize ${
                  statusFilter === s
                    ? "bg-accent/15 text-accent border-accent/40"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed border-border/60">
            <CardContent className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center mx-auto">
                <Repeat className="w-5 h-5 text-accent" />
              </div>
              <p className="text-sm font-semibold text-foreground">No retainers yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Create a retainer to bill clients on a recurring schedule — monthly,
                weekly, quarterly, or custom.
              </p>
              <Button
                onClick={() => navigate("/dashboard/retainers/new")}
                size="sm"
                className="gap-2"
              >
                <Plus className="w-4 h-4" /> Create your first retainer
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((r) => (
              <Link
                key={r.id}
                to={`/dashboard/retainers/${r.id}`}
                className="block group"
              >
                <Card className="border-border/60 hover:border-accent/40 transition-colors h-full">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {r.client_name}
                          {r.company_name ? (
                            <span className="text-muted-foreground font-normal"> · {r.company_name}</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{r.title}</p>
                      </div>
                      <Badge variant="outline" className={`capitalize ${statusBadgeClasses(r.status)}`}>
                        {r.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-foreground">
                        {formatMoney(r.amount_cents, r.currency)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        / {intervalLabel(r.billing_interval, r.custom_interval_days).toLowerCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {r.next_billing_date
                          ? `Next: ${new Date(r.next_billing_date).toLocaleDateString()}`
                          : "Not scheduled"}
                      </span>
                      {r.has_failed_payment && (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "accent" | "purple" | "rose";
}) {
  const toneClass =
    tone === "accent"
      ? "bg-accent/10 border-accent/30"
      : tone === "purple"
        ? "bg-purple/10 border-purple/30"
        : tone === "rose"
          ? "bg-rose-500/10 border-rose-500/30"
          : "border-border/60 bg-card/50";
  return (
    <Card className={`${toneClass} border`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
        </div>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
