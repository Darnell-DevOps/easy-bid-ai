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
import { usePlan } from "@/hooks/use-plan";
import { useProposalUsage } from "@/hooks/use-proposal-usage";
import UpgradeModal from "@/components/plan/UpgradeModal";
import ProposalLimitBanner from "@/components/plan/ProposalLimitBanner";
import { PLANS } from "@/lib/plans";
import { calculateCommercialTotals, type TaxMode } from "@/lib/commercial-calc";

// Conservative parser for ai_preferences.business_services free-text.
// Splits on commas / newlines / semicolons, trims, drops empties, dedupes
// case-insensitively. Sanity-check thresholds (drop the whole parse if any
// piece looks more like prose than a list item):
//   - any single item longer than 40 characters
//   - any single item with more than 6 words
//   - only 1 item produced from an input longer than 60 characters
export function parseBusinessServices(raw: string | null | undefined): string[] | null {
  if (!raw || typeof raw !== "string") return null;
  const src = raw.trim();
  if (!src) return null;
  const pieces = src
    .split(/[,\n;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (pieces.length === 0) return null;
  if (pieces.length === 1 && src.length > 60) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of pieces) {
    if (p.length > 40) return null;
    if (p.split(/\s+/).length > 6) return null;
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.length ? out : null;
}

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
  { code: "CAD", symbol: "C$", locale: "en-CA" },
  { code: "AUD", symbol: "A$", locale: "en-AU" },
] as const;
type CurrencyCode = typeof CURRENCIES[number]["code"];
const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as readonly CurrencyCode[];
const getCurrency = (code: CurrencyCode) => CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];

const formatBudget = (digits: string, currency: CurrencyCode = "GBP") => {
  if (!digits) return "";
  const n = parseInt(digits, 10);
  if (isNaN(n)) return "";
  const c = getCurrency(currency);
  return `${c.symbol}${n.toLocaleString(c.locale)}`;
};

// Detect currency from a prefilled string like "$5,000" or "€2000".
// Returns null when nothing detectable is present so the caller can fall back
// to the user's business_branding default instead of guessing GBP.
function detectCurrency(raw: string | undefined | null): CurrencyCode | null {
  if (!raw) return null;
  if (raw.includes("£")) return "GBP";
  if (raw.includes("€")) return "EUR";
  if (/C\$/i.test(raw)) return "CAD";
  if (/A\$/i.test(raw)) return "AUD";
  if (raw.includes("$")) return "USD";
  return null;
}

// Safely analyze a prefilled budget string so we never silently coerce ranges /
// recurring / ambiguous strings into a bogus numeric amount.
type BudgetAnalysis =
  | { kind: "empty"; currency: CurrencyCode }
  | { kind: "exact"; exactValue: number; currency: CurrencyCode }
  | { kind: "range"; currency: CurrencyCode }
  | { kind: "recurring"; currency: CurrencyCode }
  | { kind: "ambiguous"; currency: CurrencyCode };

