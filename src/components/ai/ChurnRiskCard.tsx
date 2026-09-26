import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useAIInsight } from "@/hooks/use-ai-insight";
import { scoreBg, scoreColor } from "@/lib/ai-coach";

interface ChurnRiskCardProps {
  retainerId: string;
  /** Only render when retainer is active */
  enabled?: boolean;
}

export default function ChurnRiskCard({ retainerId, enabled = true }: ChurnRiskCardProps) {
  const { insight, loading, generating, error, refresh } = useAIInsight({
    entityType: "retainer",
    entityId: retainerId,
    kind: "churn_risk",
    functionName: "ai-churn-risk",
    payload: { retainerId },
    enabled,
  });
  const errorRef = useRef<HTMLDivElement>(null);
  const previousBusyRef = useRef({ loading, generating });
  const [statusMessage, setStatusMessage] = useState("");

  const riskLabel = insight?.score == null
    ? null
    : insight.score >= 70
      ? "High"
      : insight.score >= 40
        ? "Medium"
        : "Low";

  useEffect(() => {
    const wasBusy = previousBusyRef.current.loading || previousBusyRef.current.generating;

    if (generating && insight) {
      setStatusMessage("Refreshing churn risk.");
    } else if (!loading && !generating && wasBusy && insight?.score != null && riskLabel && !error) {
      setStatusMessage(`Churn risk ready. ${riskLabel} risk, ${insight.score} out of 100.`);
    } else if (error) {
      setStatusMessage("");
    }

    previousBusyRef.current = { loading, generating };
  }, [error, generating, insight, loading, riskLabel]);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  if (!enabled) return null;

  if ((loading || generating) && !insight) {
    return (
      <Card aria-busy="true" className="border-border/60">
        <CardContent role="status" aria-live="polite" aria-atomic="true" className="p-4 flex items-center gap-3">
          <ShieldAlert aria-hidden="true" className="w-4 h-4 text-muted-foreground animate-pulse" />
          <p className="text-sm text-muted-foreground">
            {generating ? "AI is checking churn risk…" : "Loading churn risk…"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error && (!insight || insight.score == null)) {
    return (
      <Card>
        <CardContent className="p-4">
          <div
            ref={errorRef}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            tabIndex={-1}
            className="space-y-3 rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <p>Could not check churn risk. {error}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
              Retry risk check
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insight || insight.score == null) return null;

  return (
    <Card aria-busy={generating} className={scoreBg(100 - insight.score)}>
      <CardContent className="p-4 space-y-3">
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
            className="flex flex-col items-start gap-2 rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span>Could not refresh churn risk. {error}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
              Retry risk check
            </Button>
          </div>
        )}
        <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${scoreBg(100 - insight.score)}`}>
          <ShieldAlert aria-hidden="true" className={`w-4 h-4 ${scoreColor(100 - insight.score)}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">Churn Risk</p>
            <span className={`text-xs font-bold ${scoreColor(100 - insight.score)}`}>
              {insight.score}/100
            </span>
            <span className="text-xs font-semibold text-foreground">{riskLabel} risk</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{insight.summary}</p>
          {insight.recommended_action && (
            <p className="text-xs text-foreground/80 mt-1.5">
              <span aria-hidden="true">💡 </span><span className="font-medium">{insight.recommended_action}</span>
            </p>
          )}
        </div>
        </div>
      </CardContent>
    </Card>
  );
}
