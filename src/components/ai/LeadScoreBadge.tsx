import { Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { scoreBg, scoreColor, scoreLabel } from "@/lib/ai-coach";
import { cn } from "@/lib/utils";

export interface LeadScoreBadgeProps {
  /** 0–100 fit score produced by the single lead-qualify AI call (leads.fit_score). */
  fitScore: number | null | undefined;
  /** Top signals (leads.fit_factors). */
  factors?: Array<{ label: string; impact: "positive" | "negative" }> | null;
  /** leads.lead_score_reason — shown as the primary tooltip summary. */
  reason?: string | null;
  /** leads.ai_recommendation — shown as the tooltip's recommended-action hint. */
  recommendedAction?: string | null;
  /** True while the lead has not yet been qualified — renders a shimmer badge. */
  pending?: boolean;
  size?: "sm" | "md";
}

/**
 * Renders the fit-score badge sourced directly from the leads row.
 * Previously called the retired `ai-lead-score` edge function via useAIInsight — that duplicate
 * scorer has been folded into the single `_shared/lead-qualify` call that produces every other
 * qualification field, so this component is now purely presentational.
 */
export default function LeadScoreBadge({
  fitScore,
  factors,
  reason,
  recommendedAction,
  pending = false,
  size = "sm",
}: LeadScoreBadgeProps) {
  if (pending && (fitScore == null)) {
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

  if (fitScore == null) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold cursor-help transition-all",
              scoreBg(fitScore),
              scoreColor(fitScore),
              size === "md" && "px-2.5 py-1 text-sm",
            )}
          >
            <Sparkles className="w-3 h-3" />
            {fitScore} · {scoreLabel(fitScore)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {reason && <p className="text-xs font-medium">{reason}</p>}
          {Array.isArray(factors) && factors.length > 0 && (
            <div className="mt-2 space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Top factors</p>
              <ul className="space-y-0.5">
                {factors.slice(0, 5).map((f, i) => (
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
          {recommendedAction && (
            <p className="text-xs text-muted-foreground mt-2">💡 {recommendedAction}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
