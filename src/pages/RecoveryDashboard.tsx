import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CalendarClock,
  Copy,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  CalendarRange,
  FileWarning,
  TrendingUp,
  UserX,
  MessageSquareText,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney, daysUntil } from "@/lib/retainers";
import {
  buildRecoveryTemplate,
  type RecoveryTemplateKind,
} from "@/lib/recovery-templates";

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

interface InvoiceRow {
  id: string;
  retainer_id: string;
  amount_cents: number;
  currency: string;
  due_date: string;
  paid_at: string | null;
  failed_at: string | null;
  status: string;
}

interface MessageContext {
  clientName: string;
  clientEmail?: string | null;
  amount?: string;
  dueDate?: string;
  recoveryUrl?: string;
  serviceTitle?: string;
  defaultKind: RecoveryTemplateKind;
}

/**
 * Parse a Postgres DATE ("YYYY-MM-DD") as local midnight.
 * `new Date("YYYY-MM-DD")` parses as UTC midnight, which becomes the
 * previous calendar day in negative-offset timezones (e.g. Americas) and
 * causes overdue/due-soon comparisons to drift by a day. This forces the
 * date to land on midnight in the user's local timezone.
 */
function parseLocalDate(value: string): Date {
  if (!value) return new Date(NaN);
  // Accept "YYYY-MM-DD" or full ISO strings — only the date portion matters.
  const datePart = value.length >= 10 ? value.slice(0, 10) : value;
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return new Date(value);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function formatLocalDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString();
}

