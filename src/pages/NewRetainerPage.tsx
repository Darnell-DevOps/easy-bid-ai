import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  RETAINER_TEMPLATES,
  CURRENCIES,
  computeNextBillingDate,
  formatMoney,
  intervalLabel,
} from "@/lib/retainers";
import { calculateCommercialTotals, type TaxMode } from "@/lib/commercial-calc";
import { ArrowLeft, Repeat, Sparkles, Check } from "lucide-react";

interface ClientLite {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function NewRetainerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: template
  const [templateKey, setTemplateKey] = useState<string | null>(null);

  // Step 2: details
  const [clientId, setClientId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState("GBP");
  const [billingInterval, setBillingInterval] = useState<"weekly" | "monthly" | "quarterly" | "custom">("monthly");
  const [customDays, setCustomDays] = useState<string>("30");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [autoRenew, setAutoRenew] = useState(true);
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState<string>("");
  const [taxMode, setTaxMode] = useState<TaxMode>("none");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, email, company")
        .order("name");
      setClients((data as ClientLite[]) || []);

      // Prefill tax defaults from business_branding.
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (uid) {
        const { data: branding } = await supabase
          .from("business_branding")
          .select("default_tax_rate, default_tax_mode")
          .eq("user_id", uid)
          .maybeSingle();
        if (branding) {
          if (branding.default_tax_rate != null) {
            setTaxRate(String(branding.default_tax_rate));
          }
          const mode = (branding.default_tax_mode as TaxMode) ?? "none";
          setTaxMode(mode === "exclusive" || mode === "inclusive" ? mode : "none");
        }
      }
    })();
  }, []);

  // Pre-fill from a template passed via navigation state (from /dashboard/templates).
  useEffect(() => {
    const t = (location.state as any)?.retainerTemplate;
    if (!t) return;
    setTemplateKey(t.id || "custom");
    setTitle(t.name || "Monthly Retainer");
    setDescription(t.description || "");
    if (t.default_amount_cents) setAmount((t.default_amount_cents / 100).toFixed(0));
    if (t.default_currency) setCurrency(t.default_currency);
    if (t.default_interval) setBillingInterval(t.default_interval);
    if (t.default_custom_days) setCustomDays(String(t.default_custom_days));
    if (t.notes) setNotes(t.notes);
    // Clear nav state so refresh does not re-apply.
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickTemplate = (key: string) => {
    const t = RETAINER_TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    setTemplateKey(key);
    setTitle(t.name);
    setDescription(t.description);
    setAmount((t.defaultAmountCents / 100).toFixed(0));
    setCurrency(t.defaultCurrency);
    setBillingInterval(t.defaultInterval as any);
  };

  const startBlank = () => {
    setTemplateKey("custom");
    setTitle("Monthly Retainer");
    setDescription("");
    setAmount("");
  };

  const onPickClient = (id: string) => {
    setClientId(id);
    if (id === "__new__") {
      setClientName("");
      setClientEmail("");
      setCompanyName("");
      return;
    }
    const c = clients.find((x) => x.id === id);
    if (c) {
      setClientName(c.name);
      setClientEmail(c.email || "");
      setCompanyName(c.company || "");
    }
  };

  const handleSubmit = async (status: "draft" | "active") => {
    const amountNum = parseFloat(amount);
    if (!clientName.trim()) {
      toast({ title: "Client name required", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) {
      toast({ title: "Not signed in", variant: "destructive" });
      setSubmitting(false);
      return;
    }
    const customInterval =
      billingInterval === "custom" ? Math.max(1, parseInt(customDays || "30")) : null;
    const next = computeNextBillingDate(startDate, billingInterval, customInterval);
    const t = RETAINER_TEMPLATES.find((x) => x.key === templateKey);

    const { data, error } = await supabase
      .from("retainers")
      .insert({
        user_id: userId,
        client_id: clientId && clientId !== "__new__" ? clientId : null,
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || null,
        company_name: companyName.trim() || null,
        template_key: templateKey,
        service_type: t?.serviceType || null,
        title: title.trim() || "Monthly Retainer",
        description: description.trim() || null,
        amount_cents: Math.round(amountNum * 100),
        currency,
        billing_interval: billingInterval,
        custom_interval_days: customInterval,
        start_date: startDate,
        end_date: endDate || null,
        auto_renew: autoRenew,
        status,
        next_billing_date: next.toISOString().slice(0, 10),
        notes: notes.trim() || null,
      })
      .select("id")
      .single();
    setSubmitting(false);

    if (error) {
      toast({ title: "Could not create retainer", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: status === "active" ? "Retainer activated" : "Draft saved",
      description: status === "active" ? "Recurring billing is now active." : "You can send it when ready.",
    });
    navigate(`/dashboard/retainers/${data!.id}`);
  };

  const previewMonthly =
    amount && Number(amount) > 0
      ? formatMoney(Math.round(Number(amount) * 100), currency)
      : null;

  // Step 1 view
  if (!templateKey) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl">
          <button
            onClick={() => navigate("/dashboard/retainers")}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Back to retainers
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-accent" /> Choose a retainer template
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Start from a preset or build your own. Everything is editable.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {RETAINER_TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => pickTemplate(t.key)}
                className="text-left"
              >
                <Card className="border-border/60 hover:border-accent/40 transition-colors h-full">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">
                        {t.serviceType}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {intervalLabel(t.defaultInterval)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                    </div>
                    <p className="text-base font-bold text-foreground">
                      {formatMoney(t.defaultAmountCents, t.defaultCurrency)}
                      <span className="text-xs font-normal text-muted-foreground">
                        {" "}/ month
                      </span>
                    </p>
                    <ul className="space-y-1">
                      {t.bullets.slice(0, 3).map((b) => (
                        <li key={b} className="text-[11px] text-muted-foreground flex gap-1.5">
                          <Check className="w-3 h-3 text-accent shrink-0 mt-0.5" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </button>
            ))}
            <button onClick={startBlank} className="text-left">
              <Card className="border-dashed border-border/60 hover:border-accent/40 transition-colors h-full">
                <CardContent className="p-4 flex flex-col items-center justify-center min-h-[180px] gap-2 text-center">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <Repeat className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Custom retainer</p>
                  <p className="text-xs text-muted-foreground">Start from a blank retainer.</p>
                </CardContent>
              </Card>
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Step 2 form
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <button
          onClick={() => setTemplateKey(null)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> Choose a different template
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            New retainer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {previewMonthly && (
              <>
                {previewMonthly} ·{" "}
                {intervalLabel(billingInterval, parseInt(customDays || "30"))}
              </>
            )}
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Client
              </Label>
              <Select value={clientId} onValueChange={onPickClient}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Pick a client or add new" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">+ New client</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.company ? `· ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Client name</Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="mt-1.5"
                  placeholder="Sarah Johnson"
                />
              </div>
              <div>
                <Label>Client email</Label>
                <Input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="mt-1.5"
                  placeholder="sarah@acme.com"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Company</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1.5"
                  placeholder="Acme Co."
                />
              </div>
            </div>

            <div>
              <Label>Retainer title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1.5"
                  placeholder="750"
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.symbol} {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Billing frequency</Label>
                <Select
                  value={billingInterval}
                  onValueChange={(v) => setBillingInterval(v as any)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="custom">Custom (days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {billingInterval === "custom" && (
                <div>
                  <Label>Every X days</Label>
                  <Input
                    type="number"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    className="mt-1.5"
                    min={1}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>End date (optional)</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Auto-renew</p>
                <p className="text-xs text-muted-foreground">
                  Automatically continue billing after the end date.
                </p>
              </div>
              <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
            </div>

            <div>
              <Label>Internal notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1.5"
                rows={2}
                placeholder="Anything you want to remember about this retainer."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 sticky bottom-4">
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => handleSubmit("draft")}
            className="flex-1"
          >
            Save as draft
          </Button>
          <Button
            disabled={submitting}
            onClick={() => handleSubmit("active")}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Activate retainer
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
