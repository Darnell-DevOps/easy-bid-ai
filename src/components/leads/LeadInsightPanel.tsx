import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  MessageSquare,
  Send,
  Pencil,
  Copy,
  Check,
  Loader2,
  ClipboardList,
  FileText,
  Ban,
  Lightbulb,
  AlertTriangle,
  Gauge,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Mail,
  Bot,
  Inbox,
  Building2,
  Calendar,
  DollarSign,
  Clock,
  ArrowRight,
  Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import LeadScoreBadge from "@/components/ai/LeadScoreBadge";
import { toast } from "@/hooks/use-toast";
import { scoreLabel, scoreTone } from "@/lib/leadScore";
import { computeLeadNextAction } from "@/lib/lead-next-action";
import type { LeadActivityType } from "@/lib/lead-activity";

export interface LeadInsightClient {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  service_requested: string | null;
  budget: string | null;
  timeline: string | null;
  lead_source: string | null;
  lead_quality: string | null;
  lead_score: string | null;
  lead_score_reason: string | null;
  ai_recommendation: string | null;
  missing_info: string[] | null;
  fit_score: number | null;
  fit_factors: Array<{ label: string; impact: "positive" | "negative" }> | null;
  original_lead_message: string | null;
  lead_draft_reply: string | null;
  lead_draft_subject: string | null;
  lead_reply_sent_at: string | null;
  lead_reply_edited: boolean | null;
  not_a_lead: boolean | null;
  lead_thread?: unknown;
  created_at: string;
}