export default function RecoveryDashboard() {
  const [rows, setRows] = useState<RetainerRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgCtx, setMsgCtx] = useState<MessageContext | null>(null);
  const [msgKind, setMsgKind] = useState<RecoveryTemplateKind>("payment_failed_first");
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [senderName, setSenderName] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: retainersData }, { data: invoicesData }, { data: userRes }] =
      await Promise.all([
        supabase
          .from("retainers")
          .select(
            "id, client_name, client_email, title, amount_cents, currency, status, has_failed_payment, failed_payment_reason, failed_payment_at, payment_retry_count, end_date, access_token, paddle_subscription_id, auto_renew, client_id, service_type",
          )
          .order("failed_payment_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("retainer_invoices")
          .select(
            "id, retainer_id, amount_cents, currency, due_date, paid_at, failed_at, status",
          )
          .order("due_date", { ascending: true }),
        supabase.auth.getUser(),
      ]);
    setRows((retainersData as RetainerRow[]) || []);
    setInvoices((invoicesData as InvoiceRow[]) || []);
    const meta = (userRes?.user?.user_metadata || {}) as Record<string, string>;
    setSenderName(
      meta.full_name || meta.name || (userRes?.user?.email?.split("@")[0] ?? ""),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // When the selected template kind changes, regenerate subject/body.
  useEffect(() => {
    if (!msgOpen || !msgCtx) return;
    const t = buildRecoveryTemplate(msgKind, {
      clientName: msgCtx.clientName,
      amount: msgCtx.amount,
      dueDate: msgCtx.dueDate,
      recoveryUrl: msgCtx.recoveryUrl,
      serviceTitle: msgCtx.serviceTitle,
      senderName,
    });
    setMsgSubject(t.subject);
    setMsgBody(t.body);
  }, [msgKind, msgOpen, msgCtx, senderName]);

  const failed = rows.filter((r) => r.has_failed_payment);
  const renewing = rows.filter((r) => {
    const d = daysUntil(r.end_date);
    return r.status === "active" && d !== null && d >= 0 && d <= 30;
  });

  const retainersById = useMemo(() => {
    const m = new Map<string, RetainerRow>();
    rows.forEach((r) => m.set(r.id, r));
    return m;
  }, [rows]);

  // Invoice tracking — overdue + due soon (next 14 days).
  // due_date is a Postgres DATE (YYYY-MM-DD). `new Date("YYYY-MM-DD")` parses
  // as UTC midnight, which can land on the previous local day in negative
  // offsets (Americas) and skew overdue/due-soon filtering. Parse as the
  // user's local midnight instead so comparisons match what the client sees.
  const { today, in14 } = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const f = new Date(t);
    f.setDate(f.getDate() + 14);
    return { today: t, in14: f };
  }, []);

  const overdueInvoices = useMemo(
    () =>
      invoices.filter((i) => {
        if (i.paid_at) return false;
        if (i.status === "paid" || i.status === "cancelled") return false;
        return parseLocalDate(i.due_date) < today;
      }),
    [invoices, today],
  );

  const dueSoonInvoices = useMemo(
    () =>
      invoices.filter((i) => {
        if (i.paid_at) return false;
        if (i.status === "paid" || i.status === "cancelled") return false;
        const d = parseLocalDate(i.due_date);
        return d >= today && d <= in14;
      }),
    [invoices, today, in14],
  );

  // Late-payer detection: clients with 2+ invoices that paid after due date,
  // OR currently 1+ overdue + history of late payments.
  const chronicLatePayers = useMemo(() => {
    type Stat = {
      retainer: RetainerRow;
      latePayments: number;
      onTimePayments: number;
      avgDaysLate: number;
      overdueCount: number;
      overdueAmountCents: number;
    };
    const byRetainer = new Map<string, Stat>();
    for (const inv of invoices) {
      const r = retainersById.get(inv.retainer_id);
      if (!r) continue;
      let s = byRetainer.get(inv.retainer_id);
      if (!s) {
        s = {
          retainer: r,
          latePayments: 0,
          onTimePayments: 0,
          avgDaysLate: 0,
          overdueCount: 0,
          overdueAmountCents: 0,
        };
        byRetainer.set(inv.retainer_id, s);
      }
      const due = new Date(inv.due_date);
      if (inv.paid_at) {
        const paid = new Date(inv.paid_at);
        const daysLate = Math.floor(
          (paid.getTime() - due.getTime()) / 86400000,
        );
        if (daysLate > 1) {
          s.latePayments += 1;
          s.avgDaysLate = s.avgDaysLate + daysLate;
        } else {
          s.onTimePayments += 1;
        }
      } else if (
        inv.status !== "cancelled" &&
        inv.status !== "paid" &&
        due < today
      ) {
        s.overdueCount += 1;
        s.overdueAmountCents += inv.amount_cents;
      }
    }
    const results: Stat[] = [];
    for (const s of byRetainer.values()) {
      if (s.latePayments >= 2 || (s.latePayments >= 1 && s.overdueCount >= 1)) {
        s.avgDaysLate = s.latePayments > 0 ? Math.round(s.avgDaysLate / s.latePayments) : 0;
        results.push(s);
      }
    }
    results.sort(
      (a, b) =>
        b.overdueAmountCents - a.overdueAmountCents ||
        b.latePayments - a.latePayments,
    );
    return results;
  }, [invoices, retainersById, today]);

  // Cash flow forecast — sum scheduled (unpaid) invoices in 30/60/90 day windows
  const cashFlow = useMemo(() => {
    const buckets = [30, 60, 90];
    const result: { days: number; cents: number; count: number; currency: string }[] = [];
    const currency =
      invoices[0]?.currency || rows[0]?.currency || "USD";
    for (const days of buckets) {
      const limit = new Date(today);
      limit.setDate(limit.getDate() + days);
      let cents = 0;
      let count = 0;
      for (const inv of invoices) {
        if (inv.paid_at || inv.status === "paid" || inv.status === "cancelled") continue;
        const due = new Date(inv.due_date);
        if (due >= today && due <= limit) {
          cents += inv.amount_cents;
          count += 1;
        }
      }
      result.push({ days, cents, count, currency });
    }
    return result;
  }, [invoices, rows, today]);

  const overdueAmountTotal = useMemo(() => {
    let cents = 0;
    overdueInvoices.forEach((i) => (cents += i.amount_cents));
    return { cents, currency: overdueInvoices[0]?.currency || "USD" };
  }, [overdueInvoices]);

  const copyRecoveryLink = (token: string) => {
    const url = `${window.location.origin}/r/recover/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Recovery link copied");
  };

  const openMessage = (ctx: MessageContext) => {
    setMsgCtx(ctx);
    setMsgKind(ctx.defaultKind);
    setMsgOpen(true);
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(`Subject: ${msgSubject}\n\n${msgBody}`);
    toast.success("Message copied — paste into your email client");
  };

  const emailMessage = () => {
    const to = msgCtx?.clientEmail ? encodeURIComponent(msgCtx.clientEmail) : "";
    const s = encodeURIComponent(msgSubject);
    const b = encodeURIComponent(msgBody);
    window.location.href = `mailto:${to}?subject=${s}&body=${b}`;
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
    toast.success("Recovery scan run — auto-reminders queued");
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Recovery</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track invoices, recover failed payments, predict cash flow, and
              send polite reminders — automatically.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={runCron}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Scan now
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Overdue invoices"
            value={overdueInvoices.length}
            sub={
              overdueInvoices.length > 0
                ? formatMoney(overdueAmountTotal.cents, overdueAmountTotal.currency)
                : undefined
            }
            icon={<FileWarning className="w-4 h-4 text-rose-400" />}
            tone="rose"
          />
          <StatCard
            label="Failed payments"
            value={failed.length}
            icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
            tone="amber"
          />
          <StatCard
            label="At-risk clients"
            value={chronicLatePayers.length}
            icon={<UserX className="w-4 h-4 text-purple" />}
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

        <Tabs defaultValue="invoices">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="invoices">
              Invoices ({overdueInvoices.length + dueSoonInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="failed">
              Failed payments ({failed.length})
            </TabsTrigger>
            <TabsTrigger value="atrisk">
              At-risk clients ({chronicLatePayers.length})
            </TabsTrigger>
            <TabsTrigger value="cashflow">
              Cash flow forecast
            </TabsTrigger>
            <TabsTrigger value="renewing">
              Renewing soon ({renewing.length})
            </TabsTrigger>
          </TabsList>

          {/* INVOICES — overdue + due soon */}
          <TabsContent value="invoices" className="mt-4 space-y-3">
            {loading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {!loading &&
              overdueInvoices.length === 0 &&
              dueSoonInvoices.length === 0 && (
                <Card className="border-dashed border-border/60">
                  <CardContent className="p-10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      No invoices need attention
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Overdue and upcoming invoices appear here so nothing slips
                      through the cracks.
                    </p>
                  </CardContent>
                </Card>
              )}

            {overdueInvoices.length > 0 && (
              <SectionLabel label="Overdue" tone="rose" />
            )}
            {overdueInvoices.map((inv) => {
              const r = retainersById.get(inv.retainer_id);
              if (!r) return null;
              const due = new Date(inv.due_date);
              const daysOver = Math.floor(
                (today.getTime() - due.getTime()) / 86400000,
              );
              return (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  retainer={r}
                  badgeText={`${daysOver} day${daysOver === 1 ? "" : "s"} overdue`}
                  badgeTone="border-rose-500/40 text-rose-400 bg-rose-500/10"
                  onMessage={() =>
                    openMessage({
                      clientName: r.client_name,
                      clientEmail: r.client_email,
                      amount: formatMoney(inv.amount_cents, inv.currency),
                      dueDate: due.toLocaleDateString(),
                      recoveryUrl: `${window.location.origin}/r/recover/${r.access_token}`,
                      serviceTitle: r.title,
                      defaultKind: "invoice_overdue",
                    })
                  }
                  onCopyLink={() => copyRecoveryLink(r.access_token)}
                />
              );
            })}

            {dueSoonInvoices.length > 0 && (
              <SectionLabel label="Due in next 14 days" tone="amber" />
            )}
            {dueSoonInvoices.map((inv) => {
              const r = retainersById.get(inv.retainer_id);
              if (!r) return null;
              const due = new Date(inv.due_date);
              const days = Math.max(
                0,
                Math.ceil((due.getTime() - today.getTime()) / 86400000),
              );
              return (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  retainer={r}
                  badgeText={`Due in ${days} day${days === 1 ? "" : "s"}`}
                  badgeTone="border-amber-500/40 text-amber-400 bg-amber-500/10"
                  onMessage={() =>
                    openMessage({
                      clientName: r.client_name,
                      clientEmail: r.client_email,
                      amount: formatMoney(inv.amount_cents, inv.currency),
                      dueDate: due.toLocaleDateString(),
                      recoveryUrl: `${window.location.origin}/r/recover/${r.access_token}`,
                      serviceTitle: r.title,
                      defaultKind: "invoice_due_soon",
                    })
                  }
                  onCopyLink={() => copyRecoveryLink(r.access_token)}
                />
              );
            })}
          </TabsContent>

          {/* FAILED PAYMENTS */}
          <TabsContent value="failed" className="mt-4 space-y-3">
            {loading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {!loading && failed.length === 0 && (
              <Card className="border-dashed border-border/60">
                <CardContent className="p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">All payments healthy</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    When a retainer payment fails, it lands here with a one-click recovery link and a ready-to-send message.
                  </p>
                </CardContent>
              </Card>
            )}
            {failed.map((r) => {
              const isFinal = (r.payment_retry_count || 0) >= 3;
              const attempts = r.payment_retry_count || 1;
              const defaultKind: RecoveryTemplateKind =
                isFinal
                  ? "payment_final_notice"
                  : attempts >= 2
                    ? "payment_failed_followup"
                    : "payment_failed_first";
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
                            Attempt {attempts}
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
                          onClick={() =>
                            openMessage({
                              clientName: r.client_name,
                              clientEmail: r.client_email,
                              amount: formatMoney(r.amount_cents, r.currency),
                              recoveryUrl: `${window.location.origin}/r/recover/${r.access_token}`,
                              serviceTitle: r.title,
                              defaultKind,
                            })
                          }
                        >
                          <MessageSquareText className="w-3.5 h-3.5 mr-1.5" />
                          Copy message
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyRecoveryLink(r.access_token)}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                          Recovery link
                        </Button>
                        <Button size="sm" variant="outline" asChild>
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

          {/* AT-RISK / CHRONIC LATE PAYERS */}
          <TabsContent value="atrisk" className="mt-4 space-y-3">
            {loading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {!loading && chronicLatePayers.length === 0 && (
              <Card className="border-dashed border-border/60">
                <CardContent className="p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    No late-payment patterns detected
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Clients who repeatedly pay late will be flagged here so you
                    can address it before it becomes a bigger problem.
                  </p>
                </CardContent>
              </Card>
            )}
            {chronicLatePayers.map((s) => (
              <Card key={s.retainer.id} className="border-border/60">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/dashboard/retainers/${s.retainer.id}`}
                          className="font-medium text-foreground hover:underline truncate"
                        >
                          {s.retainer.client_name}
                        </Link>
                        <Badge
                          variant="outline"
                          className="border-purple/40 text-purple bg-purple/10"
                        >
                          {s.latePayments} late payment
                          {s.latePayments === 1 ? "" : "s"}
                        </Badge>
                        {s.overdueCount > 0 && (
                          <Badge
                            variant="outline"
                            className="border-rose-500/40 text-rose-400 bg-rose-500/10"
                          >
                            {s.overdueCount} overdue now
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {s.retainer.title} ·{" "}
                        {formatMoney(s.retainer.amount_cents, s.retainer.currency)}
                        {s.avgDaysLate > 0 &&
                          ` · avg ${s.avgDaysLate} days late`}
                        {s.onTimePayments > 0 &&
                          ` · ${s.onTimePayments} on-time`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openMessage({
                            clientName: s.retainer.client_name,
                            clientEmail: s.retainer.client_email,
                            amount: formatMoney(
                              s.retainer.amount_cents,
                              s.retainer.currency,
                            ),
                            recoveryUrl: `${window.location.origin}/r/recover/${s.retainer.access_token}`,
                            serviceTitle: s.retainer.title,
                            defaultKind: "chronic_late_check_in",
                          })
                        }
                      >
                        <MessageSquareText className="w-3.5 h-3.5 mr-1.5" />
                        Send check-in
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/dashboard/retainers/${s.retainer.id}`}>
                          Open retainer
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* CASH FLOW FORECAST */}
          <TabsContent value="cashflow" className="mt-4 space-y-3">
            <Card className="border-border/60">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple" />
                  <p className="text-sm font-semibold text-foreground">
                    Expected incoming revenue
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on scheduled (unpaid) retainer invoices with upcoming
                  due dates. Excludes failed and cancelled invoices.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {cashFlow.map((b) => (
                    <div
                      key={b.days}
                      className="rounded-lg border border-border/60 bg-card/50 p-4"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Next {b.days} days
                      </p>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {formatMoney(b.cents, b.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {b.count} invoice{b.count === 1 ? "" : "s"}
                      </p>
                    </div>
                  ))}
                </div>
                {overdueInvoices.length > 0 && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-semibold text-foreground">
                        {formatMoney(
                          overdueAmountTotal.cents,
                          overdueAmountTotal.currency,
                        )}{" "}
                        overdue
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        Recovering this would meaningfully boost your forecast.
                        Send reminders from the Invoices tab.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RENEWING SOON */}
          <TabsContent value="renewing" className="mt-4 space-y-3">
            {loading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {!loading && renewing.length === 0 && (
              <Card className="border-dashed border-border/60">
                <CardContent className="p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-purple/15 flex items-center justify-center mx-auto">
                    <CalendarRange className="w-5 h-5 text-purple" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No retainers up for renewal</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Retainers ending in the next 30 days will appear here so you can renew them before they lapse.
                  </p>
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openMessage({
                              clientName: r.client_name,
                              clientEmail: r.client_email,
                              amount: formatMoney(r.amount_cents, r.currency),
                              dueDate: r.end_date
                                ? new Date(r.end_date).toLocaleDateString()
                                : undefined,
                              serviceTitle: r.title,
                              defaultKind: "renewal_reminder",
                            })
                          }
                        >
                          <MessageSquareText className="w-3.5 h-3.5 mr-1.5" />
                          Renewal message
                        </Button>
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

      {/* Ready-made follow-up message dialog */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ready-made follow-up</DialogTitle>
            <DialogDescription>
              Pick a tone, tweak if you want, then copy or email it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Template</Label>
              <Select
                value={msgKind}
                onValueChange={(v) => setMsgKind(v as RecoveryTemplateKind)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment_failed_first">
                    Payment failed — friendly first nudge
                  </SelectItem>
                  <SelectItem value="payment_failed_followup">
                    Payment failed — second reminder
                  </SelectItem>
                  <SelectItem value="payment_final_notice">
                    Final notice — service pause
                  </SelectItem>
                  <SelectItem value="invoice_due_soon">
                    Invoice due soon
                  </SelectItem>
                  <SelectItem value="invoice_overdue">
                    Invoice overdue
                  </SelectItem>
                  <SelectItem value="renewal_reminder">
                    Renewal reminder
                  </SelectItem>
                  <SelectItem value="chronic_late_check_in">
                    Chronic late-payer — gentle check-in
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-subject" className="text-xs">Subject</Label>
              <Input
                id="rec-subject"
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-body" className="text-xs">Message</Label>
              <Textarea
                id="rec-body"
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                rows={10}
                className="text-sm leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground">
                Edit freely — this is a starting point you can personalise.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={copyMessage} className="gap-2">
              <Copy className="w-4 h-4" /> Copy
            </Button>
            <Button onClick={emailMessage} className="gap-2">
              <Mail className="w-4 h-4" />
              {msgCtx?.clientEmail ? "Email client" : "Open email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function SectionLabel({ label, tone }: { label: string; tone: "rose" | "amber" }) {
  const cls =
    tone === "rose" ? "text-rose-400" : "text-amber-400";
  return (
    <p
      className={`text-[10px] uppercase tracking-wider font-semibold ${cls} mt-2`}
    >
      {label}
    </p>
  );
}

function InvoiceCard({
  invoice,
  retainer,
  badgeText,
  badgeTone,
  onMessage,
  onCopyLink,
}: {
  invoice: InvoiceRow;
  retainer: RetainerRow;
  badgeText: string;
  badgeTone: string;
  onMessage: () => void;
  onCopyLink: () => void;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/dashboard/retainers/${retainer.id}`}
                className="font-medium text-foreground hover:underline truncate"
              >
                {retainer.client_name}
              </Link>
              <Badge variant="outline" className={badgeTone}>
                {badgeText}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {retainer.title} ·{" "}
              {formatMoney(invoice.amount_cents, invoice.currency)} · due{" "}
              {new Date(invoice.due_date).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={onMessage}>
              <MessageSquareText className="w-3.5 h-3.5 mr-1.5" />
              Copy message
            </Button>
            <Button size="sm" variant="outline" onClick={onCopyLink}>
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Payment link
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  tone: "rose" | "purple" | "emerald" | "amber";
}) {
  const bg =
    tone === "rose"
      ? "bg-rose-500/10"
      : tone === "purple"
        ? "bg-purple/10"
        : tone === "amber"
          ? "bg-amber-500/10"
          : "bg-emerald-500/10";
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </p>
          <p className="text-xl font-bold text-foreground">{value}</p>
          {sub && (
            <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
