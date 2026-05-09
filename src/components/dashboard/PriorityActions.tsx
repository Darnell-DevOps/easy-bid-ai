import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Sparkles, Banknote, UserPlus, ArrowRight, CheckCircle2 } from "lucide-react";
import { getFollowUpScenario, FOLLOW_UP_META, type FollowUpScenario } from "@/lib/follow-up";
import FollowUpDialog from "@/components/proposal/FollowUpDialog";

interface ProposalLite {
  id: string;
  client_name: string;
  company_name: string;
  service_type: string;
  status?: string | null;
  client_paid?: boolean;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  paid_at?: string | null;
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
}

interface PriorityActionsProps {
  proposals: ProposalLite[];
  clients: ClientLite[];
  proposalClientNames: Set<string>;
}

type ActionTone = "warning" | "info" | "success";

interface PriorityItem {
  key: string;
  tone: ActionTone;
  icon: typeof Bell;
  title: string;
  subtitle: string;
  buttonLabel: string;
  onClick: () => void;
}

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return "just now";
}

const TONE_STYLES: Record<ActionTone, { card: string; iconWrap: string; icon: string; button: string }> = {
  warning: {
    card: "border-amber-500/30 bg-amber-500/5",
    iconWrap: "bg-amber-500/15",
    icon: "text-amber-500",
    button: "bg-amber-500 text-white hover:bg-amber-500/90",
  },
  info: {
    card: "border-blue-500/30 bg-blue-500/5",
    iconWrap: "bg-blue-500/15",
    icon: "text-blue-500",
    button: "bg-blue-500 text-white hover:bg-blue-500/90",
  },
  success: {
    card: "border-emerald-500/30 bg-emerald-500/5",
    iconWrap: "bg-emerald-500/15",
    icon: "text-emerald-500",
    button: "bg-emerald-500 text-white hover:bg-emerald-500/90",
  },
};

export default function PriorityActions({ proposals, clients, proposalClientNames }: PriorityActionsProps) {
  const navigate = useNavigate();
  const [followUpTarget, setFollowUpTarget] = useState<{
    proposal: ProposalLite;
    scenario: Exclude<FollowUpScenario, "none">;
  } | null>(null);

  const items: PriorityItem[] = useMemo(() => {
    const out: PriorityItem[] = [];

    for (const p of proposals) {
      const scenario = getFollowUpScenario(p);
      if (scenario === "none") continue;
      const meta = FOLLOW_UP_META[scenario];
      const isPayment = scenario === "accepted_unpaid_24h";
      const ageIso =
        scenario === "accepted_unpaid_24h"
          ? p.accepted_at
          : scenario === "viewed_no_action_48h"
            ? p.viewed_at
            : p.sent_at;
      const verb =
        scenario === "accepted_unpaid_24h"
          ? "accepted"
          : scenario === "viewed_no_action_48h"
            ? "viewed"
            : "sent";
      out.push({
        key: `proposal-${p.id}`,
        tone: meta.tone,
        icon: isPayment ? Banknote : Sparkles,
        title: isPayment
          ? `Payment pending — ${p.client_name} accepted proposal`
          : `Follow up with ${p.client_name} — proposal ${verb} ${relTime(ageIso)}`,
        subtitle: meta.description,
        buttonLabel: isPayment ? "Request Payment" : "Send Follow-Up",
        onClick: () => {
          if (isPayment) {
            navigate(`/dashboard/proposal/${p.id}`);
          } else {
            setFollowUpTarget({ proposal: p, scenario });
          }
        },
      });
    }

    for (const c of clients) {
      if ((c.status || "").toLowerCase() !== "new") continue;
      const nameKey = c.name.toLowerCase().trim();
      if (proposalClientNames.has(nameKey)) continue;
      out.push({
        key: `client-${c.id}`,
        tone: "info",
        icon: UserPlus,
        title: `Send proposal to new lead — ${c.name}`,
        subtitle: `Added ${relTime(c.created_at)}. Strike while interest is fresh.`,
        buttonLabel: "Create Proposal",
        onClick: () =>
          navigate("/dashboard/new", {
            state: {
              prefillFromClient: {
                client_id: c.id,
                client_name: c.name,
                company_name: c.company || "",
                service_type: c.service_requested || "",
                project_scope: c.project_description || "",
                budget: c.budget || "",
                timeline: c.timeline || "",
                goals: c.goals || "",
                notes: "",
              },
            },
          }),
      });
    }

    return out.slice(0, 5);
  }, [proposals, clients, proposalClientNames, navigate]);

  if (items.length === 0) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">You're all caught up</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              No urgent actions right now. Add a new lead or create a proposal to keep the pipeline moving.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1.5 hidden sm:inline-flex">
            <Link to="/dashboard/new"><Sparkles className="w-3.5 h-3.5" /> New Proposal</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const followUpProposal = followUpTarget?.proposal;
  const clientUrl = followUpProposal
    ? `${window.location.origin}/proposal/view/${followUpProposal.id}`
    : "";

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            Priority Actions
            <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            What you should do next to close more deals.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const styles = TONE_STYLES[item.tone];
          return (
            <Card key={item.key} className={styles.card}>
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
                  className={`gap-1.5 flex-shrink-0 w-full sm:w-auto ${styles.button}`}
                >
                  {item.buttonLabel}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
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
    </div>
  );
}
