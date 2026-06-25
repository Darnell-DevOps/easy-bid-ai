import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Sparkles,
  MessageSquare,
  Bot,
  UserPlus,
  FileText,
  Copy,
  Check,
  Gauge,
  Lightbulb,
  Eye,
  RotateCcw,
  ClipboardList,
  Target,
  Send,
  TrendingUp,
  Users,
  CheckCircle2,
  Wand2,
  ArrowRight,
  Crown,
} from "lucide-react";
import { smartSelectTemplate, type SmartSelectResult } from "@/lib/smart-template";
import type { TemplateData } from "@/pages/Templates";
import { templates } from "@/pages/Templates";
import { usePlan } from "@/hooks/use-plan";
import UpgradeModal from "@/components/plan/UpgradeModal";
import { WhatsAppButton } from "@/components/whatsapp/WhatsAppButton";
import InboundAddressCard from "@/components/leads/InboundAddressCard";
import InboundReviewQueue from "@/components/leads/InboundReviewQueue";

const emptyState = {
  leadName: "",
  leadEmail: "",
  message: "",
  reply: "",
  service: "",
  phone: "",
  budget: "",
  timeline: "",
  goals: "",
  notes: "",
  leadQuality: "" as "High" | "Medium" | "Low" | "",
  qualityReason: "",
  aiRecommendation: "",
};

const EXAMPLE_MESSAGES = [
  {
    label: "Shopify ads enquiry",
    name: "Jane Smith",
    email: "jane@brightstore.com",
    message:
      "Hi, I run a Shopify store doing about £40k/month and we're looking for help scaling our paid ads (Meta + Google). Budget is around £3-5k/month for management. Hoping to start within the next 2 weeks. Can you help?",
  },
  {
    label: "Website redesign",
    name: "Marcus Lee",
    email: "marcus@northwave.co",
    message:
      "We need a full website redesign for our consulting firm. Around 8-10 pages, with a CMS so the team can update content. Budget up to £8k. Need it live before our Q3 launch in ~10 weeks.",
  },
  {
    label: "Vague enquiry",
    name: "Sam",
    email: "",
    message: "hey just wondering how much you charge for marketing stuff. thanks",
  },
];

