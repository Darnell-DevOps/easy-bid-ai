import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Crown, Sparkles, Zap, Lock, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePlan } from "@/hooks/use-plan";
import { useProposalUsage } from "@/hooks/use-proposal-usage";
import { PLANS, type PlanId } from "@/lib/plans";

export default function Billing() {
  const { toast } = useToast();
  const { planId, plan, setPlan } = usePlan();
  const { countThisMonth, loading } = useProposalUsage();

  const limit = plan.features.proposalsPerMonth;
  const isUnlimited = limit === "unlimited";
  const usagePct = isUnlimited
    ? 0
    : Math.min(100, (countThisMonth / (limit as number)) * 100);
  const remaining = isUnlimited ? Infinity : Math.max(0, (limit as number) - countThisMonth);

  const tiers: PlanId[] = useMemo(() => ["free", "starter", "pro"], []);

  const handleSelectPlan = (next: PlanId) => {
    if (next === planId) return;
    setPlan(next);
    toast({
      title: `Switched to ${PLANS[next].name}`,
      description:
        next === "free"
          ? "You're back on the Free plan."
          : `Welcome to ${PLANS[next].name}! All features unlocked. (Billing not yet collected — preview mode.)`,
    });
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Plans & Pricing
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Close deals faster. Get paid instantly. Turn leads into clients automatically.
        </p>
      </div>

      <div className="space-y-8 max-w-6xl">
        {/* Current plan + usage */}
        <Card className="border-border/60">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    planId === "pro"
                      ? "bg-accent/15"
                      : planId === "starter"
                        ? "bg-purple/15"
                        : "bg-secondary"
                  }`}
                >
                  {planId === "pro" ? (
                    <Crown className="w-5 h-5 text-accent" />
                  ) : planId === "starter" ? (
                    <Sparkles className="w-5 h-5 text-purple" />
                  ) : (
                    <Zap className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {plan.name} Plan
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Current
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {plan.tagline}
                  </p>
                </div>
              </div>
              <div className="sm:text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Proposals this month
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {loading ? "…" : countThisMonth} / {isUnlimited ? "∞" : limit}
                </p>
              </div>
            </div>
            {!isUnlimited && (
              <div className="mt-4">
                <Progress value={usagePct} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-2">
                  {remaining === 0
                    ? `You've used all ${limit} proposals this month.`
                    : `${remaining} proposal${remaining === 1 ? "" : "s"} left this month`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {tiers.map((tierId) => {
            const tier = PLANS[tierId];
            const isCurrent = tierId === planId;
            const isHighlight = tier.highlight;

            return (
              <Card
                key={tier.id}
                className={`relative flex flex-col transition-all ${
                  isHighlight
                    ? "border-accent/50 shadow-lg shadow-accent/10 sm:scale-[1.02]"
                    : "border-border/60"
                } ${isCurrent ? "ring-1 ring-purple/40" : ""}`}
              >
                {isHighlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold border-0 shadow">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="mb-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-2">
                      {tier.name}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-bold text-foreground">
                        {tier.currencySymbol}
                        {tier.priceMonthly}
                      </span>
                      {tier.priceMonthly > 0 && (
                        <span className="text-sm text-muted-foreground">/month</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {tier.tagline}
                    </p>
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {tier.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelectPlan(tier.id)}
                    disabled={isCurrent}
                    className={`w-full ${
                      isHighlight && !isCurrent
                        ? "bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold hover:brightness-110"
                        : ""
                    }`}
                    variant={isCurrent ? "outline" : isHighlight ? "default" : "secondary"}
                  >
                    {isCurrent ? (
                      "Current plan"
                    ) : tier.id === "free" ? (
                      "Switch to Free"
                    ) : (
                      <>
                        Choose {tier.name} <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Comparison footnote */}
        <div className="rounded-lg border border-border/60 bg-card/40 p-5">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground leading-relaxed">
              <span className="text-foreground font-medium">Pro features:</span>{" "}
              Accept &amp; Pay checkout, auto-attached policies, AI lead response, and analytics
              are reserved for Pro. The Free plan adds a "Made with CloseSync" watermark on
              proposals — Starter and Pro remove it.
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Billing collection isn't enabled yet — switching plans here updates your access
            instantly for preview purposes. Payments will be wired up next.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
