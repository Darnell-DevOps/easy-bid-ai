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
import { Loader2, Sparkles, MessageSquare, Bot, UserPlus, FileText, Copy, Check, Gauge, Lightbulb } from "lucide-react";

export default function LeadAssistant() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [message, setMessage] = useState("");

  const [generating, setGenerating] = useState(false);
  const [reply, setReply] = useState("");
  const [hasResponse, setHasResponse] = useState(false);

  const [service, setService] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [notes, setNotes] = useState("");
  const [leadQuality, setLeadQuality] = useState<"High" | "Medium" | "Low" | "">("");
  const [qualityReason, setQualityReason] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedClientId, setSavedClientId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      setBudget(data.budget || "");
      setTimeline(data.timeline || "");
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

      const { data, error } = await supabase
        .from("clients")
        .insert({
          user_id: user.id,
          name: leadName.trim(),
          email: leadEmail.trim() || null,
          service_requested: service || null,
          project_description: message,
          budget: budget || null,
          timeline: timeline || null,
          goals: notes || null,
          status: "Qualified",
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
          id: savedClientId,
          name: leadName,
          service_requested: service,
          project_description: message,
          budget,
          timeline,
          goals: notes,
        },
      },
    });
  };

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
            Paste an incoming lead, get a polished reply, qualify them, then turn it into a proposal.
          </p>
        </div>

        {/* Step 1: Lead input */}
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
                placeholder="Hi, I run a Shopify store and we're looking for help with paid ads. Can you tell me more about what you offer?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-none"
              />
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="w-full sm:w-auto">
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Generate AI Response
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: AI Response */}
        {hasResponse && (
          <>
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

            {/* Step 3: Qualification */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserPlus className="w-4 h-4 text-primary" />
                  3. Qualification details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything important" />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button onClick={handleSaveClient} disabled={saving || !!savedClientId} variant={savedClientId ? "outline" : "default"}>
                    {saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                    ) : savedClientId ? (
                      <><Check className="w-4 h-4" /> Saved as client</>
                    ) : (
                      <><UserPlus className="w-4 h-4" /> Save as Client</>
                    )}
                  </Button>
                  {savedClientId && (
                    <Button onClick={handleGenerateProposal} variant="default">
                      <FileText className="w-4 h-4" /> Generate Proposal
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
