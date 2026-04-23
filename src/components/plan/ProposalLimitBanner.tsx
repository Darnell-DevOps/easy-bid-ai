import { Link } from "react-router-dom";
import { AlertTriangle, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/hooks/use-plan";
import { useProposalUsage } from "@/hooks/use-proposal-usage";
import { PLANS } from "@/lib/plans";

/**
 * Compact banner shown on the New Proposal page when the user is at or near
 * their monthly proposal limit. Hidden entirely for unlimited plans.
 */
export default function ProposalLimitBanner() {
  const { plan, isFree } = usePlan();
  const { countThisMonth, loading } = useProposalUsage();

  if (loading) return null;
  if (plan.features.proposalsPerMonth === "unlimited") return null;

  const limit = plan.features.proposalsPerMonth;
  const remaining = Math.max(0, limit - countThisMonth);
  const atLimit = countThisMonth >= limit;
  const nearLimit = !atLimit && remaining <= 1;

  if (!atLimit && !nearLimit) return null;

  const upgradeTarget = isFree ? PLANS.starter : PLANS.pro;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
        atLimit
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-border bg-card/60"
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertTriangle
          className={`w-4 h-4 shrink-0 mt-0.5 ${atLimit ? "text-amber-500" : "text-muted-foreground"}`}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {atLimit
              ? `You've used all ${limit} proposals on the ${plan.name} plan this month`
              : `${remaining} proposal${remaining === 1 ? "" : "s"} left this month`}
          </p>
          <p className="text-xs text-muted-foreground">
            {atLimit
              ? `Upgrade to ${upgradeTarget.name} to keep generating proposals.`
              : "Close deals faster — upgrade for more capacity and pro features."}
          </p>
        </div>
      </div>
      <Button
        asChild
        size="sm"
        className="shrink-0 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold hover:brightness-110"
      >
        <Link to="/dashboard/billing" className="gap-1.5">
          <Crown className="w-3.5 h-3.5" />
          Upgrade to {upgradeTarget.name}
        </Link>
      </Button>
    </div>
  );
}
