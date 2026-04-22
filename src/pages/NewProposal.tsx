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
  // No spaces in long string => likely keyboard mash
  if (t.length > 10 && !/\s/.test(t)) return true;
  // Very low vowel ratio
  const letters = t.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 6) {
    const vowels = (letters.match(/[aeiouAEIOU]/g) || []).length;
    if (vowels / letters.length < 0.18) return true;
  }
  // Long run of same char repeating
  if (/(.)\1{3,}/.test(t)) return true;
  return false;
}

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

  const [form, setForm] = useState({
    client_name: clientPrefill?.client_name || "",
    company_name: clientPrefill?.company_name || "",
    service_type: clientPrefill?.service_type || templateData?.serviceType || "",
    project_scope:
      clientPrefill?.project_scope || templateData?.prefill?.project_scope || "",
    budget: clientPrefill?.budget || templateData?.prefill?.budget || "",
    timeline: clientPrefill?.timeline || templateData?.prefill?.timeline || "",
    notes: clientPrefill?.notes || templateData?.prefill?.notes || "",
    goals: clientPrefill?.goals || "",
    deliverables: clientPrefill?.deliverables || "",
  });
  const prefilledClientId: string | undefined = clientPrefill?.client_id;
  const originalLeadMessage: string | undefined = clientPrefill?.original_lead_message;
  const leadQuality: string | undefined = clientPrefill?.lead_quality;
  const aiRecommendation: string | undefined = clientPrefill?.ai_recommendation;

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const scopeUnclear = useMemo(
    () => looksUnclear(form.project_scope) || looksUnclear(originalLeadMessage),
    [form.project_scope, originalLeadMessage],
  );

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!form.service_type) missing.push("service type");
    if (!form.timeline) missing.push("timeline");
    if (!form.goals) missing.push("goals");
    if (!form.project_scope || form.project_scope.length < 20) missing.push("project scope");
    return missing;
  }, [form]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: aiData, error: aiError } = await supabase.functions.invoke("generate-proposal", {
        body: { ...form, original_lead_message: originalLeadMessage },
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
          client_name: form.client_name,
          company_name: form.company_name,
          service_type: form.service_type,
          project_scope: form.project_scope,
          budget: form.budget,
          timeline: form.timeline,
          notes: form.notes,
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
    setForm({
      client_name: c.name,
      company_name: c.company || "",
      service_type: c.service_requested || "",
      project_scope: c.project_description || "",
      budget: c.budget || "",
      timeline: c.timeline || "",
      notes: "",
      goals: c.goals || "",
      deliverables: "",
    });
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
                  <Label htmlFor="client_name">Client Name</Label>
                  <div className="relative mt-2">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="client_name"
                      value={form.client_name}
                      onChange={(e) => update("client_name", e.target.value)}
                      placeholder="Who is your client?"
                      required
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="company_name">Company Name</Label>
                  <div className="relative mt-2">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="company_name"
                      value={form.company_name}
                      onChange={(e) => update("company_name", e.target.value)}
                      placeholder="Their company or organisation"
                      required
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="service_type">Service Type</Label>
                  <div className="relative mt-2">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                    <Select value={form.service_type} onValueChange={(v) => update("service_type", v)}>
                      <SelectTrigger className="pl-10">
                        <SelectValue placeholder="What service are you offering?" />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceTypes.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="budget">Budget</Label>
                  <div className="relative mt-2">
                    <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="budget"
                      value={form.budget}
                      onChange={(e) => update("budget", e.target.value)}
                      placeholder="e.g. £5,000"
                      required
                      className="pl-10"
                    />
                  </div>
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
                      placeholder="Describe the project and what the client needs"
                      required
                      rows={4}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Describe what the client needs, the problem being solved, and what is being delivered.
                  </p>
                </div>

                <div>
                  <Label htmlFor="timeline">Timeline</Label>
                  <div className="relative mt-2">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="timeline"
                      value={form.timeline}
                      onChange={(e) => update("timeline", e.target.value)}
                      placeholder="e.g. 4 weeks"
                      required
                      className="pl-10"
                    />
                  </div>
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
                      placeholder="What outcome does the client want?"
                      rows={2}
                      className="pl-10"
                    />
                  </div>
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
                      placeholder="e.g. 3 logo concepts, brand guide, social templates"
                      rows={2}
                      className="pl-10"
                    />
                  </div>
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

            {/* READINESS GUIDANCE + CTA */}
            {!loading && (
              <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  {missingFields.length > 0 ? (
                    <>
                      <span className="font-medium text-foreground">Missing:</span>{" "}
                      {missingFields.join(", ")}. Filling these in will improve proposal quality.
                    </>
                  ) : (
                    <span>All key details look good — your proposal is ready to generate.</span>
                  )}
                </p>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-sm font-medium text-foreground animate-pulse">
                  {loadingSteps[loadingStep]}
                </p>
                <Progress value={progress} className="w-full max-w-xs h-2" />
              </div>
            ) : (
              <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => prefilledClientId
                    ? navigate(`/dashboard/clients/${prefilledClientId}`)
                    : navigate(-1)}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {prefilledClientId ? "Back to Client" : "Back"}
                </Button>
                <Button
                  type="submit"
                  disabled={!form.service_type}
                  className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:opacity-90 gap-2 flex-1 sm:flex-initial sm:min-w-[280px] shadow-lg shadow-accent/20 hover:shadow-accent/30"
                  size="lg"
                >
                  <Sparkles className="w-5 h-5" /> Generate Proposal with AI
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
