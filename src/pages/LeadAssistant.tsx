import { useState } from "react";
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
} from "lucide-react";

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

export default function LeadAssistant() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [message, setMessage] = useState("");

  const [generating, setGenerating] = useState(false);
  const [reply, setReply] = useState("");
  const [hasResponse, setHasResponse] = useState(false);

  // Extracted client intake fields
  const [service, setService] = useState("");
  const [phone, setPhone] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [goals, setGoals] = useState("");
  const [notes, setNotes] = useState("");

  // Qualification
  const [leadQuality, setLeadQuality] = useState<"High" | "Medium" | "Low" | "">("");
  const [qualityReason, setQualityReason] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedClientId, setSavedClientId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenerate = async () => {
    if (!message.trim()) {
      toast({ title: "Add the lead's message first", variant: "destructive" });
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

  const handleGenerateProposal = () => {
    navigate("/dashboard/new", {
      state: {
        prefillFromClient: {
          client_id: savedClientId,
          client_name: leadName,
          company_name: "",
          service_type: service,
          project_scope: notes || message,
          budget,
          timeline,
          notes: goals ? `Client goals: ${goals}` : "",
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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Assistant
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Response Assistant</h1>
          <p className="text-muted-foreground mt-2">
            Turn an incoming lead into a qualified client and proposal — in one flow.
          </p>
        </div>

        {/* Section 1: Incoming Lead */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4 text-primary" />
              1. Incoming lead
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Lead name</Label>
                <Input
                  id="name"
                  placeholder="Jane Smith"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Lead email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jane@company.com"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="msg">Their message *</Label>
              <Textarea
                id="msg"
                rows={6}
                placeholder="Hi, I run a Shopify store and we're looking for help with paid ads..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-none"
              />
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="w-full sm:w-auto">
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate AI Response</>
              )}
            </Button>
          </CardContent>
        </Card>

        {hasResponse && (
          <>
            {/* Section 2: AI Response */}
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="w-4 h-4 text-primary" />
                  2. AI-drafted reply
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
                  3. Extracted client details
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Prefilled from the lead message — edit anything before saving.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
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
                    4. Qualification
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Lead score</div>
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
                      <Button onClick={handleGenerateProposal}>
                        <FileText className="w-4 h-4" /> Generate Proposal
                      </Button>
                      <Button onClick={reset} variant="ghost">
                        <RotateCcw className="w-4 h-4" /> Add Another Lead
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">5. Save & take action</p>
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
