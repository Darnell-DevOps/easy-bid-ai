import { RefreshCw, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAIInsight } from "@/hooks/use-ai-insight";
import { scoreBg, scoreColor, scoreLabel } from "@/lib/ai-coach";
import { cn } from "@/lib/utils";

interface DealScoreBadgeProps {
  proposalId: string;
  /** Skip auto-generate (e.g. for drafts) */
  enabled?: boolean;
  size?: "sm" | "md";
}

export default function DealScoreBadge({
  proposalId,
  enabled = true,
  size = "sm",
}: DealScoreBadgeProps) {
  const { insight, loading, generating, error, refresh } = useAIInsight({
    entityType: "proposal",
    entityId: proposalId,
    kind: "deal_score",
    functionName: "ai-deal-score",
    payload: { proposalId },
    enabled,
  });

  if (!enabled) return null;

  if ((loading || generating) && !insight) {
    return (
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy="true"
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium animate-pulse",
          "border-border bg-muted text-muted-foreground",
          size === "md" && "px-2.5 py-1 text-sm",
        )}
      >
        <Sparkles aria-hidden="true" className="w-3 h-3" />
        Scoring
      </span>
    );
  }

  if (error && (!insight || insight.score == null)) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
          Deal score unavailable. {error}
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            size === "md" && "px-2.5 py-1 text-sm",
          )}
        >
          <RefreshCw aria-hidden="true" className="w-3 h-3" />
          Retry score
        </button>
      </span>
    );
  }

  if (!insight || insight.score == null) return null;

  const label = scoreLabel(insight.score);

  return (
    <span aria-busy={generating} className="inline-flex items-center gap-1.5">
      {generating && (
        <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          Refreshing deal score.
        </span>
      )}
      {error && (
        <span role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
          Could not refresh deal score. {error}
        </span>
      )}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Deal score ${insight.score} out of 100, ${label}. Show score details`}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold cursor-help transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                scoreBg(insight.score),
                scoreColor(insight.score),
                size === "md" && "px-2.5 py-1 text-sm",
              )}
            >
              <Sparkles aria-hidden="true" className="w-3 h-3" />
              {insight.score} · {label}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs font-medium">{insight.summary}</p>
            {insight.recommended_action && (
              <p className="text-xs text-muted-foreground mt-1">
                <span aria-hidden="true">💡 </span>{insight.recommended_action}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {error && (
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1 rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <RefreshCw aria-hidden="true" className="w-3 h-3" />
          Retry
          <span className="sr-only"> deal score</span>
        </button>
      )}
    </span>
  );
}
