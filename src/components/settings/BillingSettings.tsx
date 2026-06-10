import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/hooks/use-plan";
import { PLANS, type PlanId } from "@/lib/plans";
import {
  CheckCircle2,
  CreditCard,
  Receipt,
  Sparkles,
  AlertTriangle,
  Download,
  Plus,
  Trash2,
  ExternalLink,
  Calendar,
  Users,
  FileText,
  HardDrive,
  Mail,
  Loader2,
} from "lucide-react";

type BillingCycle = "monthly" | "annual";
type SubStatus = "active" | "trial" | "past_due" | "cancelled";

type BillingInfo = {
  name: string;
  email: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
  vat: string;
  tax: string;
};

type SubMeta = {
  cycle: BillingCycle;
  status: SubStatus;
  startedAt: string;
  renewsAt: string;
  cancelAtPeriodEnd: boolean;
};

const EMPTY_BILLING: BillingInfo = {
  name: "",
  email: "",
  address: "",
  city: "",
  postcode: "",
  country: "United Kingdom",
  vat: "",
  tax: "",
};

const DEFAULT_META: SubMeta = {
  cycle: "monthly",
  status: "active",
  startedAt: new Date().toISOString(),
  renewsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  cancelAtPeriodEnd: false,
};

const PLAN_ORDER: PlanId[] = ["free", "starter", "pro"];

function annualPrice(monthly: number) {
  return Math.round(monthly * 12 * 0.8); // 20% off annual
}

