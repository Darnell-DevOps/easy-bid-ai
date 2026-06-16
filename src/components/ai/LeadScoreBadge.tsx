import { Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAIInsight } from "@/hooks/use-ai-insight";
import { scoreBg, scoreColor, scoreLabel } from "@/lib/ai-coach";
import { cn } from "@/lib/utils";

interface LeadScoreBadgeProps {
  leadId: string;
  /** Skip auto-generate (e.g. archived/converted leads) */
  enabled?: boolean;
  size?: "sm" | "md";
}

export default function LeadScoreBadge({ leadId, enabled = true, size = "sm" }: LeadScoreBadgeProps) {
  const { insight, generating } = useAIInsight({
    entityType: "lead",
    entityId: leadId,
    kind: "lead_score",
    functionName: "ai-lead-score",
    payload: { leadId },
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
        title="AI scoring this lead..."
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
          {Array.isArray((insight.details as any)?.factors) && (insight.details as any).factors.length > 0 && (
            <div className="mt-2 space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Top factors</p>
              <ul className="space-y-0.5">
                {((insight.details as any).factors as Array<{ label: string; impact: "positive" | "negative" }>)
                  .slice(0, 5)
                  .map((f, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5">
                      <span className={cn("mt-0.5", f.impact === "positive" ? "text-emerald-500" : "text-rose-500")}>
                        {f.impact === "positive" ? "▲" : "▼"}
                      </span>
                      <span className="leading-snug">{f.label}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {insight.recommended_action && (
            <p className="text-xs text-muted-foreground mt-2">💡 {insight.recommended_action}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
