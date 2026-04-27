import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ShieldAlert } from "lucide-react";
import { useAIInsight } from "@/hooks/use-ai-insight";
import { scoreBg, scoreColor } from "@/lib/ai-coach";

interface ChurnRiskCardProps {
  retainerId: string;
  /** Only render when retainer is active */
  enabled?: boolean;
}

export default function ChurnRiskCard({ retainerId, enabled = true }: ChurnRiskCardProps) {
  const { insight, generating } = useAIInsight({
    entityType: "retainer",
    entityId: retainerId,
    kind: "churn_risk",
    functionName: "ai-churn-risk",
    payload: { retainerId },
    enabled,
  });

  if (!enabled) return null;

  if (generating && !insight) {
    return (
      <Card className="border-border/60 animate-pulse">
        <CardContent className="p-4 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">AI is checking churn risk...</p>
        </CardContent>
      </Card>
    );
  }

  if (!insight || insight.score == null) return null;

  return (
    <Card className={scoreBg(100 - insight.score)}>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${scoreBg(100 - insight.score)}`}>
          <ShieldAlert className={`w-4 h-4 ${scoreColor(100 - insight.score)}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">Churn Risk</p>
            <span className={`text-xs font-bold ${scoreColor(100 - insight.score)}`}>
              {insight.score}/100
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{insight.summary}</p>
          {insight.recommended_action && (
            <p className="text-xs text-foreground/80 mt-1.5">
              💡 <span className="font-medium">{insight.recommended_action}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