function formatCurrency(amount: number, symbol = "£") {
  return `${symbol}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export default function BillingSettings() {
  const { toast } = useToast();
  const { planId, plan, setPlan } = usePlan();

  const [billing, setBilling] = useState<BillingInfo>(EMPTY_BILLING);
  const [billingSaving, setBillingSaving] = useState(false);
  const [meta, setMeta] = useState<SubMeta>(DEFAULT_META);
  const [pendingChange, setPendingChange] = useState<{ planId: PlanId; cycle: BillingCycle } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<{
    brand: string;
    last4: string;
    exp: string;
  } | null>(null);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [removeCardOpen, setRemoveCardOpen] = useState(false);

  // usage metrics
  const [usage, setUsage] = useState({ clients: 0, proposals: 0, emails: 0 });

  useEffect(() => {
    try {
      const b = localStorage.getItem("billing:info");
      if (b) setBilling({ ...EMPTY_BILLING, ...JSON.parse(b) });
      const m = localStorage.getItem("billing:sub");
      if (m) setMeta({ ...DEFAULT_META, ...JSON.parse(m) });
      const c = localStorage.getItem("billing:card");
      if (c) setPaymentMethod(JSON.parse(c));
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!billing.email) {
        setBilling((b) => ({ ...b, email: user.email || "" }));
      }
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [{ count: cli }, { count: prop }, { count: em }] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("proposals").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
        supabase.from("email_send_log").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
      ]);
      setUsage({ clients: cli || 0, proposals: prop || 0, emails: em || 0 });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveMeta = (next: SubMeta) => {
    setMeta(next);
    localStorage.setItem("billing:sub", JSON.stringify(next));
  };

  const saveBilling = () => {
    setBillingSaving(true);
    localStorage.setItem("billing:info", JSON.stringify(billing));
    setTimeout(() => {
      setBillingSaving(false);
      toast({ title: "Billing details saved" });
    }, 300);
  };

  const requestPlanChange = (next: PlanId, cycle: BillingCycle = meta.cycle) => {
    if (next === planId && cycle === meta.cycle) return;
    setPendingChange({ planId: next, cycle });
  };

  const confirmPlanChange = () => {
    if (!pendingChange) return;
    setPlan(pendingChange.planId);
    const renews = new Date(
      Date.now() + (pendingChange.cycle === "annual" ? 365 : 30) * 86400000
    ).toISOString();
    saveMeta({
      ...meta,
      cycle: pendingChange.cycle,
      status: pendingChange.planId === "free" ? "cancelled" : "active",
      cancelAtPeriodEnd: false,
      renewsAt: renews,
      startedAt: planId === pendingChange.planId ? meta.startedAt : new Date().toISOString(),
    });
    toast({
      title:
        pendingChange.planId === "free"
          ? "Subscription cancelled"
          : `${PLANS[pendingChange.planId].name} plan activated`,
      description:
        pendingChange.planId === "free"
          ? "You'll keep access until the end of your billing period."
          : `Billing ${pendingChange.cycle}.`,
    });
    setPendingChange(null);
  };

  const cancelSubscription = () => {
    saveMeta({ ...meta, status: "active", cancelAtPeriodEnd: true });
    setCancelOpen(false);
    toast({
      title: "Subscription will cancel",
      description: `You'll keep access until ${fmtDate(meta.renewsAt)}.`,
    });
  };

  const reactivateSubscription = () => {
    saveMeta({ ...meta, status: "active", cancelAtPeriodEnd: false });
    toast({ title: "Subscription reactivated" });
  };

  const addPaymentMethod = (brand: string, last4: string, exp: string) => {
    const pm = { brand, last4, exp };
    setPaymentMethod(pm);
    localStorage.setItem("billing:card", JSON.stringify(pm));
    setAddCardOpen(false);
    toast({ title: "Payment method added" });
  };

  const removePaymentMethod = () => {
    setPaymentMethod(null);
    localStorage.removeItem("billing:card");
    setRemoveCardOpen(false);
    toast({ title: "Payment method removed" });
  };

  // Mock invoices for paid plans
  const invoices = useMemo(() => {
    if (planId === "free") return [];
    const price = meta.cycle === "annual" ? annualPrice(plan.priceMonthly) : plan.priceMonthly;
    const start = new Date(meta.startedAt).getTime();
    const interval = meta.cycle === "annual" ? 365 * 86400000 : 30 * 86400000;
    const items: { number: string; date: string; amount: number; status: "paid" | "open" }[] = [];
    const now = Date.now();
    let t = start;
    let i = 1;
    while (t <= now && i <= 12) {
      items.push({
        number: `INV-${new Date(t).getFullYear()}${String(i).padStart(4, "0")}`,
        date: new Date(t).toISOString(),
        amount: price,
        status: "paid",
      });
      t += interval;
      i++;
    }
    return items.reverse();
  }, [planId, plan, meta]);

  const downloadInvoice = (inv: { number: string; date: string; amount: number }) => {
    const lines = [
      `CloseSync AI — Invoice`,
      ``,
      `Invoice number: ${inv.number}`,
      `Date: ${fmtDate(inv.date)}`,
      `Plan: ${plan.name} (${meta.cycle})`,
      `Billed to: ${billing.name || billing.email || "—"}`,
      billing.address ? `Address: ${billing.address}, ${billing.city} ${billing.postcode}` : "",
      billing.vat ? `VAT: ${billing.vat}` : "",
      ``,
      `Amount: ${formatCurrency(inv.amount)}`,
      `Status: Paid`,
    ].filter(Boolean).join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = () => {
    const map: Record<SubStatus, { label: string; cls: string }> = {
      active: { label: "Active", cls: "border-emerald-500/30 text-emerald-500" },
      trial: { label: "Trial", cls: "border-accent/30 text-accent" },
      past_due: { label: "Past due", cls: "border-amber-500/30 text-amber-500" },
      cancelled: { label: "Cancelled", cls: "border-muted-foreground/30 text-muted-foreground" },
    };
    const m = map[meta.status];
    return <Badge variant="outline" className={`text-xs ${m.cls}`}>{m.label}</Badge>;
  };

  const limits = {
    clients: planId === "pro" ? "Unlimited" : planId === "starter" ? "50" : "5",
    proposals: typeof plan.features.proposalsPerMonth === "number" ? plan.features.proposalsPerMonth : "Unlimited",
    storage: planId === "pro" ? "50 GB" : planId === "starter" ? "10 GB" : "1 GB",
    team: planId === "pro" ? "10" : "1",
    emails: planId === "pro" ? "Unlimited" : planId === "starter" ? "500/mo" : "50/mo",
  };

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground">{plan.name} plan</h3>
                  {statusBadge()}
                  {meta.cancelAtPeriodEnd && (
                    <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                      Ends {fmtDate(meta.renewsAt)}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {planId === "free"
                    ? "No active subscription"
                    : `${meta.cycle === "annual" ? "Annual" : "Monthly"} billing · Renews ${fmtDate(meta.renewsAt)}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(meta.cycle === "annual" ? annualPrice(plan.priceMonthly) : plan.priceMonthly, plan.currencySymbol)}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  /{meta.cycle === "annual" ? "yr" : "mo"}
                </span>
              </p>
            </div>
          </div>

          {planId !== "free" && (
            <>
              <Separator className="my-4" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Billing cycle</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Annual billing saves 20%
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={meta.cycle === "monthly" ? "text-foreground font-medium" : "text-muted-foreground"}>Monthly</span>
                  <Switch
                    checked={meta.cycle === "annual"}
                    onCheckedChange={(v) => requestPlanChange(planId, v ? "annual" : "monthly")}
                  />
                  <span className={meta.cycle === "annual" ? "text-foreground font-medium" : "text-muted-foreground"}>Annual</span>
                </div>
              </div>
            </>
          )}

          {meta.cancelAtPeriodEnd && (
            <div className="mt-4 p-3 rounded-md border border-destructive/30 bg-destructive/5 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-foreground">Subscription scheduled to cancel</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You'll keep {plan.name} features until {fmtDate(meta.renewsAt)}.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={reactivateSubscription}>
                Keep my plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Available plans</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Upgrade, downgrade or switch billing cycle any time</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={meta.cycle === "monthly" ? "text-foreground font-medium" : "text-muted-foreground"}>Monthly</span>
              <Switch
                checked={meta.cycle === "annual"}
                onCheckedChange={(v) => saveMeta({ ...meta, cycle: v ? "annual" : "monthly" })}
              />
              <span className={meta.cycle === "annual" ? "text-foreground font-medium" : "text-muted-foreground"}>
                Annual <span className="text-emerald-500">-20%</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PLAN_ORDER.map((pid) => {
              const p = PLANS[pid];
              const isCurrent = pid === planId;
              const price = meta.cycle === "annual" ? annualPrice(p.priceMonthly) : p.priceMonthly;
              const monthlyEquivalent = meta.cycle === "annual" ? Math.round((annualPrice(p.priceMonthly) / 12) * 10) / 10 : p.priceMonthly;
              return (
                <div
                  key={pid}
                  className={`rounded-lg border p-4 transition-colors ${
                    isCurrent
                      ? "border-accent bg-accent/5"
                      : p.highlight
                      ? "border-accent/40"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-foreground">{p.name}</h4>
                      {p.highlight && !isCurrent && (
                        <Badge variant="outline" className="text-[9px] border-accent/40 text-accent">
                          Popular
                        </Badge>
                      )}
                    </div>
                    {isCurrent && (
                      <Badge className="text-[10px] bg-accent text-accent-foreground hover:bg-accent">Current</Badge>
                    )}
                  </div>
                  <div className="mb-1">
                    <span className="text-xl font-bold text-foreground">
                      {formatCurrency(price, p.currencySymbol)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      /{meta.cycle === "annual" ? "yr" : "mo"}
                    </span>
                  </div>
                  {meta.cycle === "annual" && p.priceMonthly > 0 && (
                    <p className="text-[11px] text-muted-foreground mb-3">
                      ≈ {formatCurrency(monthlyEquivalent, p.currencySymbol)}/mo
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mb-3 min-h-[32px]">{p.tagline}</p>
                  <ul className="space-y-1.5 mb-4">
                    {p.bullets.slice(0, 4).map((b) => (
                      <li key={b} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant={isCurrent ? "outline" : p.highlight ? "default" : "outline"}
                    className="w-full"
                    disabled={isCurrent}
                    onClick={() => requestPlanChange(pid)}
                  >
                    {isCurrent ? "Current plan" : pid === "free" ? "Downgrade" : `Switch to ${p.name}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Usage this month</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <UsageMetric icon={Users} label="Active clients" value={usage.clients} limit={limits.clients} />
            <UsageMetric icon={FileText} label="Proposals" value={usage.proposals} limit={limits.proposals} />
            <UsageMetric icon={Mail} label="Emails sent" value={usage.emails} limit={limits.emails} />
            <UsageMetric icon={HardDrive} label="Storage" value="—" limit={limits.storage} />
          </div>
        </CardContent>
      </Card>

      {/* Payment method */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Payment method</h3>
            </div>
            {paymentMethod && (
              <Button variant="outline" size="sm" onClick={() => setAddCardOpen(true)}>
                Update
              </Button>
            )}
          </div>
          {paymentMethod ? (
            <div className="flex items-center justify-between p-4 rounded-md border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-7 rounded bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center text-[10px] font-bold text-foreground">
                  {paymentMethod.brand}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {paymentMethod.brand} ending in {paymentMethod.last4}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Expires {paymentMethod.exp}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setRemoveCardOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-border rounded-md">
              <CreditCard className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No payment method on file</p>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setAddCardOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Add payment method
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing information */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Billing information</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Used on your CloseSync subscription invoices.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Billing name" value={billing.name} onChange={(v) => setBilling({ ...billing, name: v })} />
            <Field label="Billing email" type="email" value={billing.email} onChange={(v) => setBilling({ ...billing, email: v })} />
            <Field
              label="Address"
              value={billing.address}
              onChange={(v) => setBilling({ ...billing, address: v })}
              className="md:col-span-2"
            />
            <Field label="City" value={billing.city} onChange={(v) => setBilling({ ...billing, city: v })} />
            <Field label="Postcode" value={billing.postcode} onChange={(v) => setBilling({ ...billing, postcode: v })} />
            <Field label="Country" value={billing.country} onChange={(v) => setBilling({ ...billing, country: v })} />
            <div />
            <Field label="VAT number (optional)" value={billing.vat} onChange={(v) => setBilling({ ...billing, vat: v })} />
            <Field label="Tax number (optional)" value={billing.tax} onChange={(v) => setBilling({ ...billing, tax: v })} />
          </div>

          <div className="flex justify-end mt-5">
            <Button onClick={saveBilling} disabled={billingSaving}>
              {billingSaving ? "Saving..." : "Save details"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Billing history */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Billing history</h3>
          </div>

          {invoices.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No invoices yet. Subscription invoices will appear here.
            </div>
          ) : (
            <div className="divide-y divide-border -mx-2">
              {invoices.map((inv) => (
                <div key={inv.number} className="flex items-center justify-between px-2 py-3 hover:bg-muted/30 rounded-md">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{inv.number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(inv.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{formatCurrency(inv.amount)}</span>
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500 capitalize">
                      {inv.status}
                    </Badge>
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => downloadInvoice(inv)}>
                      <Download className="w-3.5 h-3.5" /> PDF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      {planId !== "free" && !meta.cancelAtPeriodEnd && (
        <Card className="border-destructive/30">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Cancel subscription</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  You'll keep access until the end of your billing period. You can reactivate any time.
                </p>
              </div>
              <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/5" onClick={() => setCancelOpen(true)}>
                Cancel plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan change confirmation */}
      <Dialog open={!!pendingChange} onOpenChange={(o) => !o && setPendingChange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingChange?.planId === "free"
                ? "Downgrade to Free?"
                : pendingChange?.planId === planId
                ? `Switch to ${pendingChange?.cycle} billing?`
                : `Switch to ${pendingChange ? PLANS[pendingChange.planId].name : ""}?`}
            </DialogTitle>
            <DialogDescription>
              {pendingChange?.planId === "free"
                ? "You'll lose access to premium features at the end of your current period."
                : pendingChange
                ? `You'll be billed ${formatCurrency(
                    pendingChange.cycle === "annual"
                      ? annualPrice(PLANS[pendingChange.planId].priceMonthly)
                      : PLANS[pendingChange.planId].priceMonthly,
                    PLANS[pendingChange.planId].currencySymbol
                  )}/${pendingChange.cycle === "annual" ? "year" : "month"}. Changes take effect immediately, prorated for any time remaining.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingChange(null)}>Cancel</Button>
            <Button onClick={confirmPlanChange}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel subscription dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Cancel your {plan.name} plan?
            </DialogTitle>
            <DialogDescription>
              You'll keep access until {fmtDate(meta.renewsAt)}, then your account will move to Free.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted/40 p-4 text-xs text-muted-foreground space-y-1.5">
            <p className="text-foreground font-medium mb-1">What you'll lose:</p>
            {plan.bullets.slice(0, 4).map((b) => (
              <p key={b}>· {b}</p>
            ))}
            <p className="text-foreground pt-2">You can reactivate any time before {fmtDate(meta.renewsAt)} to keep your data and settings.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep plan</Button>
            <Button variant="destructive" onClick={cancelSubscription}>Cancel subscription</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / update payment method dialog */}
      <AddCardDialog
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        onSave={addPaymentMethod}
      />

      {/* Remove card dialog */}
      <Dialog open={removeCardOpen} onOpenChange={setRemoveCardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove payment method?</DialogTitle>
            <DialogDescription>
              Your subscription won't renew without a payment method. You can add a new one any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveCardOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={removePaymentMethod}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5"
      />
    </div>
  );
}

function UsageMetric({
  icon: Icon,
  label,
  value,
  limit,
}: {
  icon: any;
  label: string;
  value: number | string;
  limit: string | number;
}) {
  const pct =
    typeof value === "number" && typeof limit === "number" && limit > 0
      ? Math.min(100, Math.round((value / limit) * 100))
      : null;
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">of {limit}</p>
      {pct !== null && (
        <div className="mt-2 w-full h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full ${pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function AddCardDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (brand: string, last4: string, exp: string) => void;
}) {
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSave = () => {
    const digits = number.replace(/\D/g, "");
    if (digits.length < 12) return;
    setBusy(true);
    const brand =
      digits.startsWith("4") ? "Visa"
      : /^5[1-5]/.test(digits) ? "Mastercard"
      : /^3[47]/.test(digits) ? "Amex"
      : "Card";
    setTimeout(() => {
      onSave(brand, digits.slice(-4), exp || "12/29");
      setBusy(false);
      setNumber(""); setExp(""); setCvc(""); setName("");
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payment method</DialogTitle>
          <DialogDescription>
            Cards are tokenised by our payment processor. We never store full card details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Cardholder name" value={name} onChange={setName} />
          <Field label="Card number" value={number} onChange={setNumber} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry (MM/YY)" value={exp} onChange={setExp} />
            <Field label="CVC" value={cvc} onChange={setCvc} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy || number.replace(/\D/g, "").length < 12}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
