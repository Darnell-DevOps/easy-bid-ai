import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Flame,
  Banknote,
  FileSignature,
  Sparkles,
  ClipboardList,
  CalendarClock,
  Send,
  Eye,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Lightbulb,
  Gauge,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getFollowUpScenario, FOLLOW_UP_META, type FollowUpScenario } from "@/lib/follow-up";
import { computeLeadNextAction, type LeadNextActionKind } from "@/lib/lead-next-action";
import FollowUpDialog from "@/components/proposal/FollowUpDialog";
import { deriveStatus, type DeadlineRow } from "@/lib/deadlines";

interface ProposalLite {
  id: string;
  client_id?: string | null;
  client_name: string;
  company_name: string;
  service_type: string;
  budget: string;
  status?: string | null;
  client_paid?: boolean;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  paid_at?: string | null;
  created_at: string;
}

interface ClientLite {
  id: string;
  name: string;
  status: string;
  created_at: string;
  company?: string | null;
  service_requested?: string | null;
  budget?: string | null;
  timeline?: string | null;
  goals?: string | null;
  project_description?: string | null;
  lead_score?: string | null;
  fit_score?: number | null;
  fit_factors?: Array<{ label: string; impact: "positive" | "negative" }> | null;
  missing_info?: string[] | null;
  lead_quality?: string | null;
  lead_reply_sent_at?: string | null;
  lead_thread?: unknown;
  not_a_lead?: boolean | null;
}

interface ContractLite {
  id: string;
  title: string;
  client_name: string;
  status: string;
  created_at: string;
  signed_at: string | null;
  proposal_id: string | null;
  body: string | null;
}

interface OnboardingLite {
  id: string;
  client_name: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  proposal_id: string | null;
}

interface BookingLite {
  id: string;
  guest_name: string | null;
  scheduled_at: string;
  status: string;
}

interface AttentionCenterProps {
  proposals: ProposalLite[];
  clients: ClientLite[];
  /** Set of client_id values that already have a proposal. Replaces the old
   *  name-string match (two same-named clients would collide). */
  proposalClientIds: Set<string>;
}

type Tone = "critical" | "warning" | "info" | "success";

interface Item {
  key: string;
  tone: Tone;
  icon: typeof Bell;
  title: string;
  subtitle: string;
  cta: string;
  onClick: () => void;
  priority: number;
  value?: number;
  waitedFor?: string;
  hint?: string;
}

