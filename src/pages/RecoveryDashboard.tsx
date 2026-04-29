import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CalendarClock,
  Copy,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney, daysUntil } from "@/lib/retainers";

interface RetainerRow {
  id: string;
  client_name: string;
  client_email: string | null;
  title: string;
  amount_cents: number;
  currency: string;
  status: string;
  has_failed_payment: boolean;
  failed_payment_reason: string | null;
  failed_payment_at: string | null;
  payment_retry_count: number;
  end_date: string | null;
  access_token: string;
  paddle_subscription_id: string | null;
  auto_renew: boolean;
  client_id: string | null;
  service_type: string | null;
}

export default function RecoveryDashboard() {
  const [rows, setRows] = useState<RetainerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("retainers")
      .select(
        "id, client_name, client_email, title, amount_cents, currency, status, has_failed_payment, failed_payment_reason, failed_payment_at, payment_retry_count, end_date, access_token, paddle_subscription_id, auto_renew, client_id, service_type",
      )
      .order("failed_payment_at", { ascending: false, nullsFirst: false });
    setRows((data as RetainerRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const failed = rows.filter((r) => r.has_failed_payment);
  const renewing = rows.filter((r) => {
    const d = daysUntil(r.end_date);
    return r.status === "active" && d !== null && d >= 0 && d <= 30;
  });

  const copyRecoveryLink = (token: string) => {
    const url = `${window.location.origin}/r/recover/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Recovery link copied");
  };

  const markResolved = async (id: string) => {
    await supabase
      .from("retainers")
      .update({
        has_failed_payment: false,
        failed_payment_reason: null,
        failed_payment_at: null,
        payment_retry_count: 0,
      })
      .eq("id", id);
    await supabase
      .from("retainer_reminders")
      .update({ status: "resolved" })
      .eq("retainer_id", id)
      .in("kind", ["payment_failed", "payment_final"]);
    toast.success("Marked as resolved");
    load();
  };

  const runCron = async () => {
    await supabase.functions.invoke("retainer-recovery-cron");
    toast.success("Recovery scan run");
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Recovery</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Failed payments and upcoming renewals — keep recurring revenue
              from slipping.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={runCron}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Scan now
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Failed payments"
            value={failed.length}
            icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
            tone="rose"
          />
          <StatCard
            label="Renewing in 30 days"
            value={renewing.length}
            icon={<CalendarClock className="w-4 h-4 text-purple" />}
            tone="purple"
          />
          <StatCard
            label="Healthy retainers"
            value={
              rows.filter((r) => r.status === "active" && !r.has_failed_payment)
                .length
            }
            icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
            tone="emerald"
          />
        </div>

        <Tabs defaultValue="failed">
          <TabsList>
            <TabsTrigger value="failed">
              Failed payments ({failed.length})
            </TabsTrigger>
            <TabsTrigger value="renewing">
              Renewing soon ({renewing.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="failed" className="mt-4 space-y-3">
            {loading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {!loading && failed.length === 0 && (
              <Card className="border-border/60">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No failed payments. Nice work.
                </CardContent>
              </Card>
            )}
            {failed.map((r) => {
              const isFinal = (r.payment_retry_count || 0) >= 3;
              return (
                <Card key={r.id} className="border-border/60">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/dashboard/retainers/${r.id}`}
                            className="font-medium text-foreground hover:underline truncate"
                          >
                            {r.client_name}
                          </Link>
                          <Badge
                            variant="outline"
                            className={
                              isFinal
                                ? "border-rose-500/40 text-rose-400 bg-rose-500/10"
                                : "border-amber-500/40 text-amber-400 bg-amber-500/10"
                            }
                          >
                            {isFinal ? "Final attempt" : "Retrying"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Attempt {r.payment_retry_count || 1}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {r.title} · {formatMoney(r.amount_cents, r.currency)}
                          {r.failed_payment_reason &&
                            ` · ${r.failed_payment_reason}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyRecoveryLink(r.access_token)}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                          Copy recovery link
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a
                            href={`/r/recover/${r.access_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            Preview
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markResolved(r.id)}
                        >
                          Mark resolved
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="renewing" className="mt-4 space-y-3">
            {loading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {!loading && renewing.length === 0 && (
              <Card className="border-border/60">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No retainers renewing in the next 30 days.
                </CardContent>
              </Card>
            )}
            {renewing.map((r) => {
              const days = daysUntil(r.end_date) ?? 0;
              const tone =
                days <= 7
                  ? "border-rose-500/40 text-rose-400 bg-rose-500/10"
                  : days <= 14
                    ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                    : "border-purple/40 text-purple bg-purple/10";
              const renewalState = {
                prefillFromClient: {
                  client_id: r.client_id || undefined,
                  client_name: r.client_name,
                  service_type: r.service_type || "Retainer renewal",
                  budget: formatMoney(r.amount_cents, r.currency),
                  original_lead_message: `Renewal of retainer: ${r.title}`,
                },
                renewalOfRetainerId: r.id,
              };
              return (
                <Card key={r.id} className="border-border/60">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/dashboard/retainers/${r.id}`}
                            className="font-medium text-foreground hover:underline truncate"
                          >
                            {r.client_name}
                          </Link>
                          <Badge variant="outline" className={tone}>
                            Renews in {days} day{days === 1 ? "" : "s"}
                          </Badge>
                          {r.auto_renew && (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                            >
                              Auto-renew on
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {r.title} · {formatMoney(r.amount_cents, r.currency)}{" "}
                          · ends{" "}
                          {r.end_date
                            ? new Date(r.end_date).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/dashboard/new" state={renewalState}>
                            Generate renewal proposal
                          </Link>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/dashboard/retainers/${r.id}`}>
                            Open retainer
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "rose" | "purple" | "emerald";
}) {
  const bg =
    tone === "rose"
      ? "bg-rose-500/10"
      : tone === "purple"
        ? "bg-purple/10"
        : "bg-emerald-500/10";
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
