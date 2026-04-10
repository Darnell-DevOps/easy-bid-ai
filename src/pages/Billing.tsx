import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Lock,
  CheckCircle,
  CreditCard,
  FileText,
  Receipt,
  Crown,
  Zap,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const FREE_LIMIT = 3;

export default function Billing() {
  const { toast } = useToast();
  const [proposalCount, setProposalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const currentPlan = "Free"; // TODO: derive from subscription state

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("proposals")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfMonth.toISOString());
      setProposalCount(count ?? 0);
      setLoading(false);
    })();
  }, []);

  const remaining = Math.max(0, FREE_LIMIT - proposalCount);
  const usagePercent = Math.min(100, (proposalCount / FREE_LIMIT) * 100);
  const isFree = currentPlan === "Free";

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your plan and usage
        </p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* ── Plan Summary ── */}
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {isFree ? (
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                    <Zap className="w-4 h-4 text-muted-foreground" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center">
                    <Crown className="w-4 h-4 text-accent" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {currentPlan} Plan
                    </span>
                    <Badge
                      variant="secondary"
                      className={
                        isFree
                          ? "text-xs"
                          : "text-xs bg-accent/20 text-accent border-accent/30"
                      }
                    >
                      {isFree ? "Current" : "Active"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isFree
                      ? "3 proposals per month · Watermark on exports"
                      : "Unlimited proposals · No watermark"}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                Billing: Inactive
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* ── Usage ── */}
        <Card className="glass-card">
          <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Usage This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            {/* Proposals */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-foreground">Proposals created</span>
                <span className="text-muted-foreground font-medium">
                  {loading ? "…" : `${proposalCount} / ${isFree ? FREE_LIMIT : "∞"}`}
                </span>
              </div>
              {isFree && (
                <Progress value={usagePercent} className="h-2" />
              )}
              {isFree && (
                <p className="text-xs text-muted-foreground mt-1">
                  {remaining} proposal{remaining !== 1 ? "s" : ""} remaining
                </p>
              )}
            </div>

            <Separator className="bg-border/50" />

            {/* Exports */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">Exports used</span>
              <span className="text-muted-foreground font-medium">0</span>
            </div>
            {isFree && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                Invoice export available on Pro
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Upgrade / Pro card ── */}
        {isFree && (
          <Card className="glass-card border-accent/40 shadow-[0_0_20px_hsl(var(--accent)/0.15)]">
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Crown className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    Upgrade to Pro — £9/month
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Unlock unlimited proposals, invoice exports, and custom
                    branding
                  </p>
                </div>
              </div>

              <ul className="space-y-2 mb-5">
                {[
                  "Unlimited proposals",
                  "No watermark on exports",
                  "PDF & invoice export",
                  "Custom branding",
                  "Proposal history",
                ].map((f) => (
                  <li
                    key={f}
                    className="text-sm text-muted-foreground flex items-center gap-2"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                className="w-full btn-gradient text-white shadow-[0_0_12px_hsl(var(--accent)/0.4)]"
                onClick={() =>
                  toast({
                    title: "Coming soon",
                    description:
                      "Pro plan payments will be available shortly.",
                  })
                }
              >
                Upgrade to Pro
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Manage Subscription ── */}
        <Card className="glass-card">
          <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Manage Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 text-center space-y-2">
              <AlertCircle className="w-5 h-5 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Billing management will appear here once Stripe is connected
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-1">
                {["Update payment method", "View invoices", "Cancel subscription"].map(
                  (label) => (
                    <span
                      key={label}
                      className="text-xs text-muted-foreground/50 flex items-center gap-1"
                    >
                      <Receipt className="w-3 h-3" />
                      {label}
                    </span>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
