import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, TrendingUp, Plus, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProposalStats {
  total: number;
  accepted: number;
  pending: number;
  rejected: number;
  thisWeek: number;
}

interface TotalProposalsCardProps {
  stats: ProposalStats;
}

export default function TotalProposalsCard({ stats }: TotalProposalsCardProps) {
  const navigate = useNavigate();
  const conversionRate = stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0;

  const insights = [
    "Keep going — more proposals = more clients",
    "Great momentum! Stay consistent.",
    "Every proposal is a step closer to revenue.",
  ];
  const insight = insights[stats.total % insights.length];

  return (
    <Card className="group hover:shadow-lg hover:border-accent/20 transition-all duration-300 col-span-2 lg:col-span-1">
      <CardContent className="p-4 sm:p-5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          {stats.thisWeek > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
              <TrendingUp className="w-3 h-3" />
              +{stats.thisWeek} this week
            </span>
          )}
        </div>

        {/* Main stat */}
        <div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Proposals</p>
        </div>

        {/* Breakdown */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> {stats.accepted} Accepted
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <Clock className="w-3 h-3" /> {stats.pending} Pending
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <XCircle className="w-3 h-3" /> {stats.rejected} Rejected
          </span>
        </div>

        {/* Conversion rate */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Conversion Rate</span>
            <span className="font-semibold text-foreground">{conversionRate}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${conversionRate}%` }}
            />
          </div>
        </div>

        {/* Insight */}
        <p className="text-[11px] text-muted-foreground italic">💡 {insight}</p>

        {/* Quick action */}
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs h-8"
          onClick={(e) => {
            e.stopPropagation();
            navigate("/dashboard/new-proposal");
          }}
        >
          <Plus className="w-3 h-3 mr-1" /> Create New Proposal
        </Button>
      </CardContent>
    </Card>
  );
}
