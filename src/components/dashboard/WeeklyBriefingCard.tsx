import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, TrendingUp, AlertTriangle, Target } from "lucide-react";
import { useAIInsight } from "@/hooks/use-ai-insight";

export default function WeeklyBriefingCard() {
  const { insight, loading } = useAIInsight({
    entityType: "dashboard",
    entityId: null,
    kind: "weekly_briefing",
    functionName: "ai-coach-feed",
    payload: {},
    // Coach feed function generates both — only one should auto-trigger; CoachFeedWidget triggers it.
    autoGenerate: false,
  });

  if (loading || !insight) return null;
  const d = (insight.details ?? {}) as any;

  return (
    <Card className="border-border/60 bg-card overflow-hidden">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
            Weekly Briefing
          </span>
        </div>
        <p className="text-base font-semibold leading-snug">{d.headline || insight.summary}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {!!d.wins?.length && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-semibold">Wins</span>
              </div>
              <ul className="space-y-1">
                {d.wins.map((w: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-emerald-500">•</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!d.worries?.length && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold">Watch</span>
              </div>
              <ul className="space-y-1">
                {d.worries.map((w: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-amber-500">•</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {d.one_thing && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex gap-2.5 items-start mt-2">
            <Target className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-primary mb-0.5">
                The one thing this week
              </p>
              <p className="text-sm font-medium">{d.one_thing}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
