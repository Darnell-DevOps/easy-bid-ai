import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, Sparkles, FileText, CheckCircle2, FileSignature, Banknote, ChevronRight } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { scoreRank } from "@/lib/leadScore";

interface ProposalLite {
  status?: string | null;
  client_paid?: boolean;
}

interface ClientLite {
  status: string;
  lead_score?: string | null;
}

interface Props {
  proposals: ProposalLite[];
  clients: ClientLite[];
  proposalClientNames: Set<string>;
}

const STAGES = [
  { key: "lead", label: "New Lead", icon: UserPlus, tone: "text-muted-foreground", bg: "bg-muted", href: "/dashboard/clients" },
  { key: "qualified", label: "Qualified", icon: Sparkles, tone: "text-blue-400", bg: "bg-blue-500/15", href: "/dashboard/clients" },
  { key: "proposal", label: "Proposal", icon: FileText, tone: "text-purple-400", bg: "bg-purple-500/15", href: "/dashboard/proposals" },
  { key: "accepted", label: "Accepted", icon: CheckCircle2, tone: "text-amber-400", bg: "bg-amber-500/15", href: "/dashboard/proposals" },
  { key: "signed", label: "Signed", icon: FileSignature, tone: "text-cyan-400", bg: "bg-cyan-500/15", href: "/dashboard/contracts" },
  { key: "paid", label: "Paid", icon: Banknote, tone: "text-emerald-400", bg: "bg-emerald-500/15", href: "/dashboard/revenue" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

export default function ConversionPipeline({ proposals, clients, proposalClientNames }: Props) {
  const navigate = useNavigate();
  const [signedCount, setSignedCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("contracts")
        .select("status, client_paid")
        .in("status", ["signed", "executed"]);
      const c = ((data as any[]) || []).filter((r) => !r.client_paid).length;
      setSignedCount(c);
    })();
  }, [proposals.length]);

  const counts = useMemo<Record<StageKey, number>>(() => {
    const newLead = clients.filter(
      (c) =>
        (c.status || "").toLowerCase() === "new" &&
        scoreRank(c.lead_score) < 2 &&
        !proposalClientNames.has(((c as any).name || "").toString().toLowerCase().trim()),
    ).length;
    const qualified = clients.filter(
      (c) =>
        ((c.status || "").toLowerCase() === "qualified" || scoreRank(c.lead_score) >= 2) &&
        !proposalClientNames.has(((c as any).name || "").toString().toLowerCase().trim()),
    ).length;
    const proposal = proposals.filter((p) => {
      const s = (p.status || "").toLowerCase();
      return s === "sent" || s === "viewed";
    }).length;
    const accepted = proposals.filter(
      (p) => (p.status || "").toLowerCase() === "accepted" && !p.client_paid,
    ).length;
    const paid = proposals.filter((p) => p.client_paid).length;
    return {
      lead: newLead,
      qualified,
      proposal,
      accepted,
      signed: signedCount,
      paid,
    };
  }, [proposals, clients, proposalClientNames, signedCount]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <section aria-labelledby="pipeline-heading" className="space-y-3">
      <div>
        <h2 id="pipeline-heading" className="text-lg font-semibold text-foreground">
          Conversion pipeline
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enquiry to paid client — where every deal stands.
        </p>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="Your pipeline will live here"
          description="Add a lead or send a proposal and you'll watch it flow from New → Qualified → Proposal → Accepted → Signed → Paid."
          ctaLabel="Add your first lead"
          ctaHref="/dashboard/clients/new"
          variant="panel"
        />
      ) : (
        <Card>
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-stretch gap-1 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
              {STAGES.map((stage, i) => {
                const Icon = stage.icon;
                const count = counts[stage.key];
                const isEmpty = count === 0;
                return (
                  <div key={stage.key} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-[110px] snap-start">
                    <button
                      onClick={() => navigate(stage.href)}
                      className={`flex flex-col items-center text-center flex-1 rounded-lg py-3 px-2 transition-colors hover:bg-muted/40 ${
                        isEmpty ? "opacity-60" : ""
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${stage.bg}`}>
                        <Icon className={`w-4 h-4 ${stage.tone}`} />
                      </div>
                      <p className="text-2xl font-bold text-foreground leading-none tabular-nums">{count}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5 font-medium">
                        {stage.label}
                      </p>
                    </button>
                    {i < STAGES.length - 1 && (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
