import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Sparkles, User, Building2, Briefcase, PoundSterling, FileText, Clock,
  StickyNote, Target, ListChecks, Users, AlertTriangle, ArrowLeft, Pencil,
  CheckCircle2, Circle, Wand2, ArrowRight,
} from "lucide-react";

const serviceTypes = [
  "Marketing Strategy",
  "Brand Identity",
  "Web Design & Development",
  "SEO & Content",
  "Social Media Management",
  "Paid Advertising",
  "Consulting",
  "Other",
];

// Detect if a string looks like gibberish / unclear input
function looksUnclear(text: string | undefined | null): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 12) return true;
  if (t.length > 10 && !/\s/.test(t)) return true;
  const letters = t.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 6) {
    const vowels = (letters.match(/[aeiouAEIOU]/g) || []).length;
    if (vowels / letters.length < 0.18) return true;
  }
  if (/(.)\1{3,}/.test(t)) return true;
  return false;
}

// Extract numeric value from a budget string like "£5,000" => "5000"
const parseBudgetDigits = (raw: string) => (raw || "").replace(/[^0-9]/g, "");

const CURRENCIES = [
  { code: "GBP", symbol: "£", locale: "en-GB" },
  { code: "USD", symbol: "$", locale: "en-US" },
  { code: "EUR", symbol: "€", locale: "en-IE" },
] as const;
type CurrencyCode = typeof CURRENCIES[number]["code"];
const getCurrency = (code: CurrencyCode) => CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];

const formatBudget = (digits: string, currency: CurrencyCode = "GBP") => {
  if (!digits) return "";
  const n = parseInt(digits, 10);
  if (isNaN(n)) return "";
  const c = getCurrency(currency);
  return `${c.symbol}${n.toLocaleString(c.locale)}`;
};

// Detect currency from a prefilled string like "$5,000" or "€2000"
function detectCurrency(raw: string | undefined | null): CurrencyCode {
  if (!raw) return "GBP";
  if (raw.includes("$")) return "USD";
  if (raw.includes("€")) return "EUR";
  return "GBP";
}

const TIMELINE_UNITS = ["days", "weeks", "months"] as const;
type TimelineUnit = typeof TIMELINE_UNITS[number];

// Try to parse an existing timeline string like "4 weeks" / "1 month"
function parseTimeline(raw: string): { qty: string; unit: TimelineUnit; custom: boolean } {
  if (!raw) return { qty: "", unit: "weeks", custom: false };
  const m = raw.trim().match(/^(\d+)\s*(day|days|week|weeks|month|months)$/i);
  if (m) {
    const n = m[1];
    const u = m[2].toLowerCase();
    const unit: TimelineUnit = u.startsWith("day") ? "days" : u.startsWith("month") ? "months" : "weeks";
    return { qty: n, unit, custom: false };
  }
  return { qty: "", unit: "weeks", custom: true };
}

