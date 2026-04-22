import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Loader2,
  ArrowRight,
  Send,
  Eye,
  CreditCard,
  CheckCircle2,
  Rocket,
} from "lucide-react";

type Step = "welcome" | "client" | "proposal" | "value";

const ONBOARDING_KEY_PREFIX = "ss_onboarding_done_";

export function getOnboardingKey(userId: string) {
  return `${ONBOARDING_KEY_PREFIX}${userId}`;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("welcome");

  // Step 1 — Client
  const [clientName, setClientName] = useState("");
  const [serviceRequested, setServiceRequested] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [savingClient, setSavingClient] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  // Step 2 — Proposal
  const [generating, setGenerating] = useState(false);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [proposalPreview, setProposalPreview] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate("/login");
        return;
      }
      setUserId(user.id);
    });
  }, [navigate]);

  const finish = () => {
    if (userId) localStorage.setItem(getOnboardingKey(userId), "1");
    navigate("/dashboard?onboarded=1");
  };

  const skip = () => {
    if (userId) localStorage.setItem(getOnboardingKey(userId), "1");
    navigate("/dashboard");
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !userId) return;
    setSavingClient(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          user_id: userId,
          name: clientName.trim(),
          service_requested: serviceRequested.trim() || null,
          project_description: shortDescription.trim() || null,
          status: "New",
        })
        .select("id")
        .single();
      if (error) throw error;
      setClientId(data.id);
      setStep("proposal");
    } catch (err: any) {
      toast({
        title: "Could not save client",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingClient(false);
    }
  };

  const handleGenerateProposal = async () => {
    if (!userId) return;
    setGenerating(true);
    try {
      const payload = {
        client_name: clientName,
        company_name: clientName,
        service_type: serviceRequested || "Consulting",
        project_scope: shortDescription || `${serviceRequested} engagement`,
        budget: "",
        timeline: "",
        notes: "",
      };

      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        "generate-proposal",
        { body: payload },
      );
      if (aiError) throw aiError;

      const { data: proposal, error: saveError } = await supabase
        .from("proposals")
        .insert({
          user_id: userId,
          client_id: clientId,
          client_name: clientName,
          company_name: clientName,
          service_type: payload.service_type,
          project_scope: payload.project_scope,
          budget: "",
          timeline: "",
          notes: "",
          proposal_content: aiData?.proposal || "",
          pricing_breakdown: aiData?.pricing || "",
          invoice_content: aiData?.invoice || "",
        })
        .select()
        .single();

      if (saveError || !proposal) throw saveError || new Error("Save failed");

      setProposalId(proposal.id);
      setProposalPreview((aiData?.proposal || "").slice(0, 800));
    } catch (err: any) {
      toast({
        title: "Generation failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b border-border">
        <span className="text-sm font-semibold text-foreground tracking-tight">
          StriveSync
        </span>
        <button
          onClick={skip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl">
          {step !== "welcome" && (
            <StepIndicator
              current={
                step === "client" ? 1 : step === "proposal" ? 2 : 3
              }
            />
          )}

          {step === "welcome" && (
            <Card className="border-border">
              <CardContent className="p-8 md:p-10 text-center space-y-6">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-accent to-purple flex items-center justify-center">
                  <Rocket className="w-7 h-7 text-white" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                    Close more clients and get paid faster
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Let's set you up in under 2 minutes.
                  </p>
                </div>
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => setStep("client")}
                >
                  Get Started <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "client" && (
            <Card className="border-border">
              <CardContent className="p-6 md:p-8">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-foreground">
                    Add your first client
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Just the basics — you can add more details later.
                  </p>
                </div>
                <form onSubmit={handleSaveClient} className="space-y-4">
                  <div>
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Acme Co."
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="service">Service Requested</Label>
                    <Input
                      id="service"
                      value={serviceRequested}
                      onChange={(e) => setServiceRequested(e.target.value)}
                      placeholder="e.g. Brand Identity, Web Design"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="desc">Short Description</Label>
                    <Textarea
                      id="desc"
                      value={shortDescription}
                      onChange={(e) => setShortDescription(e.target.value)}
                      placeholder="A sentence or two about the project."
                      rows={3}
                      className="mt-1.5"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={savingClient || !clientName.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {savingClient ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                      </>
                    ) : (
                      <>
                        Next: Generate Proposal{" "}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {step === "proposal" && (
            <Card className="border-border">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Generate your first proposal
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    AI will draft a proposal for{" "}
                    <span className="text-foreground font-medium">
                      {clientName}
                    </span>{" "}
                    based on what you entered.
                  </p>
                </div>

                {!proposalId && (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleGenerateProposal}
                    disabled={generating}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Generate Proposal with AI
                      </>
                    )}
                  </Button>
                )}

                {proposalId && (
                  <>
                    <div className="rounded-lg border border-border bg-muted/30 p-4 max-h-64 overflow-auto">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Proposal preview
                      </p>
                      <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                        {proposalPreview || "Your proposal is ready."}
                      </pre>
                    </div>
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => setStep("value")}
                    >
                      Continue <ArrowRight className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {step === "value" && (
            <Card className="border-border">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    You're all set
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Here's what you can do next:
                  </p>
                </div>

                <ul className="space-y-3">
                  <ValueItem
                    icon={Send}
                    title="Send this proposal to your client"
                    description="Share a secure link in seconds."
                  />
                  <ValueItem
                    icon={Eye}
                    title="Track when they view it"
                    description="Know the moment they open it."
                  />
                  <ValueItem
                    icon={CreditCard}
                    title="Get paid when they accept"
                    description="Built-in checkout — no chasing invoices."
                  />
                </ul>

                <div className="flex flex-col sm:flex-row gap-2">
                  {proposalId && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        if (userId)
                          localStorage.setItem(getOnboardingKey(userId), "1");
                        navigate(`/dashboard/proposal/${proposalId}`);
                      }}
                    >
                      View Proposal
                    </Button>
                  )}
                  <Button size="lg" className="flex-1" onClick={finish}>
                    Go to Dashboard <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`h-1.5 rounded-full transition-all ${
            n === current
              ? "w-8 bg-accent"
              : n < current
                ? "w-6 bg-accent/60"
                : "w-6 bg-border"
          }`}
        />
      ))}
    </div>
  );
}

function ValueItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <li className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}
