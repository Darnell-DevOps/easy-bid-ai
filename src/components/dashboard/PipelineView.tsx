import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, Send, Eye, CheckCircle2, Banknote, ArrowRight, GitBranch } from "lucide-react";
import EmptyState from "@/components/EmptyState";

interface ProposalLite {
  status?: string | null;
  client_paid?: boolean;
}

interface ClientLite {
  status: string;
}

interface PipelineViewProps {
  proposals: ProposalLite[];
  clients: ClientLite[];
}

const STAGES = [
  { key: "lead", label: "New Lead", icon: UserPlus, color: "text-muted-foreground", bg: "bg-muted" },
  { key: "sent", label: "Sent", icon: Send, color: "text-blue-500", bg: "bg-blue-500/15" },
  { key: "viewed", label: "Viewed", icon: Eye, color: "text-amber-500", bg: "bg-amber-500/15" },
  { key: "accepted", label: "Accepted", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/15" },
  { key: "paid", label: "Paid", icon: Banknote, color: "text-emerald-500", bg: "bg-emerald-500/15" },
] as const;

export default function PipelineView({ proposals, clients }: PipelineViewProps) {
  const counts: Record<(typeof STAGES)[number]["key"], number> = {
    lead: clients.filter((c) => (c.status || "").toLowerCase() === "new").length,
    sent: proposals.filter((p) => (p.status || "").toLowerCase() === "sent").length,
    viewed: proposals.filter((p) => (p.status || "").toLowerCase() === "viewed").length,
    accepted: proposals.filter((p) => (p.status || "").toLowerCase() === "accepted" && !p.client_paid).length,
    paid: proposals.filter((p) => p.client_paid).length,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pipeline</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Where your deals stand right now.</p>
        </div>
      </div>
      {total === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="Your deals will live here"
          description="As you add leads and send proposals, you'll watch them move from New → Sent → Viewed → Accepted → Paid."
          ctaLabel="Add your first client"
          ctaHref="/dashboard/clients/new"
          variant="panel"
        />
      ) : (
      <Card>
        <CardContent className="p-3 sm:p-5">
          {/* Mobile: horizontal scroll-snap row of stage chips */}
          <div className="flex sm:hidden gap-2 overflow-x-auto snap-x snap-mandatory -mx-1 px-1 pb-1 scrollbar-thin">
            {STAGES.map((stage) => {
              const Icon = stage.icon;
              const count = counts[stage.key];
              return (
                <div
                  key={stage.key}
                  className="snap-start shrink-0 min-w-[44%] rounded-lg border border-border/60 bg-card/40 p-3 flex items-center gap-3"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stage.bg}`}>
                    <Icon className={`w-4 h-4 ${stage.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold text-foreground leading-none">{count}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-medium truncate">
                      {stage.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: full funnel with arrows */}
          <div className="hidden sm:flex items-stretch gap-2 overflow-x-auto">
            {STAGES.map((stage, i) => {
              const Icon = stage.icon;
              const count = counts[stage.key];
              return (
                <div key={stage.key} className="flex items-center gap-2 flex-1 min-w-[110px]">
                  <div className="flex flex-col items-center text-center flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${stage.bg}`}>
                      <Icon className={`w-4 h-4 ${stage.color}`} />
                    </div>
                    <p className="text-xl font-bold text-foreground leading-none">{count}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5 font-medium">
                      {stage.label}
                    </p>
                  </div>
                  {i < STAGES.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
