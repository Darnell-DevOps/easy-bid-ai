import { useState, useEffect, useRef } from "react";
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
import { Loader2, Sparkles, User, Building2, Briefcase, PoundSterling, FileText, Clock, StickyNote } from "lucide-react";

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

  const [form, setForm] = useState({
    client_name: "",
    company_name: "",
    service_type: templateData?.serviceType || "",
    project_scope: templateData?.prefill?.project_scope || "",
    budget: templateData?.prefill?.budget || "",
    timeline: templateData?.prefill?.timeline || "",
    notes: templateData?.prefill?.notes || "",
  });

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call edge function to generate proposal content via AI
      const { data: aiData, error: aiError } = await supabase.functions.invoke("generate-proposal", {
        body: form,
      });

      if (aiError) throw aiError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Auto-create or find client
      let clientId: string | null = null;
      const clientNameNorm = form.client_name.trim().toLowerCase();
      if (clientNameNorm) {
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

      // Save proposal to database
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

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">New Proposal</h1>
        <p className="text-sm text-muted-foreground mt-1">Fill in the lead details and let AI generate your proposal</p>
      </div>

      <Card className="glass-card">
        <CardContent className="p-6 md:p-8">
          <form onSubmit={handleGenerate} className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
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
            </div>

            <div className="grid md:grid-cols-2 gap-8">
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

            <div>
              <Label htmlFor="project_scope">Project Scope</Label>
              <div className="relative mt-2">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Textarea
                  id="project_scope"
                  value={form.project_scope}
                  onChange={(e) => update("project_scope", e.target.value)}
                  placeholder="What problem are you solving?"
                  required
                  rows={3}
                  className="pl-10"
                />
              </div>
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
              <Label htmlFor="notes">Extra Notes (optional)</Label>
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

            {loading ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-sm font-medium text-foreground animate-pulse">
                  {loadingSteps[loadingStep]}
                </p>
                <Progress value={progress} className="w-full max-w-xs h-2" />
              </div>
            ) : (
              <Button
                type="submit"
                disabled={!form.service_type}
                className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:opacity-90 gap-2 w-full md:w-auto"
                size="lg"
              >
                <Sparkles className="w-4 h-4" /> Generate Proposal
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
