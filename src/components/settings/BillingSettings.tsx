import { useNavigate } from "react-router-dom";
import { ArrowRight, CreditCard, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePlan } from "@/hooks/use-plan";

export default function BillingSettings() {
  const navigate = useNavigate();
  const { plan, planId } = usePlan();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Billing &amp; subscription</h2>
        <p className="text-sm text-muted-foreground mt-1">
          View your current plan or securely change it through Paddle.
        </p>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                <CreditCard className="h-5 w-5 text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">{plan.name} plan</h3>
                  <Badge variant="outline">Current</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {planId === "free"
                    ? "Free"
                    : `${plan.currencySymbol}${plan.priceMonthly} per month`}
                </p>
              </div>
            </div>

            <Button onClick={() => navigate("/dashboard/billing")} className="gap-2">
              Manage plan <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Plan changes, payments, and cancellations are processed by Paddle. CloseSync does not
          store card details in your browser.
        </p>
      </div>
    </div>
  );
}