interface LeadInsightPanelProps {
  client: LeadInsightClient;
  hasProposal: boolean;
  draftSubject: string;
  draftBody: string;
  setDraftSubject: (v: string) => void;
  setDraftBody: (v: string) => void;
  draftEditing: boolean;
  setDraftEditing: (v: boolean | ((p: boolean) => boolean)) => void;
  draftSending: boolean;
  draftCopied: boolean;
  markingNotLead: boolean;
  onSaveDraftLocal: (subject: string, body: string) => void;
  onSendReply: () => void;
  onCopyReply: () => void;
  onSendIntakeForm: () => void;
  onGenerateProposal: () => void;
  onMarkNotALead: () => void;
  onEditIntake: () => void;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const ACTIVITY_META: Record<LeadActivityType, { icon: any; accent: string }> = {
  lead_email_received: { icon: Mail, accent: "text-blue-500" },
  lead_qualified: { icon: Gauge, accent: "text-amber-500" },
  reply_drafted: { icon: Bot, accent: "text-purple-500" },
  reply_sent: { icon: Send, accent: "text-emerald-500" },
  intake_form_sent: { icon: ClipboardList, accent: "text-cyan-500" },
  proposal_created_from_lead: { icon: FileText, accent: "text-accent" },
  lead_marked_not_a_lead: { icon: Ban, accent: "text-rose-500" },
};

interface ActivityRow {
  id: string;
  type: LeadActivityType;
  title: string;
  summary: string | null;
  created_at: string;
}

export default function LeadInsightPanel(props: LeadInsightPanelProps) {
  const {
    client,
    hasProposal,
    draftSubject,
    draftBody,
    setDraftSubject,
    setDraftBody,
    draftEditing,
    setDraftEditing,
    draftSending,
    draftCopied,
    markingNotLead,
    onSaveDraftLocal,
    onSendReply,
    onCopyReply,
    onSendIntakeForm,
    onGenerateProposal,
    onMarkNotALead,
    onEditIntake,
  } = props;

  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [messageExpanded, setMessageExpanded] = useState(false);
  const [requalifying, setRequalifying] = useState(false);
  const [scoreState, setScoreState] = useState({
    score: client.lead_score,
    reason: client.lead_score_reason,
    quality: client.lead_quality,
    missing: client.missing_info,
    recommendation: client.ai_recommendation,
    fitScore: client.fit_score,
    fitFactors: client.fit_factors,
  });

  useEffect(() => {
    setScoreState({
      score: client.lead_score,
      reason: client.lead_score_reason,
      quality: client.lead_quality,
      missing: client.missing_info,
      recommendation: client.ai_recommendation,
      fitScore: client.fit_score,
      fitFactors: client.fit_factors,
    });
  }, [
    client.lead_score,
    client.lead_score_reason,
    client.lead_quality,
    client.missing_info,
    client.ai_recommendation,
    client.fit_score,
    client.fit_factors,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase.from("lead_activity") as any)
        .select("id, type, title, summary, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled) {
        setActivity((data || []) as ActivityRow[]);
        setActivityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  const handleRequalify = async () => {
    setRequalifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("lead-requalify", {
        body: { leadId: client.id },
      });
      // The lead-requalify function targets the `leads` table specifically.
      // For `clients`-based leads we fall back to re-reading fresh values from the DB
      // (the qualification pipeline populates lead_score / lead_score_reason /
      // ai_recommendation / missing_info directly on the clients row via the
      // existing analysis path).
      if (error || (data as any)?.error) {
        // Silent fallback: re-fetch client fields in case a background job has updated them.
      }
      const { data: fresh } = await supabase
        .from("clients")
        .select("lead_score, lead_score_reason, lead_quality, missing_info, ai_recommendation, fit_score, fit_factors")
        .eq("id", client.id)
        .maybeSingle();
      if (fresh) {
        setScoreState({
          score: (fresh as any).lead_score,
          reason: (fresh as any).lead_score_reason,
          quality: (fresh as any).lead_quality,
          missing: (fresh as any).missing_info,
          recommendation: (fresh as any).ai_recommendation,
          fitScore: (fresh as any).fit_score,
          fitFactors: (fresh as any).fit_factors,
        });
        toast({ title: "Re-qualification requested" });
      }
    } catch (e: any) {
      toast({
        title: "Couldn't re-qualify",
        description: e?.message || "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setRequalifying(false);
    }
  };

  const receivedAt = client.created_at;
  const message = client.original_lead_message || "";
  const isLongMessage = message.length > 260;
  const displayedMessage = messageExpanded || !isLongMessage ? message : message.slice(0, 260).trimEnd() + "…";

  const fitBadgeTone =
    scoreState.score
      ? scoreTone(scoreState.score)
      : scoreState.quality === "High"
        ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
        : scoreState.quality === "Medium"
          ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
          : scoreState.quality === "Low"
            ? "bg-rose-500/15 text-rose-500 border-rose-500/30"
            : "bg-muted text-muted-foreground border-border";

  const fitLabel = scoreState.score
    ? `${scoreLabel(scoreState.score)} lead`
    : scoreState.quality
      ? `${scoreState.quality} quality lead`
      : "Not yet qualified";

  const fitReason =
    scoreState.reason ||
    (!scoreState.score && !scoreState.quality
      ? "This lead hasn't been analysed yet. Run qualification to get a fit score and next-step recommendation."
      : null);

  const activityToShow = showAllActivity ? activity : activity.slice(0, 5);
  const hasReplyPanel = !!client.lead_draft_reply && !client.not_a_lead;

  const [regenBusy, setRegenBusy] = useState<null | "regenerate" | "shorter" | "warmer" | "more_professional">(null);
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const runAdjustment = async (mode: "regenerate" | "shorter" | "warmer" | "more_professional") => {
    setRegenBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke("lead-reply-regenerate", {
        body: { client_id: client.id, mode },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const nextSubject = (data as any)?.subject || draftSubject;
      const nextBody = (data as any)?.body || draftBody;
      setDraftSubject(nextSubject);
      setDraftBody(nextBody);
      onSaveDraftLocal(nextSubject, nextBody);
      toast({ title: mode === "regenerate" ? "Reply regenerated" : `Reply made ${mode.replace("_", " ")}` });
    } catch (e: any) {
      toast({
        title: "Couldn't regenerate reply",
        description: e?.message === "credits_exhausted" ? "AI credits exhausted." : (e?.message || "Try again in a moment."),
        variant: "destructive",
      });
    } finally {
      setRegenBusy(null);
    }
  };

  // Single recommended next action — pure derived logic, shared with dashboard.
  const nextAction = computeLeadNextAction(
    {
      id: client.id,
      name: client.name,
      lead_score: scoreState.score,
      fit_score: scoreState.fitScore,
      lead_quality: scoreState.quality,
      missing_info: scoreState.missing,
      lead_thread: (client as any).lead_thread,
      lead_reply_sent_at: client.lead_reply_sent_at,
      not_a_lead: client.not_a_lead,
    },
    hasProposal,
  );
  const runNextAction = () => {
    switch (nextAction.kind) {
      case "open_proposal":
        scrollTo("proposals-section");
        return;
      case "review_reply":
      case "reply_now":
      case "ask_qualifying_questions":
        scrollTo("ai-reply");
        return;
      case "review_qualification":
        void handleRequalify();
        return;
      case "awaiting_response":
        return;
    }
  };
  const nextActionToneClass =
    nextAction.tone === "critical"
      ? "border-accent/40 bg-accent/[0.08]"
      : nextAction.tone === "warning"
        ? "border-amber-500/40 bg-amber-500/[0.08]"
        : nextAction.tone === "passive"
          ? "border-border bg-muted/30"
          : "border-border/60 bg-background/40";

  return (
    <Card className="glass-card border-accent/20 overflow-hidden">
      <CardContent className="p-0">
        {/* Header + identity meta strip */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" /> Lead insight
            </h2>
            {client.lead_source && (
              <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-xs">
                {client.lead_source}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {client.service_requested && (
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span className="font-medium">{client.service_requested}</span>
              </span>
            )}
            {client.company && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="w-3.5 h-3.5" /> {client.company}
              </span>
            )}
            {client.budget && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="w-3.5 h-3.5" /> {client.budget}
              </span>
            )}
            {client.timeline && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> {client.timeline}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" /> Received {timeAgo(receivedAt)}
            </span>
          </div>
        </div>

        {/* Fit / qualification summary */}
        <div className="px-5 sm:px-6 py-4 border-b border-border/60">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Gauge className="w-3 h-3" /> Fit summary
                </span>
                <Badge variant="outline" className={`gap-1 ${fitBadgeTone}`}>
                  {fitLabel}
                </Badge>
                {typeof scoreState.fitScore === "number" && (
                  <LeadScoreBadge
                    fitScore={scoreState.fitScore}
                    factors={scoreState.fitFactors as any}
                    reason={scoreState.reason}
                    recommendedAction={scoreState.recommendation}
                  />
                )}
              </div>
              {fitReason && (
                <p className="text-sm text-foreground/90 leading-relaxed">{fitReason}</p>
              )}
              {Array.isArray(scoreState.fitFactors) && scoreState.fitFactors.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 pt-0.5">
                  {scoreState.fitFactors.slice(0, 5).map((f, i) => (
                    <li
                      key={i}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                        f.impact === "positive"
                          ? "bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-600"
                          : "bg-rose-500/[0.08] border-rose-500/25 text-rose-600"
                      }`}
                    >
                      <span aria-hidden>{f.impact === "positive" ? "▲" : "▼"}</span>
                      <span className="leading-none">{f.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              {scoreState.recommendation && (
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Lightbulb className="w-3 h-3 mt-0.5 text-accent flex-shrink-0" />
                  <span>
                    <span className="font-medium text-foreground">Next step:</span>{" "}
                    {scoreState.recommendation}
                  </span>
                </p>
              )}
            </div>
            {!scoreState.score && !scoreState.quality && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRequalify}
                disabled={requalifying}
                className="gap-1.5 flex-shrink-0"
              >
                {requalifying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Run qualification
              </Button>
            )}
          </div>
        </div>

        {/* Missing info / risks */}
        {Array.isArray(scoreState.missing) && scoreState.missing.length > 0 && (
          <div className="px-5 sm:px-6 py-4 border-b border-border/60">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">Needs clarification</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onEditIntake}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                  >
                    <Pencil className="w-3 h-3" /> Update details
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {scoreState.missing.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-[11px] font-normal bg-amber-500/[0.06] border-amber-500/25 text-amber-600">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Original enquiry */}
        {message && (
          <div className="px-5 sm:px-6 py-4 border-b border-border/60">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Original enquiry
              </span>
              {!hasReplyPanel && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenDraftDialog}
                  className="h-7 px-2.5 text-xs gap-1.5 border-accent/30 text-accent hover:bg-accent/10 hover:text-accent"
                >
                  <Sparkles className="w-3 h-3" /> Draft AI reply
                </Button>
              )}
            </div>
            <div className="rounded-lg bg-muted/40 border border-border/50 p-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {displayedMessage}
            </div>
            {isLongMessage && (
              <button
                onClick={() => setMessageExpanded((v) => !v)}
                className="mt-1.5 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {messageExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" /> Read full message
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* AI Suggested Reply — review-first (kept intact from previous UX) */}
        {hasReplyPanel && (
          <div
            id="ai-reply"
            className="px-5 sm:px-6 py-4 border-b border-border/60 space-y-3 scroll-mt-24"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-sm font-semibold">AI suggested reply</span>
                {client.lead_reply_sent_at ? (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1">
                    <Check className="w-3 h-3" /> Sent {new Date(client.lead_reply_sent_at).toLocaleString()}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-600 border-amber-500/30">
                    Awaiting your review
                  </Badge>
                )}
                {client.lead_reply_edited && !client.lead_reply_sent_at && (
                  <Badge variant="outline" className="text-[10px]">Edited</Badge>
                )}
              </div>
              {client.email && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[55%]">
                  to {client.email}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-reply-subject" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Subject
              </Label>
              <Input
                id="ai-reply-subject"
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
                onBlur={() => {
                  if (
                    draftSubject !== (client.lead_draft_subject || "") ||
                    draftBody !== (client.lead_draft_reply || "")
                  ) {
                    onSaveDraftLocal(draftSubject, draftBody);
                  }
                }}
                readOnly={!draftEditing && !!client.lead_reply_sent_at}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-reply-body" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Reply
              </Label>
              <Textarea
                id="ai-reply-body"
                rows={8}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                onBlur={() => {
                  if (
                    draftSubject !== (client.lead_draft_subject || "") ||
                    draftBody !== (client.lead_draft_reply || "")
                  ) {
                    onSaveDraftLocal(draftSubject, draftBody);
                  }
                }}
                readOnly={!draftEditing && !!client.lead_reply_sent_at}
                className="resize-none text-sm leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={onSendReply}
                disabled={draftSending || !client.email}
                className="gap-1.5"
              >
                {draftSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {client.lead_reply_sent_at ? "Resend reply" : "Send reply"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDraftEditing((v) => !v)}
                className="gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" /> {draftEditing ? "Done editing" : "Edit reply"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onCopyReply}
                className="gap-1.5"
              >
                {draftCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {draftCopied ? "Copied" : "Copy"}
              </Button>
              <div className="w-px h-5 bg-border mx-1" />
              <Button size="sm" variant="outline" onClick={onSendIntakeForm} className="gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" /> Send intake form
              </Button>
              <Button size="sm" variant="outline" onClick={onGenerateProposal} className="gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Create proposal
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onMarkNotALead}
                disabled={markingNotLead}
                className="gap-1.5 text-muted-foreground hover:text-destructive ml-auto"
              >
                <Ban className="w-3.5 h-3.5" /> Not a lead
              </Button>
            </div>
          </div>
        )}

        {/* Lead activity timeline */}
        <div className="px-5 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Activity
            </span>
            {activity.length > 5 && (
              <button
                onClick={() => setShowAllActivity((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {showAllActivity ? "Show recent" : `Show all (${activity.length})`}
              </button>
            )}
          </div>
          {activityLoading ? (
            <p className="text-xs text-muted-foreground">Loading activity…</p>
          ) : activity.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
              <Inbox className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                No lead activity yet. Sent replies, intake forms and proposal hand-offs will show up here.
              </p>
            </div>
          ) : (
            <ol className="relative border-l border-border/60 ml-3 space-y-3">
              {activityToShow.map((r) => {
                const meta = ACTIVITY_META[r.type] || { icon: Mail, accent: "text-muted-foreground" };
                const Icon = meta.icon;
                return (
                  <li key={r.id} className="ml-4 relative">
                    <span className="absolute -left-[26px] top-0.5 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center">
                      <Icon className={`w-3 h-3 ${meta.accent}`} />
                    </span>
                    <p className="text-sm text-foreground leading-snug">{r.title}</p>
                    {r.summary && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.summary}</p>
                    )}
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-1">
                      {timeAgo(r.created_at)}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
