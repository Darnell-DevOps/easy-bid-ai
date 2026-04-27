import { Sparkles } from "lucide-react";
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
  const { insight, generating } = useAIInsight({
    entityType: "proposal",
    entityId: proposalId,
    kind: "deal_score",
    functionName: "ai-deal-score",
    payload: { proposalId },
    enabled,
  });

  if (!enabled) return null;

  if (generating && !insight) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium animate-pulse",
          "border-border bg-muted text-muted-foreground",
          size === "md" && "px-2.5 py-1 text-sm",
        )}
        title="AI scoring this deal..."
      >
        <Sparkles className="w-3 h-3" />
        Scoring
      </span>
    );
  }

  if (!insight || insight.score == null) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold cursor-help transition-all",
              scoreBg(insight.score),
              scoreColor(insight.score),
              size === "md" && "px-2.5 py-1 text-sm",
            )}
          >
            <Sparkles className="w-3 h-3" />
            {insight.score} · {scoreLabel(insight.score)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs font-medium">{insight.summary}</p>
          {insight.recommended_action && (
            <p className="text-xs text-muted-foreground mt-1">
              💡 {insight.recommended_action}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
