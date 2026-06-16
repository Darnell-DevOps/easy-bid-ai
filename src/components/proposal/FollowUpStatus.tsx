import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, CheckCircle2, Mail, Sparkles, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  getFollowUpScenario,
  FOLLOW_UP_META,
  type FollowUpScenario,
  type FollowUpInput,
} from "@/lib/follow-up";

interface FollowUpStatusProps {
  proposalId: string;
  proposal: FollowUpInput;
  clientEmail?: string | null;
  clientName?: string | null;
}

interface SentFollowUp {
  id: string;
  scenario: Exclude<FollowUpScenario, "none">;
  sent_at: string;
  recipient_email: string | null;
}

const SCENARIO_LABEL: Record<Exclude<FollowUpScenario, "none">, string> = {
  not_viewed_24h: "Unviewed nudge",
  viewed_no_action_48h: "Viewed reminder",
  accepted_unpaid_24h: "Payment reminder",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function hoursUntilScenario(p: FollowUpInput): { scenario: Exclude<FollowUpScenario, "none">; hours: number } | null {
  const status = (p.status || "").toLowerCase();
  if (p.client_paid || status === "rejected") return null;
  const now = Date.now();
  if (status === "sent" && !p.viewed_at && p.sent_at) {
    const h = 24 - (now - new Date(p.sent_at).getTime()) / 3600000;
    if (h > 0) return { scenario: "not_viewed_24h", hours: h };
  }
  if (status === "viewed" && p.viewed_at) {
    const h = 48 - (now - new Date(p.viewed_at).getTime()) / 3600000;
    if (h > 0) return { scenario: "viewed_no_action_48h", hours: h };
  }
  if (status === "accepted" && p.accepted_at) {
    const h = 24 - (now - new Date(p.accepted_at).getTime()) / 3600000;
    if (h > 0) return { scenario: "accepted_unpaid_24h", hours: h };
  }
  return null;
}

export default function FollowUpStatus({ proposalId, proposal, clientEmail, clientName }: FollowUpStatusProps) {
  const { toast } = useToast();
  const [sent, setSent] = useState<SentFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("proposal_follow_ups")
      .select("id, scenario, sent_at, recipient_email")
      .eq("proposal_id", proposalId)
      .order("sent_at", { ascending: false });
    setSent((data as SentFollowUp[]) || []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadHistory();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId]);

  const currentScenario = getFollowUpScenario(proposal);
  const upcoming = hoursUntilScenario(proposal);
  const sentScenarios = new Set(sent.map((s) => s.scenario));
  const dueNow = currentScenario !== "none" && !sentScenarios.has(currentScenario);
  const status = (proposal.status || "").toLowerCase();
  const terminal = proposal.client_paid || status === "rejected";

  // Scenario we will actually send if user clicks "Send now"
  const sendScenario: Exclude<FollowUpScenario, "none"> =
    currentScenario !== "none"
      ? (currentScenario as Exclude<FollowUpScenario, "none">)
      : upcoming
        ? upcoming.scenario
        : "not_viewed_24h";

  const handleSendNow = async () => {
    if (!clientEmail) {
      toast({
        title: "No client email on file",
        description: "Add an email to this client to send follow-ups.",
        variant: "destructive",
      });
      setConfirmOpen(false);
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("proposal-followup-send", {
        body: { proposalId, scenario: sendScenario },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: "Follow-up sent",
        description: `Sent to ${clientEmail}.`,
      });
      await loadHistory();
      setConfirmOpen(false);
    } catch (e: any) {
      toast({
        title: "Couldn't send follow-up",
        description: e?.message || "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) return null;

  // Hide entirely if proposal is closed and there's no history.
  if (terminal && sent.length === 0) return null;

  return (
    <Card className="border-border/60 bg-card/40">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Follow-up status</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Auto
            </Badge>
            {!terminal && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                disabled={!clientEmail}
                className="gap-1.5 h-8"
                title={clientEmail ? "Send a follow-up to the client now" : "Add a client email to enable"}
              >
                <Send className="w-3.5 h-3.5" />
                Send now
              </Button>
            )}
          </div>
        </div>

        {dueNow && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground font-medium">
                {FOLLOW_UP_META[currentScenario as Exclude<FollowUpScenario, "none">].badge} — due now
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Scheduled to auto-send on the next hourly run — or send it now.
              </p>
            </div>
          </div>
        )}

        {!dueNow && upcoming && (
          <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground font-medium">
                {SCENARIO_LABEL[upcoming.scenario]} in {upcoming.hours < 1 ? "<1h" : `~${Math.round(upcoming.hours)}h`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Will send automatically if the client doesn't act.
              </p>
            </div>
          </div>
        )}

        {!dueNow && !upcoming && sent.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground font-medium">
                {terminal ? "No more follow-ups scheduled" : "All current follow-ups sent"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {terminal
                  ? "Proposal is closed — follow-ups paused."
                  : "We'll queue the next one when the client takes (or doesn't take) action."}
              </p>
            </div>
          </div>
        )}

        {sent.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
              Sent
            </p>
            <ul className="space-y-2">
              {sent.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2.5"
                >
                  <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-foreground font-medium">
                        {SCENARIO_LABEL[s.scenario] || s.scenario}
                      </p>
                      <span className="text-[11px] text-muted-foreground">
                        {timeAgo(s.sent_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {s.recipient_email ? `Sent to ${s.recipient_email}` : "Sent"} · {formatTimestamp(s.sent_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !sending && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send follow-up now?</AlertDialogTitle>
            <AlertDialogDescription>
              We'll email{" "}
              <span className="font-medium text-foreground">
                {clientName || "the client"}
              </span>{" "}
              at{" "}
              <span className="font-medium text-foreground">{clientEmail || "—"}</span>{" "}
              using the{" "}
              <span className="font-medium text-foreground">
                {SCENARIO_LABEL[sendScenario]}
              </span>{" "}
              template. This will appear in the sent history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSendNow();
              }}
              disabled={sending}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send now
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
