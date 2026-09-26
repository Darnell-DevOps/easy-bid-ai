import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessagesSquare, RefreshCw, Loader2, TrendingUp, AlertTriangle, Target } from "lucide-react";
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
  lead: MessagesSquare,
  retainer: TrendingUp,
  opportunity: MessagesSquare,
  habit: Target,
};

export default function CoachFeedWidget() {
  const { insight, loading, generating, error, refresh } = useAIInsight({
    entityType: "dashboard",
    entityId: null,
    kind: "coach_feed",
    functionName: "ai-coach-feed",
    payload: {},
  });
  const errorRef = useRef<HTMLDivElement>(null);
  const previousBusyRef = useRef({ loading, generating });
  const [statusMessage, setStatusMessage] = useState("");

  const actions: CoachAction[] = useMemo(() => {
    const raw = (insight?.details as any)?.actions;
    return Array.isArray(raw) ? raw : [];
  }, [insight]);

  useEffect(() => {
    const wasBusy = previousBusyRef.current.loading || previousBusyRef.current.generating;

    if (loading) {
      setStatusMessage("Loading AI Sales Coach recommendations.");
    } else if (generating) {
      setStatusMessage("Refreshing AI Sales Coach recommendations.");
    } else if (error) {
      setStatusMessage("");
    } else if (wasBusy) {
      setStatusMessage(
        actions.length === 0
          ? "AI Sales Coach refresh complete. No recommendations are available yet."
          : `AI Sales Coach recommendations ready. ${actions.length} ${actions.length === 1 ? "recommendation" : "recommendations"}.`,
      );
    }

    previousBusyRef.current = { loading, generating };
  }, [actions.length, error, generating, loading]);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  return (
    <Card aria-busy={loading || generating} className="border-primary/20 bg-card overflow-hidden relative">
      <CardContent className="p-4 sm:p-5 space-y-4 relative">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <MessagesSquare aria-hidden="true" className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
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
          <Button size="sm" variant="outline" onClick={refresh} disabled={generating} aria-busy={generating} className="gap-1.5">
            {generating ? (
              <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />
            )}
            Refresh
          </Button>
        </div>

        {statusMessage && (
          <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {statusMessage}
          </p>
        )}

        {error && (
          <div
            ref={errorRef}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            tabIndex={-1}
            className="rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Could not update the AI Sales Coach. {error}
          </div>
        )}

        {loading && !insight && (
          <div aria-hidden="true" className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && actions.length === 0 && !generating && !error && (
          <div className="text-center py-6 space-y-2">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center mx-auto">
              <MessagesSquare aria-hidden="true" className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Your AI coach is ready</p>
            <p className="text-xs text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
              Add a client or send a proposal and the coach will tell you the single highest-leverage move to make today.
            </p>
          </div>
        )}

        <div role="list" aria-label="AI Sales Coach recommendations" className="space-y-2">
          {actions.map((a, i) => {
            const styles = severityStyles(a.severity);
            const Icon = CATEGORY_ICONS[a.category] || MessagesSquare;
            return (
              <div
                key={i}
                role="listitem"
                className={`rounded-lg border p-3 flex items-start gap-3 transition-all hover:scale-[1.005] ${styles.card}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.iconWrap}`}>
                  <Icon aria-hidden="true" className={`w-3.5 h-3.5 ${styles.icon}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="sr-only">Priority: {a.severity}. </span>
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