export function analyzeBudgetString(raw: string): BudgetAnalysis {
  const currency = detectCurrency(raw) || "GBP";
  const s = (raw || "").trim();
  if (!s) return { kind: "empty", currency };
  const lower = s.toLowerCase();
  const recurringRe = /(\/\s*(month|mo|pm|pcm|wk|week|yr|year)\b|\bper\s+(month|week|year|annum)\b|\bmonthly\b|\bweekly\b|\byearly\b|\bannual(ly)?\b|\bp\/m\b)/i;
  if (recurringRe.test(lower)) return { kind: "recurring", currency };
  // Range: dash/en-dash/em-dash or "to" between number-like tokens
  const rangeRe = /(\d[\d,]*\s*[kK]?)\s*(?:[-–—]|\bto\b)\s*[£$€]?\s*(\d[\d,]*\s*[kK]?)/;
  if (rangeRe.test(s)) return { kind: "range", currency };
  // Try single-number parse: strip currency symbols/whitespace, allow trailing k
  const cleaned = s.replace(/[£$€,\s]/g, "");
  const m = cleaned.match(/^(\d+(?:\.\d+)?)([kK])?$/);
  if (m) {
    const n = parseFloat(m[1]) * (m[2] ? 1000 : 1);
    if (isFinite(n) && n > 0) return { kind: "exact", exactValue: Math.round(n), currency };
  }
  return { kind: "ambiguous", currency };
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
  const { plan, isFree, isStarter } = usePlan();
  const { countThisMonth, refresh: refreshUsage } = useProposalUsage();
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const stepTimers = useRef<NodeJS.Timeout[]>([]);

  const loadingSteps = [
    "Building your proposal…",
    "Generating high-converting sections…",
    "Polishing pricing & deliverables…",
    "Finalising your client-ready draft…",
  ];

  useEffect(() => {
    if (loading) {
      setLoadingStep(0);
      setProgress(8);
      stepTimers.current = [];

      const t1 = setTimeout(() => { setLoadingStep(1); setProgress(35); }, 2200);
      const t2 = setTimeout(() => { setLoadingStep(2); setProgress(60); }, 5000);
      const t3 = setTimeout(() => { setLoadingStep(3); setProgress(82); }, 8000);
      stepTimers.current = [t1, t2, t3];
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
  const autoGenerateRequested = (location.state as any)?.autoGenerate === true;

  // Initial budget normalisation: parse digits from prefill so we store digits and display formatted
  const initialBudgetRaw = clientPrefill?.budget || templateData?.prefill?.budget || "";
  const initialBudgetAnalysis = analyzeBudgetString(initialBudgetRaw);
  const initialBudgetDigits =
    initialBudgetAnalysis.kind === "exact" ? String(initialBudgetAnalysis.exactValue) : "";
  const detectedPrefillCurrency = detectCurrency(initialBudgetRaw);
  const initialCurrency: CurrencyCode = detectedPrefillCurrency || "GBP";
  const initialBudgetNotice =
    initialBudgetRaw && initialBudgetAnalysis.kind !== "exact" && initialBudgetAnalysis.kind !== "empty"
      ? initialBudgetRaw
      : "";
  const initialTimelineRaw = clientPrefill?.timeline || templateData?.prefill?.timeline || "";
  const initialTimeline = parseTimeline(initialTimelineRaw);

  // Smart fallback for auto-generation client name only. Company is genuinely
  // optional — do not invent a "Your Company" placeholder.
  const fallbackClientName = autoGenerateRequested ? "Prospective Client" : "";

  const [form, setForm] = useState({
    client_name: clientPrefill?.client_name || fallbackClientName,
    company_name: clientPrefill?.company_name || "",
    service_type: clientPrefill?.service_type || templateData?.serviceType || "",
    project_scope:
      clientPrefill?.project_scope || templateData?.prefill?.project_scope || "",
    budget: initialBudgetDigits, // stored as plain digits, displayed formatted
    timeline: initialTimelineRaw,
    notes: clientPrefill?.notes || templateData?.prefill?.notes || "",
    goals: clientPrefill?.goals || templateData?.defaultGoals || "",
    deliverables: clientPrefill?.deliverables || templateData?.defaultDeliverables || "",
  });

  // Currency state
  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency);
  const budgetInputRef = useRef<HTMLInputElement>(null);
  // If a prefilled budget was not a clean exact number (range / recurring /
  // ambiguous), surface the raw string as a callout instead of silently
  // guessing a value.
  const [budgetPrefillNotice, setBudgetPrefillNotice] = useState<string>(initialBudgetNotice);

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
  const prefilledClientEmail: string | undefined = clientPrefill?.email;
  const leadThread: Array<{ subject?: string; body?: string; received_at?: string }> =
    Array.isArray(clientPrefill?.lead_thread) ? clientPrefill.lead_thread : [];

  // Summarize the 3 most recent thread entries' bodies (500 chars each) — capped, not raw.
  const recentThreadSummary: string = useMemo(() => {
    if (!leadThread.length) return "";
    const sorted = [...leadThread].sort((a, b) => {
      const ta = a?.received_at ? new Date(a.received_at).getTime() : 0;
      const tb = b?.received_at ? new Date(b.received_at).getTime() : 0;
      return tb - ta;
    });
    return sorted
      .slice(0, 3)
      .map((e) => (e?.body || "").toString().trim().slice(0, 500))
      .filter(Boolean)
      .join("\n---\n");
  }, [leadThread]);

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
    // Company is optional — only validate format when the user has actually typed something.
    if (company && !COMPANY_REGEX.test(company)) e.company_name = "Enter a valid company name";

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

    // Plan limit gate — hard block when over limit, show upgrade modal
    if (plan.features.proposalsPerMonth !== "unlimited") {
      const limit = plan.features.proposalsPerMonth as number;
      if (countThisMonth >= limit) {
        setUpgradeOpen(true);
        return;
      }
    }

    setLoading(true);

    const payload = { ...form, budget: formatBudget(form.budget, currency) };
    const budgetDigits = form.budget;
    const amountCents = budgetDigits ? parseInt(budgetDigits, 10) * 100 : null;
    const taxMode: TaxMode = branding?.default_tax_mode ?? null;
    const totals =
      amountCents != null
        ? calculateCommercialTotals(amountCents, branding?.default_tax_rate ?? null, taxMode)
        : null;

    try {
      const { data: aiData, error: aiError } = await supabase.functions.invoke("generate-proposal", {
        body: {
          ...payload,
          currency,
          amount_cents: amountCents,
          tax_rate: branding?.default_tax_rate ?? null,
          tax_mode: taxMode,
          subtotal_cents: totals?.subtotalCents ?? null,
          tax_amount_cents: totals?.taxAmountCents ?? null,
          total_cents: totals?.totalCents ?? null,
          payment_terms: branding?.default_payment_terms ?? null,
          invoice_due_days: branding?.default_invoice_due_days ?? null,
          original_lead_message: originalLeadMessage,
          recent_thread: recentThreadSummary || undefined,
        },
      });

      if (aiError) throw aiError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let clientId: string | null = prefilledClientId || null;
      const clientNameNorm = form.client_name.trim();
      const companyNorm = form.company_name.trim();
      const emailNorm = (prefilledClientEmail || "").trim().toLowerCase();
      if (!clientId && clientNameNorm) {
        // Prefer email match when we have one; otherwise require name AND company to both match
        // to avoid collisions between different people who happen to share a name.
        let existing: { id: string } | null = null;
        if (emailNorm) {
          const { data } = await supabase
            .from("clients")
            .select("id")
            .eq("user_id", user.id)
            .ilike("email", emailNorm)
            .maybeSingle();
          existing = data ?? null;
        }
        if (!existing) {
          let query = supabase
            .from("clients")
            .select("id")
            .eq("user_id", user.id)
            .ilike("name", clientNameNorm);
          query = companyNorm
            ? query.ilike("company", companyNorm)
            : query.is("company", null);
          const { data } = await query.maybeSingle();
          existing = data ?? null;
        }

        if (existing) {
          clientId = existing.id;
        } else {
          const { data: newClient } = await supabase
            .from("clients")
            .insert({ user_id: user.id, name: clientNameNorm, company: companyNorm || null })
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
          amount_cents: amountCents,
          currency,
          goals: payload.goals || null,
          deliverables: payload.deliverables || null,
          tax_rate: branding?.default_tax_rate ?? null,
          payment_terms: branding?.default_payment_terms ?? null,
        })
        .select()
        .single();


      if (saveError || !proposal) throw saveError || new Error("Failed to save proposal");

      toast({ title: "Proposal generated!", description: "Your proposal is ready to review." });
      setProgress(100);
      await refreshUsage();
      await new Promise(r => setTimeout(r, 500));
      navigate(`/dashboard/proposal/${proposal.id}`);
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Auto-trigger generation when arriving from Templates with autoGenerate flag.
  // Runs once on mount; the form is already pre-filled with template intelligence
  // and smart fallbacks so validation passes immediately.
  const autoTriggeredRef = useRef(false);
  useEffect(() => {
    if (!autoGenerateRequested || autoTriggeredRef.current) return;
    if (loading) return;
    if (!isValid) return; // safety net — if data is somehow incomplete, let user finish manually
    autoTriggeredRef.current = true;
    // Synthesize a submit event — handleGenerate only uses preventDefault()
    handleGenerate({ preventDefault: () => {} } as React.FormEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerateRequested, isValid, loading]);

  const [savedClients, setSavedClients] = useState<Array<{ id: string; name: string; company: string | null; service_requested: string | null; project_description: string | null; budget: string | null; timeline: string | null; goals: string | null; }>>([]);

  // Business branding defaults (currency / tax rate / tax mode / payment terms / invoice due days).
  const [branding, setBranding] = useState<{
    default_currency: string | null;
    default_tax_rate: number | null;
    default_tax_mode: TaxMode;
    default_payment_terms: string | null;
    default_invoice_due_days: number | null;
  } | null>(null);

  // User's own catalogue of service types (from their saved proposal_templates).
  // Falls back to the generic serviceTypes list when the user has none saved.
  const [userServiceTypes, setUserServiceTypes] = useState<string[] | null>(null);
  // Highest-priority source: parsed from ai_preferences.business_services.
  const [prefServiceTypes, setPrefServiceTypes] = useState<string[] | null>(null);

  useEffect(() => {
    supabase
      .from("clients")
      .select("id, name, company, service_requested, project_description, budget, timeline, goals")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setSavedClients((data as any) || []));

    supabase
      .from("business_branding")
      .select("default_currency, default_tax_rate, default_tax_mode, default_payment_terms, default_invoice_due_days")
      .maybeSingle()
      .then(({ data }) => {
        setBranding((data as any) || null);
        const def = (data as any)?.default_currency;
        // Only override the currency default when no prefill actually contained one.
        if (!detectedPrefillCurrency && def && (CURRENCY_CODES as readonly string[]).includes(def)) {
          setCurrency(def as CurrencyCode);
        }
      });

    supabase
      .from("proposal_templates")
      .select("service_type")
      .then(({ data }) => {
        const distinct = Array.from(
          new Set(((data as any[]) || []).map((r) => (r?.service_type || "").trim()).filter(Boolean)),
        );
        setUserServiceTypes(distinct.length ? distinct : null);
      });

    supabase
      .from("ai_preferences")
      .select("business_services")
      .maybeSingle()
      .then(({ data }) => {
        const parsed = parseBusinessServices((data as any)?.business_services);
        setPrefServiceTypes(parsed && parsed.length ? parsed : null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Priority: parsed ai_preferences.business_services → distinct proposal_templates.service_type → hardcoded generic list.
  // Always ensure "Other" is present (case-insensitive) without duplicating.
  // Also preserve any prefilled form.service_type not present in the effective list
  // by prepending it, so the dropdown doesn't silently blank a valid prefill.
  const effectiveServiceTypes = useMemo(() => {
    const base: string[] =
      prefServiceTypes && prefServiceTypes.length
        ? prefServiceTypes
        : userServiceTypes && userServiceTypes.length
          ? userServiceTypes
          : serviceTypes;
    const list = [...base];
    if (!list.some((s) => s.toLowerCase() === "other")) list.push("Other");
    const pref = form.service_type?.trim();
    if (pref && !list.some((s) => s.toLowerCase() === pref.toLowerCase())) {
      list.unshift(pref);
    }
    return list;
  }, [prefServiceTypes, userServiceTypes, form.service_type]);



  const handleGenerateFromClient = (clientId: string) => {
    const c = savedClients.find((x) => x.id === clientId);
    if (!c) return;
    const tParsed = parseTimeline(c.timeline || "");
    const budgetAnalysis = analyzeBudgetString(c.budget || "");
    const safeBudgetDigits =
      budgetAnalysis.kind === "exact" ? String(budgetAnalysis.exactValue) : "";
    setForm({
      client_name: c.name,
      company_name: c.company || "",
      service_type: c.service_requested || "",
      project_scope: c.project_description || "",
      budget: safeBudgetDigits,
      timeline: c.timeline || "",
      notes: "",
      goals: c.goals || "",
      deliverables: "",
    });
    setCurrency(budgetAnalysis.currency);
    setBudgetPrefillNotice(
      c.budget && budgetAnalysis.kind !== "exact" && budgetAnalysis.kind !== "empty"
        ? c.budget
        : "",
    );
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
        <Card className="mb-6 border-accent/25 bg-accent/[0.05]">
          <CardContent className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
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

      <div className="mb-4">
        <ProposalLimitBanner />
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        requiredPlan={isFree ? "starter" : "pro"}
        title={`You've hit the ${plan.name} plan limit`}
        description={`Upgrade to ${PLANS[isFree ? "starter" : "pro"].name} to keep generating proposals and close more deals.`}
      />

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
                        {effectiveServiceTypes.map((s) => (
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
                  <Label htmlFor="company_name">
                    Company Name <span className={optionalLabel}>Optional</span>
                  </Label>
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
                      className={`pl-10 pr-10 ${inputStateClass("company_name", form.company_name)}`}
                    />
                    <FieldStatusIcon field="company_name" value={form.company_name} />
                  </div>
                  <FieldError field="company_name" />
                </div>
                <div>
                  <Label htmlFor="budget">Budget</Label>
                  {budgetPrefillNotice && (
                    <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      Lead mentioned: <span className="font-medium">"{budgetPrefillNotice}"</span> — enter the exact proposal value below.
                    </div>
                  )}
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
                        onChange={(e) => {
                          const digits = parseBudgetDigits(e.target.value);
                          update("budget", digits);
                          if (digits && budgetPrefillNotice) setBudgetPrefillNotice("");
                        }}
                        onBlur={() => markTouched("budget")}
                        placeholder={`e.g. ${getCurrency(currency).symbol}5,000`}
                        required
                        className={`rounded-l-none pr-10 ${inputStateClass("budget", form.budget)}`}
                      />
                      <FieldStatusIcon field="budget" value={form.budget} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2.5 mt-3">
                    {BUDGET_PRESETS.map((p) => {
                      const selected = form.budget === String(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => { update("budget", String(p)); markTouched("budget"); setBudgetPrefillNotice(""); }}
                          className={`text-xs px-3 py-1.5 rounded-md border transition-all ${
                            selected
                              ? "border-accent bg-accent/15 text-accent shadow-sm shadow-accent/20 ring-1 ring-accent/30"
                              : "border-border/60 text-muted-foreground hover:border-accent/50 hover:bg-accent/5 hover:text-foreground hover:-translate-y-0.5"
                          }`}
                        >
                          {getCurrency(currency).symbol}{p.toLocaleString(getCurrency(currency).locale)}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => { update("budget", ""); markTouched("budget"); setTimeout(() => budgetInputRef.current?.focus(), 0); }}
                      className="text-xs px-3 py-1.5 rounded-md border border-dashed border-border/60 text-muted-foreground hover:border-accent/50 hover:bg-accent/5 hover:text-foreground hover:-translate-y-0.5 transition-all"
                    >
                      + Custom
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 mt-2">
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
                      placeholder="e.g. Build a 5-page website for a fitness brand to increase online leads"
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
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setExtraTimelineEnabled((v) => !v)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      {extraTimelineEnabled ? "− Remove additional time unit" : "+ Add additional time unit"}
                    </button>
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
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {checks.map((c) => (
                      <li
                        key={c.label}
                        className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                          c.done
                            ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                            : "border-border/50 bg-background/40 text-muted-foreground"
                        }`}
                      >
                        {c.done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                        )}
                        <span className="font-medium">{c.label}</span>
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
              <div className="pt-8 mt-4 border-t border-border/40">
                <p className="text-xs text-muted-foreground text-center sm:text-right mb-3">
                  AI will generate a polished, client-ready proposal instantly.
                </p>
                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={() => prefilledClientId
                      ? navigate(`/dashboard/clients/${prefilledClientId}`)
                      : navigate(-1)}
                    className="gap-2 text-muted-foreground hover:text-foreground transition-colors"
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
                            className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 w-full sm:w-auto sm:min-w-[300px] h-12 text-base font-semibold transition-colors group"
                            size="lg"
                          >
                            <Sparkles className="w-5 h-5 transition-transform group-hover:rotate-12" />
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
