import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

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

  const [form, setForm] = useState({
    client_name: "",
    company_name: "",
    service_type: "",
    project_scope: "",
    budget: "",
    timeline: "",
    notes: "",
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
        })
        .select()
        .single();

      if (saveError || !proposal) throw saveError || new Error("Failed to save proposal");

      toast({ title: "Proposal generated!", description: "Your proposal is ready to review." });
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

      <Card>
        <CardContent className="p-6 md:p-8">
          <form onSubmit={handleGenerate} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="client_name">Client Name</Label>
                <Input
                  id="client_name"
                  value={form.client_name}
                  onChange={(e) => update("client_name", e.target.value)}
                  placeholder="John Smith"
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={form.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                  placeholder="Acme Ltd"
                  required
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="service_type">Service Type</Label>
                <Select value={form.service_type} onValueChange={(v) => update("service_type", v)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="budget">Budget</Label>
                <Input
                  id="budget"
                  value={form.budget}
                  onChange={(e) => update("budget", e.target.value)}
                  placeholder="£5,000"
                  required
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="project_scope">Project Scope</Label>
              <Textarea
                id="project_scope"
                value={form.project_scope}
                onChange={(e) => update("project_scope", e.target.value)}
                placeholder="Describe what the client needs…"
                required
                rows={3}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="timeline">Timeline</Label>
              <Input
                id="timeline"
                value={form.timeline}
                onChange={(e) => update("timeline", e.target.value)}
                placeholder="e.g., 4 weeks"
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="notes">Extra Notes (optional)</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Any additional context…"
                rows={2}
                className="mt-1.5"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !form.service_type}
              className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 w-full md:w-auto"
              size="lg"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate Proposal</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