const NAME_REGEX = /^[A-Za-zÀ-ÿ' \-.]{2,}$/;
const COMPANY_REGEX = /^(?=.*[A-Za-z0-9])[A-Za-zÀ-ÿ0-9 .,&'\-]+$/;
const BUDGET_PRESETS = [500, 1000, 2000, 5000, 10000];

export default function NewProposal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const stepTimers = useRef<NodeJS.Timeout[]>([]);

  const loadingSteps = [
    "Generating your proposal...",
    "Optimising for conversion...",
    "Finalising...",
  ];

  useEffect(() => {
    if (loading) {
      setLoadingStep(0);
      setProgress(10);
      stepTimers.current = [];

      const t1 = setTimeout(() => { setLoadingStep(1); setProgress(45); }, 3000);
      const t2 = setTimeout(() => { setLoadingStep(2); setProgress(75); }, 6000);
      stepTimers.current = [t1, t2];
    } else {
      stepTimers.current.forEach(clearTimeout);
      stepTimers.current = [];
      setProgress(0);
      setLoadingStep(0);
    }
    return () => stepTimers.current.forEach(clearTimeout);
  }, [loading]);

  const location = useLocation();
  const templateData = (location.state as any)?.template;
  const clientPrefill = (location.state as any)?.prefillFromClient;

  // Initial budget normalisation: parse digits from prefill so we store digits and display formatted
  const initialBudgetRaw = clientPrefill?.budget || templateData?.prefill?.budget || "";
  const initialBudgetDigits = parseBudgetDigits(initialBudgetRaw);
  const initialCurrency: CurrencyCode = detectCurrency(initialBudgetRaw);
  const initialTimelineRaw = clientPrefill?.timeline || templateData?.prefill?.timeline || "";
  const initialTimeline = parseTimeline(initialTimelineRaw);

  const [form, setForm] = useState({
    client_name: clientPrefill?.client_name || "",
    company_name: clientPrefill?.company_name || "",
    service_type: clientPrefill?.service_type || templateData?.serviceType || "",
    project_scope:
      clientPrefill?.project_scope || templateData?.prefill?.project_scope || "",
    budget: initialBudgetDigits, // stored as plain digits, displayed formatted
    timeline: initialTimelineRaw,
    notes: clientPrefill?.notes || templateData?.prefill?.notes || "",
    goals: clientPrefill?.goals || "",
    deliverables: clientPrefill?.deliverables || "",
  });

  // Currency state
  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency);
  const budgetInputRef = useRef<HTMLInputElement>(null);

  // Structured timeline state
  const [timelineQty, setTimelineQty] = useState<string>(initialTimeline.qty);
  const [timelineUnit, setTimelineUnit] = useState<TimelineUnit>(initialTimeline.unit);
  const [timelineCustom, setTimelineCustom] = useState<boolean>(initialTimeline.custom);
  const [timelineCustomText, setTimelineCustomText] = useState<string>(
    initialTimeline.custom ? initialTimelineRaw : "",
  );

  // Optional additional timeline duration ("3 months + 2 weeks")
  const [extraTimelineEnabled, setExtraTimelineEnabled] = useState(false);
  const [extraTimelineQty, setExtraTimelineQty] = useState("");
  const [extraTimelineUnit, setExtraTimelineUnit] = useState<TimelineUnit>("weeks");

  // Track which fields the user has interacted with (for showing errors)
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  // Sync structured timeline → form.timeline
  useEffect(() => {
    const base = timelineCustom
      ? timelineCustomText.trim()
      : timelineQty
        ? `${timelineQty} ${timelineUnit}`
        : "";
    const extra =
      !timelineCustom && extraTimelineEnabled && extraTimelineQty
        ? ` + ${extraTimelineQty} ${extraTimelineUnit}`
        : "";
    const value = base ? `${base}${extra}` : "";
    setForm((prev) => (prev.timeline === value ? prev : { ...prev, timeline: value }));
  }, [timelineQty, timelineUnit, timelineCustom, timelineCustomText, extraTimelineEnabled, extraTimelineQty, extraTimelineUnit]);

  const prefilledClientId: string | undefined = clientPrefill?.client_id;
  const originalLeadMessage: string | undefined = clientPrefill?.original_lead_message;
  const leadQuality: string | undefined = clientPrefill?.lead_quality;
  const aiRecommendation: string | undefined = clientPrefill?.ai_recommendation;

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const scopeUnclear = useMemo(
    () => looksUnclear(form.project_scope) || looksUnclear(originalLeadMessage),
    [form.project_scope, originalLeadMessage],
  );

  // Field-level validation
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    const name = form.client_name.trim();
    if (!name) e.client_name = "Client name is required";
    else if (name.length < 2 || !NAME_REGEX.test(name)) e.client_name = "Enter a valid client name";

    const company = form.company_name.trim();
    if (!company) e.company_name = "Company name is required";
    else if (!COMPANY_REGEX.test(company)) e.company_name = "Enter a valid company name";

    if (!form.service_type) e.service_type = "Select a service type";

    const budgetDigits = form.budget;
    const budgetN = parseInt(budgetDigits, 10);
    if (!budgetDigits) e.budget = "Enter a budget amount";
    else if (isNaN(budgetN) || budgetN <= 0) e.budget = "Enter a valid budget amount";

    if (!form.timeline.trim()) {
      e.timeline = "Set a project timeline";
    } else if (timelineCustom && form.timeline.trim().length < 3) {
      e.timeline = "Enter a valid timeline";
    } else if (!timelineCustom && (!timelineQty || parseInt(timelineQty, 10) <= 0)) {
      e.timeline = "Enter a valid timeline";
    }

    const scope = form.project_scope.trim();
    if (!scope) e.project_scope = "Add a short description so AI can generate a strong proposal";
    else if (scope.length < 20)
      e.project_scope = "Add a little more detail so AI can generate a stronger proposal";

    if (form.goals.trim() && form.goals.trim().length < 10)
      e.goals = "Add a bit more detail (10+ characters)";

    if (form.deliverables.trim() && form.deliverables.trim().length < 10)
      e.deliverables = "Add a bit more detail (10+ characters)";

    return e;
  }, [form, timelineCustom, timelineQty]);

  const isValid = Object.keys(errors).length === 0;

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (errors.service_type) missing.push("service type");
    if (errors.timeline) missing.push("timeline");
    if (!form.goals.trim()) missing.push("goals");
    if (errors.project_scope) missing.push("project scope");
    return missing;
  }, [errors, form.goals]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Final validation gate — mark all touched so errors render
    if (!isValid) {
      setTouched({
        client_name: true, company_name: true, service_type: true,
        budget: true, timeline: true, project_scope: true, goals: true, deliverables: true,
      });
      toast({
        title: "Check the highlighted fields",
        description: "A few details need fixing before we can generate your proposal.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const payload = { ...form, budget: formatBudget(form.budget, currency) };

    try {
      const { data: aiData, error: aiError } = await supabase.functions.invoke("generate-proposal", {
        body: { ...payload, original_lead_message: originalLeadMessage },
      });

      if (aiError) throw aiError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let clientId: string | null = prefilledClientId || null;
      const clientNameNorm = form.client_name.trim().toLowerCase();
      if (!clientId && clientNameNorm) {
        const { data: existing } = await supabase
          .from("clients")
          .select("id")
          .eq("user_id", user.id)
          .ilike("name", clientNameNorm)
          .maybeSingle();

        if (existing) {
          clientId = existing.id;
        } else {
          const { data: newClient } = await supabase
            .from("clients")
            .insert({ user_id: user.id, name: form.client_name.trim(), company: form.company_name.trim() || null })
            .select("id")
            .single();
          clientId = newClient?.id || null;
        }
      }

      const { data: proposal, error: saveError } = await supabase
        .from("proposals")
        .insert({
          user_id: user.id,
          client_name: payload.client_name,
          company_name: payload.company_name,
          service_type: payload.service_type,
          project_scope: payload.project_scope,
          budget: payload.budget,
          timeline: payload.timeline,
          notes: payload.notes,
          proposal_content: aiData.proposal,
          pricing_breakdown: aiData.pricing,
          invoice_content: aiData.invoice,
          client_id: clientId,
        })
        .select()
        .single();

      if (saveError || !proposal) throw saveError || new Error("Failed to save proposal");

      toast({ title: "Proposal generated!", description: "Your proposal is ready to review." });
      setProgress(100);
      await new Promise(r => setTimeout(r, 500));
      navigate(`/dashboard/proposal/${proposal.id}`);
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const [savedClients, setSavedClients] = useState<Array<{ id: string; name: string; company: string | null; service_requested: string | null; project_description: string | null; budget: string | null; timeline: string | null; goals: string | null; }>>([]);

  useEffect(() => {
    supabase
      .from("clients")
      .select("id, name, company, service_requested, project_description, budget, timeline, goals")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setSavedClients((data as any) || []));
  }, []);

  const handleGenerateFromClient = (clientId: string) => {
    const c = savedClients.find((x) => x.id === clientId);
    if (!c) return;
    const tParsed = parseTimeline(c.timeline || "");
    setForm({
      client_name: c.name,
      company_name: c.company || "",
      service_type: c.service_requested || "",
      project_scope: c.project_description || "",
      budget: parseBudgetDigits(c.budget || ""),
      timeline: c.timeline || "",
      notes: "",
      goals: c.goals || "",
      deliverables: "",
    });
    setTimelineQty(tParsed.qty);
    setTimelineUnit(tParsed.unit);
    setTimelineCustom(tParsed.custom);
    setTimelineCustomText(tParsed.custom ? (c.timeline || "") : "");
    toast({ title: "Loaded from client", description: `Prefilled with ${c.name}'s details.` });
  };

  const qualityLower = leadQuality?.toLowerCase();
  const qualityColor =
    qualityLower === "high" ? "text-emerald-500" :
    qualityLower === "medium" ? "text-amber-500" :
    qualityLower === "low" ? "text-destructive" : "text-muted-foreground";

  const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="mb-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );

  const optionalLabel = "text-[10px] uppercase tracking-wider text-muted-foreground/70 font-normal ml-1";

  // Helpers for field state visuals
  const showError = (field: string) => touched[field] && !!errors[field];
  const showSuccess = (field: string, hasContent: boolean) =>
    touched[field] && hasContent && !errors[field];

  const inputStateClass = (field: string, value: string) =>
    showError(field)
      ? "border-destructive/60 focus-visible:ring-destructive/40"
      : showSuccess(field, !!value)
        ? "border-emerald-500/50 focus-visible:ring-emerald-500/30"
        : "";

  const FieldStatusIcon = ({ field, value }: { field: string; value: string }) => {
    if (showError(field))
      return <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-destructive pointer-events-none" />;
    if (showSuccess(field, !!value))
      return <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" />;
    return null;
  };

  const FieldError = ({ field }: { field: string }) =>
    showError(field) ? (
      <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" /> {errors[field]}
      </p>
    ) : null;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5" /> AI-powered proposal builder
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Create a proposal in minutes</h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
          Review the key project details below and let AI draft a polished, client-ready proposal.
        </p>
      </div>

      {/* Client context banner */}
      {prefilledClientId && (
        <Card className="mb-4 border-accent/20 bg-accent/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Client:</span> {form.client_name || "—"}
                  {leadQuality && (
                    <>
                      <span className="mx-1.5 text-muted-foreground">•</span>
                      <span className="text-muted-foreground">Lead quality:</span>{" "}
                      <span className={`font-medium ${qualityColor}`}>{leadQuality}</span>
                    </>
                  )}
                </p>
                {aiRecommendation && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    <span className="font-medium text-foreground/80">Recommendation:</span> {aiRecommendation}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5 self-start sm:self-center flex-shrink-0"
              onClick={() => navigate(`/dashboard/clients/${prefilledClientId}`)}
              type="button"
            >
              <Pencil className="w-3 h-3" /> Edit client details
            </Button>
          </CardContent>
        </Card>
      )}

      {savedClients.length > 0 && !prefilledClientId && (
        <Card className="mb-6 border-accent/30 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent shadow-lg shadow-accent/5">
          <CardContent className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-purple flex items-center justify-center flex-shrink-0 shadow-md shadow-accent/30">
                <Wand2 className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">Generate from existing client</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Instantly pre-fill this proposal using saved client details.
                </p>
              </div>
            </div>
            <Select onValueChange={handleGenerateFromClient}>
              <SelectTrigger className="w-full md:w-[260px] bg-background border-accent/30 hover:border-accent/50 transition-colors">
                <SelectValue placeholder="Select Client" />
              </SelectTrigger>
              <SelectContent>
                {savedClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.company ? ` · ${c.company}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardContent className="p-6 md:p-8">
          <form onSubmit={handleGenerate} className="space-y-10">
            {/* ESSENTIALS */}
            <section>
              <SectionHeader title="Essentials" subtitle="The basics needed to draft your proposal." />
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="service_type">Service Type</Label>
                  <div className="relative mt-2">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                    <Select
                      value={form.service_type}
                      onValueChange={(v) => { update("service_type", v); markTouched("service_type"); }}
                    >
                      <SelectTrigger
                        className={`pl-10 ${inputStateClass("service_type", form.service_type)}`}
                        onBlur={() => markTouched("service_type")}
                      >
                        <SelectValue placeholder="What service are you offering?" />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceTypes.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FieldError field="service_type" />
                </div>
                <div>
                  <Label htmlFor="client_name">Client Name</Label>
                  <div className="relative mt-2">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="client_name"
                      value={form.client_name}
                      onChange={(e) => {
                        // Letters/spaces/hyphens/apostrophes only
                        const cleaned = e.target.value.replace(/[^A-Za-zÀ-ÿ' \-.]/g, "");
                        update("client_name", cleaned);
                      }}
                      onBlur={() => markTouched("client_name")}
                      placeholder="Who is your client?"
                      required
                      className={`pl-10 pr-10 ${inputStateClass("client_name", form.client_name)}`}
                    />
                    <FieldStatusIcon field="client_name" value={form.client_name} />
                  </div>
                  <FieldError field="client_name" />
                </div>
                <div>
                  <Label htmlFor="company_name">Company Name</Label>
                  <div className="relative mt-2">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="company_name"
                      value={form.company_name}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^A-Za-zÀ-ÿ0-9 .,&'\-]/g, "");
                        update("company_name", cleaned);
                      }}
                      onBlur={() => markTouched("company_name")}
                      placeholder="Their company or organisation"
                      required
                      className={`pl-10 pr-10 ${inputStateClass("company_name", form.company_name)}`}
                    />
                    <FieldStatusIcon field="company_name" value={form.company_name} />
                  </div>
                  <FieldError field="company_name" />
                </div>
                <div>
                  <Label htmlFor="budget">Budget</Label>
                  <div className="relative mt-2 flex">
                    {/* Currency selector */}
                    <Select
                      value={currency}
                      onValueChange={(v) => setCurrency(v as CurrencyCode)}
                    >
                      <SelectTrigger
                        className="w-[88px] rounded-r-none border-r-0 focus:ring-0 focus:ring-offset-0"
                        aria-label="Currency"
                      >
                        <SelectValue>
                          <span className="font-medium">{getCurrency(currency).symbol}</span>
                          <span className="ml-1 text-xs text-muted-foreground">{currency}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            <span className="font-medium mr-2">{c.symbol}</span>{c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <Input
                        id="budget"
                        ref={budgetInputRef}
                        type="text"
                        inputMode="numeric"
                        value={form.budget ? formatBudget(form.budget, currency) : ""}
                        onChange={(e) => update("budget", parseBudgetDigits(e.target.value))}
                        onBlur={() => markTouched("budget")}
                        placeholder={`e.g. ${getCurrency(currency).symbol}5,000`}
                        required
                        className={`rounded-l-none pr-10 ${inputStateClass("budget", form.budget)}`}
                      />
                      <FieldStatusIcon field="budget" value={form.budget} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {BUDGET_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => { update("budget", String(p)); markTouched("budget"); }}
                        className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                          form.budget === String(p)
                            ? "border-accent/50 bg-accent/10 text-accent"
                            : "border-border/60 text-muted-foreground hover:border-accent/40 hover:text-foreground"
                        }`}
                      >
                        {getCurrency(currency).symbol}{p.toLocaleString(getCurrency(currency).locale)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { update("budget", ""); markTouched("budget"); setTimeout(() => budgetInputRef.current?.focus(), 0); }}
                      className="text-xs px-3 py-1.5 rounded-md border border-dashed border-border/60 text-muted-foreground hover:border-accent/40 hover:text-foreground transition-colors"
                    >
                      + Custom
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Typical projects: {getCurrency(currency).symbol}1,000–{getCurrency(currency).symbol}10,000
                  </p>
                  <FieldError field="budget" />
                </div>
              </div>
            </section>

            {/* PROJECT DETAILS */}
            <section>
              <SectionHeader title="Project Details" subtitle="The more detail, the sharper the proposal." />

              {scopeUnclear && (
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Project details need attention</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      The original lead message was unclear. Add a clearer project scope before generating a proposal.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <Label htmlFor="project_scope">Project Scope</Label>
                  <div className="relative mt-2">
                    <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Textarea
                      id="project_scope"
                      value={form.project_scope}
                      onChange={(e) => update("project_scope", e.target.value)}
                      onBlur={() => markTouched("project_scope")}
                      placeholder="Describe the project and what the client needs"
                      required
                      rows={4}
                      className={`pl-10 ${inputStateClass("project_scope", form.project_scope)}`}
                    />
                  </div>
                  <FieldError field="project_scope" />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    In 1–2 sentences, describe what the client needs. Don't worry if this isn't perfect — AI will refine it.
                  </p>
                </div>

                <div>
                  <Label htmlFor="timeline">Timeline</Label>
                  {!timelineCustom ? (
                    <div className="flex gap-2 mt-2">
                      <div className="relative flex-1">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="timeline"
                          type="text"
                          inputMode="numeric"
                          value={timelineQty}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                            setTimelineQty(v);
                          }}
                          onBlur={() => markTouched("timeline")}
                          placeholder="e.g. 4"
                          className={`pl-10 ${inputStateClass("timeline", form.timeline)}`}
                        />
                      </div>
                      <Select
                        value={timelineUnit}
                        onValueChange={(v) => { setTimelineUnit(v as TimelineUnit); markTouched("timeline"); }}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMELINE_UNITS.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {/* Optional additional duration */}
                  {!timelineCustom && (
                    <div className="mt-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <Switch
                          checked={extraTimelineEnabled}
                          onCheckedChange={(v) => setExtraTimelineEnabled(!!v)}
                        />
                        <span className="text-xs text-muted-foreground">Add additional time unit</span>
                      </label>
                      {extraTimelineEnabled && (
                        <div className="flex gap-2 mt-2">
                          <div className="relative flex-1">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={extraTimelineQty}
                              onChange={(e) => setExtraTimelineQty(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                              placeholder="e.g. 2"
                              className="pl-10"
                            />
                          </div>
                          <Select
                            value={extraTimelineUnit}
                            onValueChange={(v) => setExtraTimelineUnit(v as TimelineUnit)}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMELINE_UNITS.map((u) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}

                  {timelineCustom && (
                    <div className="flex gap-2 mt-2">
                      <div className="relative flex-1">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="timeline"
                          value={timelineCustomText}
                          onChange={(e) => setTimelineCustomText(e.target.value)}
                          onBlur={() => markTouched("timeline")}
                          placeholder="e.g. 6–8 weeks, by end of Q2"
                          className={`pl-10 ${inputStateClass("timeline", form.timeline)}`}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { setTimelineCustom(false); setTimelineCustomText(""); }}
                        className="text-xs text-muted-foreground"
                      >
                        Use preset
                      </Button>
                    </div>
                  )}
                  <FieldError field="timeline" />
                </div>

                <div>
                  <Label htmlFor="goals">
                    Client Goals / Outcomes
                    <span className={optionalLabel}>Optional</span>
                  </Label>
                  <div className="relative mt-2">
                    <Target className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Textarea
                      id="goals"
                      value={form.goals}
                      onChange={(e) => update("goals", e.target.value)}
                      onBlur={() => markTouched("goals")}
                      placeholder="What outcome does the client want?"
                      rows={2}
                      className={`pl-10 ${inputStateClass("goals", form.goals)}`}
                    />
                  </div>
                  <FieldError field="goals" />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    What result does the client want from this project?
                  </p>
                </div>

                <div>
                  <Label htmlFor="deliverables">
                    Confirmed Deliverables
                    <span className={optionalLabel}>Optional</span>
                  </Label>
                  <div className="relative mt-2">
                    <ListChecks className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Textarea
                      id="deliverables"
                      value={form.deliverables}
                      onChange={(e) => update("deliverables", e.target.value)}
                      onBlur={() => markTouched("deliverables")}
                      placeholder="e.g. 3 logo concepts, brand guide, social templates"
                      rows={2}
                      className={`pl-10 ${inputStateClass("deliverables", form.deliverables)}`}
                    />
                  </div>
                  <FieldError field="deliverables" />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    List the items you expect to include in the proposal.
                  </p>
                </div>
              </div>
            </section>

            {/* EXTRA CONTEXT */}
            <section>
              <SectionHeader title="Extra Context" subtitle="Anything else that helps shape the proposal." />
              <div>
                <Label htmlFor="notes">
                  Extra Notes
                  <span className={optionalLabel}>Optional</span>
                </Label>
                <div className="relative mt-2">
                  <StickyNote className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    placeholder="Any additional context…"
                    rows={2}
                    className="pl-10"
                  />
                </div>
              </div>
            </section>

            {/* READINESS CHECKLIST + CTA */}
            {!loading && (() => {
              const checks = [
                { label: "Service Type", done: !!form.service_type },
                { label: "Project Scope", done: !!form.project_scope && form.project_scope.length >= 20 },
                { label: "Timeline", done: !!form.timeline },
                { label: "Goals", done: !!form.goals },
              ];
              const aiReady = checks[0].done && checks[1].done;
              const allDone = checks.every((c) => c.done);
              return (
                <div className={`rounded-xl border p-4 transition-colors ${
                  allDone ? "border-emerald-500/30 bg-emerald-500/5"
                  : aiReady ? "border-accent/30 bg-accent/5"
                  : "border-border/60 bg-muted/30"
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className={`w-4 h-4 ${aiReady ? "text-accent" : "text-muted-foreground"}`} />
                    <p className="text-sm font-semibold text-foreground">
                      {allDone
                        ? "All key details look great — ready to generate"
                        : aiReady
                        ? "Great — AI now has enough to generate a strong proposal"
                        : "To improve your proposal quality, add the items below"}
                    </p>
                  </div>
                  <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {checks.map((c) => (
                      <li key={c.label} className="flex items-center gap-2 text-xs">
                        {c.done ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                        )}
                        <span className={c.done ? "text-foreground" : "text-muted-foreground"}>
                          {c.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {loading ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-sm font-medium text-foreground animate-pulse">
                  {loadingSteps[loadingStep]}
                </p>
                <Progress value={progress} className="w-full max-w-xs h-2" />
              </div>
            ) : (
              <div className="pt-4 mt-2 border-t border-border/40">
                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={() => prefilledClientId
                      ? navigate(`/dashboard/clients/${prefilledClientId}`)
                      : navigate(-1)}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {prefilledClientId ? "Back to Client" : "Back"}
                  </Button>
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={!isValid ? "cursor-not-allowed" : undefined}>
                          <Button
                            type="submit"
                            disabled={!isValid}
                            className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:opacity-90 gap-2 w-full sm:w-auto sm:min-w-[300px] h-12 text-base font-semibold shadow-xl shadow-accent/25 hover:shadow-accent/40 hover:scale-[1.02] transition-all group"
                            size="lg"
                          >
                            <Sparkles className="w-5 h-5" />
                            Generate Proposal with AI
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!isValid && (
                        <TooltipContent side="top">
                          Complete required fields to generate your proposal
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