const TONE: Record<Tone, { card: string; iconWrap: string; icon: string; btn: string; chip: string }> = {
  critical: {
    card: "border-rose-500/25 bg-rose-500/[0.04]",
    iconWrap: "bg-rose-500/15",
    icon: "text-rose-400",
    btn: "bg-rose-500 hover:bg-rose-500/90 text-white",
    chip: "text-rose-400",
  },
  warning: {
    card: "border-amber-500/25 bg-amber-500/[0.04]",
    iconWrap: "bg-amber-500/15",
    icon: "text-amber-400",
    btn: "bg-amber-500 hover:bg-amber-500/90 text-white",
    chip: "text-amber-400",
  },
  info: {
    card: "border-primary/25 bg-primary/[0.04]",
    iconWrap: "bg-primary/15",
    icon: "text-primary",
    btn: "bg-primary hover:bg-primary/90 text-primary-foreground",
    chip: "text-primary",
  },
  success: {
    card: "border-emerald-500/25 bg-emerald-500/[0.04]",
    iconWrap: "bg-emerald-500/15",
    icon: "text-emerald-400",
    btn: "bg-emerald-500 hover:bg-emerald-500/90 text-white",
    chip: "text-emerald-400",
  },
};

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) {
    const abs = -diff;
    const mins = Math.floor(abs / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.floor(abs / 3600000);
    if (hrs < 24) return `in ${hrs}h`;
    const days = Math.floor(abs / 86400000);
    return `in ${days}d`;
  }
  const days = Math.floor(diff / 86400000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.floor(diff / 60000);
  return `${mins}m ago`;
}

function parseAmount(s?: string | null): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number): string {
  if (!n) return "";
  return `£${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function AttentionCenter({ proposals, clients, proposalClientIds }: AttentionCenterProps) {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<ContractLite[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingLite[]>([]);
  const [bookings, setBookings] = useState<BookingLite[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [followUpTarget, setFollowUpTarget] = useState<{
    proposal: ProposalLite;
    scenario: Exclude<FollowUpScenario, "none">;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
      const [c, o, b, d] = await Promise.all([
        supabase
          .from("contracts")
          .select("id, title, client_name, status, created_at, signed_at, proposal_id, body")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("onboarding_forms")
          .select("id, client_name, status, created_at, sent_at, started_at, completed_at, reviewed_at, proposal_id")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("bookings")
          .select("id, guest_name, scheduled_at, status")
          .eq("status", "confirmed")
          .gte("scheduled_at", now.toISOString())
          .lte("scheduled_at", in48h)
          .order("scheduled_at", { ascending: true })
          .limit(10),
        supabase
          .from("deadlines")
          .select("*")
          .is("deleted_at", null)
          .neq("status", "completed")
          .order("due_date", { ascending: true })
          .limit(50),
      ]);
      setContracts(((c.data as any[]) || []) as ContractLite[]);
      setOnboarding(((o.data as any[]) || []) as OnboardingLite[]);
      setBookings(((b.data as any[]) || []) as BookingLite[]);
      setDeadlines(((d.data as any[]) || []) as DeadlineRow[]);
    })();
  }, [proposals.length, clients.length]);

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];

    // Build a proposal_id -> most recent contract lookup. `contracts` is already
    // ordered by created_at desc, so the first match per proposal_id wins.
    const contractByProposal = new Map<string, ContractLite>();
    for (const c of contracts) {
      if (c.proposal_id && !contractByProposal.has(c.proposal_id)) {
        contractByProposal.set(c.proposal_id, c);
      }
    }

    // 1. Accepted-unpaid proposals — the correct next action depends on the
    // linked contract's state. Match strictly via proposal_id (never by name).
    for (const p of proposals) {
      const s = (p.status || "").toLowerCase();
      if (!(s === "accepted" && !p.client_paid)) continue;

      const contract = contractByProposal.get(p.id);
      const amount = parseAmount(p.budget);
      const hasBody = !!(contract?.body && contract.body.trim().length > 0);
      const cStatus = contract?.status;

      if (!contract || (cStatus === "draft" && !hasBody)) {
        // Contract missing or an empty placeholder — needs generation/regen.
        out.push({
          key: `ctrgen-${p.id}`,
          tone: "critical",
          icon: AlertTriangle,
          title: `Contract draft needs attention — ${p.client_name}`,
          subtitle: `${p.company_name || p.service_type} · Accepted ${relTime(p.accepted_at)} · Contract needs ${contract ? "regenerating" : "generating"}`,
          cta: "Review proposal",
          onClick: () => navigate(`/dashboard/proposal/${p.id}`),
          priority: 95,
          waitedFor: p.accepted_at || undefined,
        });
        continue;
      }

      if (cStatus === "draft") {
        // Draft with real body — the natural next action is to review & send.
        out.push({
          key: `ctrreview-${contract.id}`,
          tone: "info",
          icon: FileSignature,
          title: `Review & send contract — ${p.client_name}`,
          subtitle: `${contract.title || p.company_name || p.service_type} · Accepted ${relTime(p.accepted_at)}`,
          cta: "Review contract",
          onClick: () => navigate(`/dashboard/contracts/${contract.id}`),
          priority: 88,
          waitedFor: p.accepted_at || undefined,
        });
        continue;
      }

      if (cStatus === "sent" || cStatus === "viewed" || cStatus === "signed") {
        // Covered by items #2 / #3 — skip to avoid duplicate/contradictory cards.
        continue;
      }

      if (cStatus === "executed") {
        // Contract is fully executed but proposal isn't paid — payment truly pending.
        out.push({
          key: `pay-${p.id}`,
          tone: "critical",
          icon: Banknote,
          title: `Payment pending — ${p.client_name}`,
          subtitle: `${p.company_name || p.service_type} · Accepted ${relTime(p.accepted_at)}${amount ? " · " + formatMoney(amount) : ""}`,
          cta: "Request payment",
          onClick: () => navigate(`/dashboard/proposal/${p.id}`),
          priority: 100 + Math.min(amount / 100, 50),
          value: amount,
          waitedFor: p.accepted_at || undefined,
        });
      }
    }

    // 2. Contracts signed by client — needs countersign to execute
    for (const c of contracts) {
      if (c.status === "signed") {
        out.push({
          key: `sign-${c.id}`,
          tone: "warning",
          icon: FileSignature,
          title: `Countersign contract — ${c.client_name}`,
          subtitle: `${c.title} · Client signed ${relTime(c.signed_at || c.created_at)}`,
          cta: "Countersign",
          onClick: () => navigate(`/dashboard/contracts/${c.id}`),
          priority: 90,
          waitedFor: c.signed_at || c.created_at,
        });
      }
    }

    // 3. Contracts sent awaiting client signature (>3d = warning)
    for (const c of contracts) {
      if (c.status === "sent" || c.status === "viewed") {
        const days = (Date.now() - new Date(c.created_at).getTime()) / 86400000;
        if (days >= 3) {
          out.push({
            key: `ctrwait-${c.id}`,
            tone: "warning",
            icon: FileSignature,
            title: `Contract awaiting signature — ${c.client_name}`,
            subtitle: `${c.title} · Sent ${relTime(c.created_at)}${c.status === "viewed" ? " · viewed by client" : ""}`,
            cta: "Follow up",
            onClick: () => navigate(`/dashboard/contracts/${c.id}`),
            priority: 70 + Math.min(days, 20),
            waitedFor: c.created_at,
          });
        }
      }
    }

    // 4. Proposal follow-ups (viewed/no action, accepted unpaid handled above)
    for (const p of proposals) {
      const scenario = getFollowUpScenario(p);
      if (scenario === "none" || scenario === "accepted_unpaid_24h") continue;
      const meta = FOLLOW_UP_META[scenario];
      const ageIso =
        scenario === "viewed_no_action_48h" ? p.viewed_at : p.sent_at;
      const verb = scenario === "viewed_no_action_48h" ? "viewed" : "sent";
      const amount = parseAmount(p.budget);
      out.push({
        key: `fu-${p.id}`,
        tone: meta.tone === "warning" ? "warning" : "info",
        icon: scenario === "viewed_no_action_48h" ? Eye : Send,
        title: `Follow up with ${p.client_name}`,
        subtitle: `Proposal ${verb} ${relTime(ageIso)}${amount ? " · " + formatMoney(amount) : ""}`,
        cta: "Send follow-up",
        onClick: () => setFollowUpTarget({ proposal: p, scenario }),
        priority: 60,
        value: amount,
        waitedFor: ageIso || undefined,
      });
    }

    // 5. Leads that need attention — single source of truth (lead-next-action.ts).
    // The dashboard and the Lead Insight panel must agree, so both call
    // computeLeadNextAction. We surface only the lead-side actions here
    // (reply/qualify). Proposal-lifecycle kinds (view_invoice, request_payment,
    // finish_send_proposal, open_proposal) are already covered by the dedicated
    // sections above (Payment pending, Follow up, Send draft) — don't duplicate.
    const LEAD_KIND_META: Partial<Record<
      LeadNextActionKind,
      { tone: Tone; icon: typeof Bell; priority: number; ctaFallback: string }
    >> = {
      review_reply: { tone: "critical", icon: MessageSquare, priority: 96, ctaFallback: "Review response" },
      reply_now: { tone: "critical", icon: Flame, priority: 92, ctaFallback: "Reply now" },
      ask_qualifying_questions: { tone: "warning", icon: Lightbulb, priority: 60, ctaFallback: "Ask questions" },
      review_qualification: { tone: "info", icon: Gauge, priority: 45, ctaFallback: "Run qualification" },
    };
    for (const c of clients) {
      if (c.not_a_lead) continue;
      // Skip closed states
      const s = (c.status || "").toLowerCase();
      if (s === "won" || s === "lost") continue;

      const hasAny = proposalClientIds.has(c.id);
      const na = computeLeadNextAction(
        {
          id: c.id,
          name: c.name,
          lead_score: c.lead_score ?? null,
          fit_score: c.fit_score ?? null,
          lead_quality: c.lead_quality ?? null,
          missing_info: c.missing_info ?? null,
          lead_thread: c.lead_thread,
          lead_reply_sent_at: c.lead_reply_sent_at ?? null,
          not_a_lead: c.not_a_lead ?? null,
        },
        // Per-client proposal-lifecycle state isn't readily available here and
        // is already surfaced in dedicated sections (Payment pending / Follow up
        // / Send draft). Passing only hasAny is intentional — the meta lookup
        // below filters out proposal-lifecycle kinds so we don't duplicate them.
        { hasAny, hasAcceptedUnpaid: false, hasPaid: false, hasDraftUnsent: false },
      );

      const meta = LEAD_KIND_META[na.kind];
      // Skip proposal-lifecycle kinds and passive "awaiting_response".
      if (!meta) continue;

      out.push({
        key: `lead-${na.kind}-${c.id}`,
        tone: meta.tone,
        icon: meta.icon,
        title: `${na.title} — ${c.name}`,
        subtitle: `${c.company || c.service_requested || "New enquiry"} · ${relTime(c.created_at)}`,
        cta: na.label || meta.ctaFallback,
        onClick: () => navigate(`/dashboard/clients/${c.id}`),
        priority: meta.priority,
        waitedFor: c.created_at,
        hint: na.hint,
      });
    }


    // 6. Upcoming bookings within 48h
    for (const b of bookings) {
      out.push({
        key: `bk-${b.id}`,
        tone: "info",
        icon: CalendarClock,
        title: `Upcoming call — ${b.guest_name || "Client"}`,
        subtitle: `Scheduled ${relTime(b.scheduled_at)}`,
        cta: "View",
        onClick: () => navigate(`/dashboard/calendar`),
        priority: 50,
      });
    }

    // 7. Onboarding forms pending > 2 days
    for (const f of onboarding) {
      if (f.status === "pending" || f.status === "in_progress") {
        const days = (Date.now() - new Date(f.created_at).getTime()) / 86400000;
        if (days >= 2) {
          out.push({
            key: `ob-${f.id}`,
            tone: "info",
            icon: ClipboardList,
            title: `Onboarding stalled — ${f.client_name || "Client"}`,
            subtitle: `${f.status === "pending" ? "Not started" : "In progress"} · Sent ${relTime(f.created_at)}`,
            cta: "Nudge client",
            onClick: () => navigate(`/dashboard/onboarding`),
            priority: 45,
            waitedFor: f.created_at,
          });
        }
      }
    }

    // 8. Draft proposals sitting unsent > 1 day
    for (const p of proposals) {
      const s = (p.status || "").toLowerCase();
      if ((s === "" || s === "draft") && !p.sent_at) {
        const days = (Date.now() - new Date(p.created_at).getTime()) / 86400000;
        if (days >= 1) {
          out.push({
            key: `draft-${p.id}`,
            tone: "info",
            icon: Send,
            title: `Send draft — ${p.client_name}`,
            subtitle: `${p.service_type} · Drafted ${relTime(p.created_at)}`,
            cta: "Review & send",
            onClick: () => navigate(`/dashboard/proposal/${p.id}`),
            priority: 35,
            waitedFor: p.created_at,
          });
        }
      }
    }

    // 9. Deadlines — overdue (critical) and due within 7d (warning)
    for (const d of deadlines) {
      const status = deriveStatus(d);
      if (status === "overdue") {
        const daysLate = Math.floor((Date.now() - new Date(d.due_date + "T00:00:00").getTime()) / 86400000);
        out.push({
          key: `dl-${d.id}`,
          tone: "critical",
          icon: AlertTriangle,
          title: `Overdue: ${d.title}`,
          subtitle: `${daysLate} day${daysLate === 1 ? "" : "s"} past due${d.client_name ? " · " + d.client_name : ""}`,
          cta: "Open",
          onClick: () => navigate("/dashboard/calendar"),
          priority: 98 + Math.min(daysLate, 20),
        });
      } else if (status === "due_soon") {
        out.push({
          key: `dl-${d.id}`,
          tone: "warning",
          icon: CalendarClock,
          title: `Due soon: ${d.title}`,
          subtitle: `${new Date(d.due_date + "T00:00:00").toLocaleDateString()}${d.client_name ? " · " + d.client_name : ""}`,
          cta: "Open",
          onClick: () => navigate("/dashboard/calendar"),
          priority: 65,
        });
      }
    }

    out.sort((a, b) => b.priority - a.priority);
    return out;
  }, [proposals, clients, proposalClientIds, contracts, onboarding, bookings, deadlines, navigate]);

  const followUpProposal = followUpTarget?.proposal;
  const clientUrl = followUpProposal
    ? `${window.location.origin}/proposal/view/${followUpProposal.id}`
    : "";

  if (items.length === 0) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">You're all caught up</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Nothing needs your attention right now. Keep momentum with a new lead or proposal.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 hidden sm:inline-flex"
            onClick={() => navigate("/dashboard/new")}
          >
            <Sparkles className="w-3.5 h-3.5" /> New proposal
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-labelledby="attention-heading" className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 id="attention-heading" className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            Needs your attention
            <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The highest-leverage moves you can make right now.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {(expanded ? items : items.slice(0, 4)).map((item) => {
          const Icon = item.icon;
          const styles = TONE[item.tone];
          return (
            <Card key={item.key} className={`transition-colors ${styles.card}`}>
              <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.iconWrap}`}>
                    <Icon className={`w-4 h-4 ${styles.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground line-clamp-2 sm:truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-1">{item.subtitle}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={item.onClick}
                  className={`gap-1.5 flex-shrink-0 w-full sm:w-auto ${styles.btn}`}
                >
                  {item.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {items.length > 4 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show less" : `Show ${items.length - 4} more`}
          </Button>
        )}
      </div>

      {followUpTarget && followUpProposal && (
        <FollowUpDialog
          open={!!followUpTarget}
          onOpenChange={(open) => !open && setFollowUpTarget(null)}
          scenario={followUpTarget.scenario}
          templateInput={{
            clientName: followUpProposal.client_name,
            companyName: followUpProposal.company_name,
            serviceType: followUpProposal.service_type,
            proposalUrl: clientUrl,
          }}
        />
      )}
    </section>
  );
}
