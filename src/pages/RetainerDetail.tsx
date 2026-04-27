import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  formatMoney,
  intervalLabel,
  monthlyEquivalentCents,
  statusBadgeClasses,
  computeNextBillingDate,
  daysUntil,
} from "@/lib/retainers";
import {
  ArrowLeft,
  Pause,
  Play,
  X,
  RefreshCw,
  AlertTriangle,
  Send,
  Mail,
  Repeat,
  Trash2,
  Link2,
  Copy,
  CheckCircle2,
  Calendar,
} from "lucide-react";

interface Retainer {
  id: string;
  client_name: string;
  client_email: string | null;
  company_name: string | null;
  title: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  billing_interval: string;
  custom_interval_days: number | null;
  status: string;
  start_date: string;
  end_date: string | null;
  auto_renew: boolean;
  next_billing_date: string | null;
  last_billed_date: string | null;
  total_billed_cents: number;
  total_payments_count: number;
  has_failed_payment: boolean;
  failed_payment_reason: string | null;
  notes: string | null;
  service_type: string | null;
  template_key: string | null;
  access_token: string;
  paddle_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface Invoice {
  id: string;
  amount_cents: number;
  currency: string;
  due_date: string;
  paid_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  status: string;
}

export default function RetainerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [retainer, setRetainer] = useState<Retainer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    if (!id) return;
    const [r, inv] = await Promise.all([
      supabase.from("retainers").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("retainer_invoices")
        .select("*")
        .eq("retainer_id", id)
        .order("due_date", { ascending: false }),
    ]);
    setRetainer(r.data as Retainer | null);
    setInvoices((inv.data as Invoice[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const update = async (patch: Record<string, any>, msg: string) => {
    if (!retainer) return;
    const { error } = await supabase.from("retainers").update(patch as any).eq("id", retainer.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: msg });
    fetchAll();
  };

  const activate = () => {
    if (!retainer) return;
    const next = computeNextBillingDate(
      retainer.start_date,
      retainer.billing_interval,
      retainer.custom_interval_days,
    );
    update(
      {
        status: "active",
        next_billing_date: next.toISOString().slice(0, 10),
        paused_at: null,
        cancelled_at: null,
      },
      "Retainer activated",
    );
  };

  const pause = () =>
    update({ status: "paused", paused_at: new Date().toISOString() }, "Retainer paused");

  const cancel = () => {
    if (!confirm("Cancel this retainer? Future billing will stop.")) return;
    update(
      { status: "cancelled", cancelled_at: new Date().toISOString() },
      "Retainer cancelled",
    );
  };

  const renew = () => {
    if (!retainer) return;
    // Push end date forward by one interval (simple renewal)
    const newEnd = retainer.end_date
      ? computeNextBillingDate(
          retainer.end_date,
          retainer.billing_interval,
          retainer.custom_interval_days,
          new Date(retainer.end_date),
        )
      : null;
    update(
      {
        status: "active",
        renewed_at: new Date().toISOString(),
        end_date: newEnd ? newEnd.toISOString().slice(0, 10) : null,
      },
      "Retainer renewed",
    );
  };

  const clearFailed = () =>
    update(
      { has_failed_payment: false, failed_payment_reason: null, failed_payment_at: null },
      "Failed payment cleared",
    );

  const markPaymentReceived = async () => {
    if (!retainer) return;
    const next = computeNextBillingDate(
      retainer.next_billing_date || retainer.start_date,
      retainer.billing_interval,
      retainer.custom_interval_days,
      new Date(),
    );
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return;

    await supabase.from("retainer_invoices").insert({
      user_id: userId,
      retainer_id: retainer.id,
      amount_cents: retainer.amount_cents,
      currency: retainer.currency,
      due_date: retainer.next_billing_date || new Date().toISOString().slice(0, 10),
      paid_at: new Date().toISOString(),
      status: "paid",
    });

    update(
      {
        last_billed_date: new Date().toISOString().slice(0, 10),
        next_billing_date: next.toISOString().slice(0, 10),
        total_billed_cents: retainer.total_billed_cents + retainer.amount_cents,
        total_payments_count: retainer.total_payments_count + 1,
        has_failed_payment: false,
        failed_payment_reason: null,
      },
      "Payment recorded",
    );
  };

  const deleteRetainer = async () => {
    if (!retainer) return;
    if (!confirm("Delete this retainer permanently? This cannot be undone.")) return;
    await supabase.from("retainers").delete().eq("id", retainer.id);
    toast({ title: "Retainer deleted" });
    navigate("/dashboard/retainers");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </DashboardLayout>
    );
  }

  if (!retainer) {
    return (
      <DashboardLayout>
        <p className="text-sm text-muted-foreground">Retainer not found.</p>
      </DashboardLayout>
    );
  }

  const isActive = retainer.status === "active";
  const isPaused = retainer.status === "paused";
  const isCancelled = retainer.status === "cancelled";
  const mrr = monthlyEquivalentCents(
    retainer.amount_cents,
    retainer.billing_interval,
    retainer.custom_interval_days,
  );
  const renewIn = daysUntil(retainer.end_date);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <button
          onClick={() => navigate("/dashboard/retainers")}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> All retainers
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {retainer.client_name}
              </h1>
              <Badge variant="outline" className={`capitalize ${statusBadgeClasses(retainer.status)}`}>
                {retainer.status.replace("_", " ")}
              </Badge>
              {retainer.has_failed_payment && (
                <Badge variant="outline" className="bg-rose-500/15 text-rose-400 border-rose-500/30">
                  Payment failed
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {retainer.title}
              {retainer.company_name ? ` · ${retainer.company_name}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isActive && (
              <Button variant="outline" size="sm" onClick={pause} className="gap-1.5">
                <Pause className="w-3.5 h-3.5" /> Pause
              </Button>
            )}
            {(isPaused || isCancelled || retainer.status === "draft") && (
              <Button
                size="sm"
                onClick={activate}
                className="gap-1.5 bg-gradient-to-r from-accent to-purple text-white hover:brightness-110"
              >
                <Play className="w-3.5 h-3.5" /> {isCancelled ? "Reactivate" : "Activate"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={renew} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Renew
            </Button>
            {!isCancelled && (
              <Button variant="outline" size="sm" onClick={cancel} className="gap-1.5 text-rose-400 hover:text-rose-300">
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={deleteRetainer} className="gap-1.5 text-muted-foreground">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Failed payment alert */}
        {retainer.has_failed_payment && (
          <Card className="border-rose-500/30 bg-rose-500/5">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-rose-200">Payment failed</p>
                <p className="text-xs text-rose-200/70">
                  {retainer.failed_payment_reason || "The last attempted charge did not go through."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Send className="w-3.5 h-3.5" /> Resend payment request
                </Button>
                <Button size="sm" variant="ghost" onClick={clearFailed}>
                  Mark resolved
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Renewing soon */}
        {isActive && renewIn !== null && renewIn >= 0 && renewIn <= 14 && (
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-purple-400" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-purple-200">
                  Contract ends in {renewIn} day{renewIn === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-purple-200/70">
                  Send a renewal proposal to keep the retainer running.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={renew}>
                Mark renewed
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Amount" value={formatMoney(retainer.amount_cents, retainer.currency)} sub={`/ ${intervalLabel(retainer.billing_interval, retainer.custom_interval_days).toLowerCase()}`} />
          <StatCard label="Monthly equivalent" value={formatMoney(mrr, retainer.currency)} />
          <StatCard
            label="Next billing"
            value={
              retainer.next_billing_date
                ? new Date(retainer.next_billing_date).toLocaleDateString()
                : "—"
            }
          />
          <StatCard
            label="Total billed"
            value={formatMoney(retainer.total_billed_cents, retainer.currency)}
            sub={`${retainer.total_payments_count} payment${retainer.total_payments_count === 1 ? "" : "s"}`}
          />
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardContent className="p-5 space-y-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Details
              </p>
              {retainer.description && (
                <p className="text-sm text-foreground/90 leading-relaxed">{retainer.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Service" value={retainer.service_type || "—"} />
                <Field label="Frequency" value={intervalLabel(retainer.billing_interval, retainer.custom_interval_days)} />
                <Field label="Start date" value={new Date(retainer.start_date).toLocaleDateString()} />
                <Field
                  label="End date"
                  value={retainer.end_date ? new Date(retainer.end_date).toLocaleDateString() : "Open-ended"}
                />
                <Field label="Auto-renew" value={retainer.auto_renew ? "Yes" : "No"} />
                <Field label="Last billed" value={retainer.last_billed_date ? new Date(retainer.last_billed_date).toLocaleDateString() : "—"} />
              </div>
              {retainer.notes && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Internal notes
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{retainer.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Client
              </p>
              <div className="space-y-2 text-sm">
                <p className="text-foreground font-medium">{retainer.client_name}</p>
                {retainer.client_email && (
                  <a
                    href={`mailto:${retainer.client_email}`}
                    className="text-xs text-accent hover:underline flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3" /> {retainer.client_email}
                  </a>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1.5"
                onClick={markPaymentReceived}
              >
                <Repeat className="w-3.5 h-3.5" /> Record manual payment
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Invoices */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Billing history
            </p>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payments recorded yet. Use "Record manual payment" once a charge clears.
              </p>
            ) : (
              <div className="divide-y divide-border/40">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="text-foreground font-medium">
                        {formatMoney(inv.amount_cents, inv.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due {new Date(inv.due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`capitalize ${
                        inv.status === "paid"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : inv.status === "failed"
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {inv.status}
                    </Badge>
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

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </p>
        <p className="text-lg font-bold text-foreground">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </p>
      <p className="text-foreground mt-0.5">{value}</p>
    </div>
  );
}
