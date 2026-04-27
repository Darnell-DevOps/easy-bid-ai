import { useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Loader2, TrendingUp, AlertTriangle, Target } from "lucide-react";
import { useAIInsight } from "@/hooks/use-ai-insight";
import { severityStyles } from "@/lib/ai-coach";

interface CoachAction {
  title: string;
  reasoning: string;
  recommended_action: string;
  severity: "info" | "warning" | "critical";
  category: string;
}

const CATEGORY_ICONS: Record<string, typeof Target> = {
  follow_up: Target,
  pricing: TrendingUp,
  churn: AlertTriangle,
  lead: Sparkles,
  retainer: TrendingUp,
  opportunity: Sparkles,
  habit: Target,
};

export default function CoachFeedWidget() {
  const { insight, loading, generating, refresh } = useAIInsight({
    entityType: "dashboard",
    entityId: null,
    kind: "coach_feed",
    functionName: "ai-coach-feed",
    payload: {},
  });

  const actions: CoachAction[] = useMemo(() => {
    const raw = (insight?.details as any)?.actions;
    return Array.isArray(raw) ? raw : [];
  }, [insight]);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_60%)] pointer-events-none" />
      <CardContent className="p-5 space-y-4 relative">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                AI Sales Coach
                {actions.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({actions.length} {actions.length === 1 ? "move" : "moves"})
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">Specific moves to make money this week</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={refresh} disabled={generating} className="gap-1.5">
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Refresh
          </Button>
        </div>

        {loading && !insight && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && actions.length === 0 && !generating && (
          <div className="text-center py-6">
            <Sparkles className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">No coaching insights yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click refresh to scan your account.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {actions.map((a, i) => {
            const styles = severityStyles(a.severity);
            const Icon = CATEGORY_ICONS[a.category] || Sparkles;
            return (
              <div
                key={i}
                className={`rounded-lg border p-3 flex items-start gap-3 transition-all hover:scale-[1.005] ${styles.card}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.iconWrap}`}>
                  <Icon className={`w-3.5 h-3.5 ${styles.icon}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.reasoning}</p>
                  <p className="text-xs font-medium mt-1.5 text-foreground/90">
                    → {a.recommended_action}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