const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export default function LeadAssistant() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasFeature } = usePlan();
  const aiLeadUnlocked = hasFeature("aiLeadResponse");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [message, setMessage] = useState("");

  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});

  const [generating, setGenerating] = useState(false);
  const [reply, setReply] = useState("");
  const [hasResponse, setHasResponse] = useState(false);

  const [service, setService] = useState("");
  const [phone, setPhone] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [goals, setGoals] = useState("");
  const [notes, setNotes] = useState("");

  const [leadQuality, setLeadQuality] = useState<"High" | "Medium" | "Low" | "">("");
  const [qualityReason, setQualityReason] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedClientId, setSavedClientId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentStep = hasResponse ? (savedClientId ? 3 : 2) : 1;

  const reset = () => {
    setLeadName(emptyState.leadName);
    setLeadEmail(emptyState.leadEmail);
    setMessage(emptyState.message);
    setReply(emptyState.reply);
    setService(emptyState.service);
    setPhone(emptyState.phone);
    setBudget(emptyState.budget);
    setTimeline(emptyState.timeline);
    setGoals(emptyState.goals);
    setNotes(emptyState.notes);
    setLeadQuality(emptyState.leadQuality);
    setQualityReason(emptyState.qualityReason);
    setAiRecommendation(emptyState.aiRecommendation);
    setHasResponse(false);
    setSavedClientId(null);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const fillExample = (ex: typeof EXAMPLE_MESSAGES[number]) => {
    setLeadName(ex.name);
    setLeadEmail(ex.email);
    setMessage(ex.message);
    setErrors({});
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!leadName.trim()) next.name = "Lead name is required";
    if (leadEmail.trim() && !isValidEmail(leadEmail.trim()))
      next.email = "Enter a valid email address";
    if (!message.trim()) next.message = "Paste the lead's message";
    else if (message.trim().length < 20)
      next.message = "Add a bit more context (at least 20 characters)";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleGenerate = async () => {
    if (!validate()) return;
    if (!aiLeadUnlocked) {
      setUpgradeOpen(true);
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("lead-response", {
        body: { leadName, leadEmail, message },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setReply(data.reply || "");
      setService(data.service_requested || "");
      setPhone(data.phone || "");
      setBudget(data.budget || "");
      setTimeline(data.timeline || "");
      setGoals(data.goals || "");
      setNotes(data.notes || "");
      setLeadQuality((data.lead_quality as "High" | "Medium" | "Low") || "");
      setQualityReason(data.quality_reason || "");
      setAiRecommendation(data.ai_recommendation || "");
      setHasResponse(true);
      setSavedClientId(null);
    } catch (e: any) {
      toast({
        title: "Couldn't generate response",
        description: e.message || "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSaveClient = async () => {
    if (!leadName.trim()) {
      toast({ title: "Add a lead name before saving", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const status = leadQuality === "High" ? "Qualified" : "New";

      const { data, error } = await supabase
        .from("clients")
        .insert({
          user_id: user.id,
          name: leadName.trim(),
          email: leadEmail.trim() || null,
          phone: phone.trim() || null,
          service_requested: service || null,
          project_description: notes || message,
          budget: budget || null,
          timeline: timeline || null,
          goals: goals || null,
          status,
          lead_quality: leadQuality || null,
          ai_recommendation: aiRecommendation || null,
          lead_source: "AI Lead Assistant",
          original_lead_message: message,
        })
        .select()
        .single();

      if (error) throw error;
      setSavedClientId(data.id);
      toast({ title: "Saved as client", description: `${leadName} added to your clients.` });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Smart Template Selection ─────────────────────────────────
  const [smartPick, setSmartPick] = useState<SmartSelectResult | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartStep, setSmartStep] = useState(0);
  const smartLoadingSteps = [
    "Analyzing lead…",
    "Identifying project type…",
    "Selecting best template…",
  ];

  // Re-run smart selection whenever the relevant inputs change after extraction
  useEffect(() => {
    if (!hasResponse) {
      setSmartPick(null);
      return;
    }
    setSmartPick(
      smartSelectTemplate({
        message,
        service,
        budget,
        timeline,
        goals,
      }),
    );
  }, [hasResponse, message, service, budget, timeline, goals]);

  // Adjust budget hint text based on detected complexity (used in confirm card)
  const complexityLabel = useMemo(() => {
    if (!smartPick) return "";
    return (
      smartPick.complexity[0].toUpperCase() + smartPick.complexity.slice(1)
    );
  }, [smartPick]);

  // Run staged loading then navigate to the proposal builder with autoGenerate.
  const startProposalFromTemplate = async (chosen: TemplateData) => {
    setSmartLoading(true);
    setSmartStep(0);
    // Stage 1
    await new Promise((r) => setTimeout(r, 700));
    setSmartStep(1);
    await new Promise((r) => setTimeout(r, 700));
    setSmartStep(2);
    await new Promise((r) => setTimeout(r, 600));

    navigate("/dashboard/new", {
      state: {
        template: chosen,
        autoGenerate: true,
        prefillFromClient: {
          client_id: savedClientId || undefined,
          client_name: leadName,
          company_name: "",
          // Lead-derived values take priority over template defaults
          service_type: chosen.serviceType,
          project_scope: notes || message,
          budget: budget || chosen.prefill.budget,
          timeline: timeline || chosen.prefill.timeline,
          notes: "",
          goals: goals || chosen.defaultGoals || "",
          deliverables: chosen.defaultDeliverables || "",
          original_lead_message: message,
          lead_quality: leadQuality,
          ai_recommendation: aiRecommendation,
        },
      },
    });
  };

  const handleViewClient = () => {
    if (savedClientId) navigate(`/dashboard/clients/${savedClientId}`);
  };

  const qualityClass =
    leadQuality === "High"
      ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 border-emerald-500/30"
      : leadQuality === "Medium"
      ? "bg-amber-500/15 text-amber-600 hover:bg-amber-500/15 border-amber-500/30"
      : "bg-rose-500/15 text-rose-600 hover:bg-rose-500/15 border-rose-500/30";

  const steps = [
    { n: 1, label: "Understand the lead", icon: MessageSquare },
    { n: 2, label: "Generate response", icon: Bot },
    { n: 3, label: "Send & convert", icon: Send },
  ];

  return (
    <DashboardLayout>
      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        requiredPlan="pro"
        title="Turn leads into clients automatically"
        description="Unlock AI Lead Response to instantly draft replies, qualify leads, and recommend next steps. Available on the Pro plan."
      />
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Hero */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Sales Assistant
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            Turn cold leads into paying clients — instantly
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl">
            Generate high-converting replies that qualify, position your offer, and move leads
            toward a sale.
          </p>
        </div>

        <InboundAddressCard />

        {/* Step indicator */}
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1">
          {steps.map((s, i) => {
            const active = currentStep === s.n;
            const done = currentStep > s.n;
            const Icon = s.icon;
            return (
              <div key={s.n} className="flex items-center gap-2 sm:gap-4 shrink-0">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${
                      done
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600"
                        : active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="text-xs sm:text-sm">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Step {s.n}
                    </div>
                    <div className={active ? "font-semibold" : "text-muted-foreground"}>
                      {s.label}
                    </div>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="w-6 sm:w-12 h-px bg-border" />
                )}
              </div>
            );
          })}
        </div>

        {/* Section 1: Incoming Lead */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4 text-primary" />
              Tell us about the lead
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Paste their enquiry — we'll qualify them and draft a reply that sells.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Lead name *</Label>
                <Input
                  id="name"
                  placeholder="Jane Smith"
                  value={leadName}
                  onChange={(e) => {
                    setLeadName(e.target.value);
                    if (errors.name) setErrors({ ...errors, name: undefined });
                  }}
                  aria-invalid={!!errors.name}
                  className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Lead email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jane@company.com"
                  value={leadEmail}
                  onChange={(e) => {
                    setLeadEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  aria-invalid={!!errors.email}
                  className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label htmlFor="msg">Their message *</Label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-muted-foreground mr-1">Try an example:</span>
                  {EXAMPLE_MESSAGES.map((ex) => (
                    <Button
                      key={ex.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => fillExample(ex)}
                    >
                      {ex.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Textarea
                id="msg"
                rows={6}
                placeholder="Hi, I run a Shopify store doing £40k/month and we'd like help scaling our paid ads. Budget around £3-5k/month, hoping to start within 2 weeks..."
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (errors.message) setErrors({ ...errors, message: undefined });
                }}
                aria-invalid={!!errors.message}
                className={`resize-none ${
                  errors.message ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
              />
              {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
            </div>

            <div className="space-y-3 pt-1">
              <Button
                onClick={handleGenerate}
                disabled={generating}
                size="lg"
                className={
                  aiLeadUnlocked
                    ? "w-full sm:w-auto"
                    : "w-full sm:w-auto bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold hover:brightness-110"
                }
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : aiLeadUnlocked ? (
                  <><Sparkles className="w-4 h-4" /> Generate Reply That Converts</>
                ) : (
                  <><Crown className="w-4 h-4" /> Unlock AI Reply with Pro</>
                )}
              </Button>

              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  Qualifies the lead automatically
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  Positions your service clearly
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  Moves the conversation toward closing
                </li>
              </ul>

              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>This response can be turned into a full proposal in one click.</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {!hasResponse && (
          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Used by freelancers & agencies to close leads faster
          </p>
        )}

        {hasResponse && (
          <>
            {/* Section 2: AI Response */}
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="w-4 h-4 text-primary" />
                  AI-drafted reply
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/40 border border-border/50 p-1">
                  <Textarea
                    rows={10}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    className="resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 leading-relaxed"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy reply"}
                </Button>
              </CardContent>
            </Card>

            {/* Section 3: Extracted Client Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  Extracted client details
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Prefilled from the lead message — edit anything before saving.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <div className="flex gap-2">
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
                      <WhatsAppButton
                        phone={phone}
                        context="lead"
                        vars={{ clientName: leadName }}
                        variant="outline"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Service requested</Label>
                    <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="e.g. Paid ads management" />
                  </div>
                  <div className="space-y-2">
                    <Label>Budget</Label>
                    <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. £3-5k/month" />
                  </div>
                  <div className="space-y-2">
                    <Label>Timeline</Label>
                    <Input value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="e.g. Start next month" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Goals</Label>
                  <Textarea
                    rows={2}
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    placeholder="What does this lead want to achieve?"
                    className="resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project description / notes</Label>
                  <Textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Summary of the request"
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Qualification */}
            {leadQuality && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Gauge className="w-4 h-4 text-primary" />
                    Qualification
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Target className="w-3 h-3" /> Lead score
                      </div>
                      <Badge className={qualityClass} variant="outline">
                        {leadQuality} Quality Lead
                      </Badge>
                      {qualityReason && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{qualityReason}</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> Recommended action
                      </div>
                      <p className="text-sm font-medium">{aiRecommendation}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Section 4.5: Smart Template Match */}
            {smartPick && (
              <Card className="border-accent/30 bg-gradient-to-br from-accent/5 via-purple/5 to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wand2 className="w-4 h-4 text-accent" />
                    Smart Template Match
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Based on the lead's wording, we picked the best-fit proposal template.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Confidence + reasoning chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        smartPick.confidence === "high"
                          ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                          : smartPick.confidence === "medium"
                          ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      }
                    >
                      {smartPick.confidence === "high"
                        ? "High confidence"
                        : smartPick.confidence === "medium"
                        ? "Suggested match"
                        : "Pick manually"}
                    </Badge>
                    {smartPick.budgetTier !== "unknown" && (
                      <Badge variant="outline" className="text-muted-foreground capitalize">
                        {smartPick.budgetTier} budget
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-muted-foreground">
                      {complexityLabel} project
                    </Badge>
                    {smartPick.urgency === "urgent" && (
                      <Badge
                        variant="outline"
                        className="bg-rose-500/15 text-rose-600 border-rose-500/30"
                      >
                        Urgent
                      </Badge>
                    )}
                  </div>

                  {smartPick.confidence !== "low" ? (
                    <div className="rounded-lg border border-accent/30 bg-background/60 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div
                        className={`w-11 h-11 rounded-lg bg-gradient-to-br ${smartPick.template.accent} flex items-center justify-center flex-shrink-0 shadow-md`}
                      >
                        <smartPick.template.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm">
                          {smartPick.template.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {smartPick.reasoning}
                        </p>
                      </div>
                      <Button
                        onClick={() => startProposalFromTemplate(smartPick.template)}
                        disabled={smartLoading}
                        className="w-full sm:w-auto gap-2"
                      >
                        {smartLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {smartLoadingSteps[smartStep]}
                          </>
                        ) : (
                          <>
                            {smartPick.confidence === "high"
                              ? "Generate proposal"
                              : "Use this template"}
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Couldn't confidently match a template. Pick the best fit below:
                    </p>
                  )}

                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                      {smartPick.confidence === "low" ? "Choose a template" : "Or change template"}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {(smartPick.confidence === "low"
                        ? templates
                        : smartPick.alternatives
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => startProposalFromTemplate(t)}
                          disabled={smartLoading}
                          className="text-left rounded-lg border border-border/60 bg-background/40 p-3 hover:border-accent/50 hover:bg-accent/5 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-3"
                        >
                          <div
                            className={`w-8 h-8 rounded-md bg-gradient-to-br ${t.accent} flex items-center justify-center flex-shrink-0 shadow-sm`}
                          >
                            <t.icon className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {t.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {t.serviceType}
                            </p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    You can edit the generated proposal freely.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Section 5: Actions */}
            <Card className={savedClientId ? "border-emerald-500/30 bg-emerald-500/5" : ""}>
              <CardContent className="p-6 space-y-4">
                {savedClientId ? (
                  <>
                    <div className="flex items-center gap-2 text-emerald-600">
                      <Check className="w-5 h-5" />
                      <p className="font-semibold">Client saved successfully</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {leadName} is now in your client list. What's next?
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button onClick={handleViewClient} variant="outline">
                        <Eye className="w-4 h-4" /> View Client
                      </Button>
                      {smartPick && (
                        <Button
                          onClick={() => startProposalFromTemplate(smartPick.template)}
                          disabled={smartLoading}
                        >
                          {smartLoading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> {smartLoadingSteps[smartStep]}</>
                          ) : (
                            <><Wand2 className="w-4 h-4" /> Generate Proposal</>
                          )}
                        </Button>
                      )}
                      <Button onClick={reset} variant="ghost">
                        <RotateCcw className="w-4 h-4" /> Add Another Lead
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <p className="text-sm font-medium">Save & take action</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button onClick={handleSaveClient} disabled={saving}>
                        {saving ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                        ) : (
                          <><UserPlus className="w-4 h-4" /> Save as Client</>
                        )}
                      </Button>
                      <Button onClick={reset} variant="ghost">
                        <RotateCcw className="w-4 h-4" /> Clear / Reset
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
