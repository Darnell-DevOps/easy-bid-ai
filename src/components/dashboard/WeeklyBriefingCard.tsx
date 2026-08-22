import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, AlertTriangle, Target } from "lucide-react";
import { useAIInsight } from "@/hooks/use-ai-insight";

export default function WeeklyBriefingCard() {
  const { insight, loading, generating, error, refresh } = useAIInsight({
    entityType: "dashboard",
    entityId: null,
    kind: "weekly_briefing",
    functionName: "ai-coach-feed",
    payload: {},
    // Coach feed function generates both — only one should auto-trigger; CoachFeedWidget triggers it.
    autoGenerate: false,
  });
  const errorRef = useRef<HTMLDivElement>(null);
  const previousBusyRef = useRef({ loading, generating });
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const wasBusy = previousBusyRef.current.loading || previousBusyRef.current.generating;

    if (generating) {
      setStatusMessage("Refreshing weekly briefing.");
    } else if (wasBusy && insight && !error) {
      setStatusMessage("Weekly briefing ready.");
    } else if (error) {
      setStatusMessage("");
    }

    previousBusyRef.current = { loading, generating };
  }, [error, generating, insight, loading]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  if (loading && !insight) {
    return (
      <Card className="border-border/60 bg-card overflow-hidden" aria-busy="true">
        <CardContent
          className="p-5 flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
          Loading weekly briefing…
        </CardContent>
      </Card>
    );
  }

  if (error && !insight) {
    return (
      <Card className="border-border/60 bg-card overflow-hidden">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
            <h2 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
              Weekly Briefing
            </h2>
          </div>
          <div ref={errorRef} role="alert" tabIndex={-1} className="space-y-3 outline-none">
            <p className="text-sm text-destructive">
              Could not load the weekly briefing. {error}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
              Retry weekly briefing
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insight) return null;
  const d = (insight.details ?? {}) as {
    headline?: string;
    wins?: string[];
    worries?: string[];
    one_thing?: string;
  };

  return (
    <Card
      className="border-border/60 bg-card overflow-hidden"
      aria-labelledby="weekly-briefing-title"
      aria-busy={generating}
    >
      <CardContent className="p-5 space-y-3">
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
          <h2
            id="weekly-briefing-title"
            className="text-xs uppercase tracking-wide font-semibold text-muted-foreground"
          >
            Weekly Briefing
          </h2>
        </div>
        <p className="text-base font-semibold leading-snug">{d.headline || insight.summary}</p>

        {error && (
          <div ref={errorRef} role="alert" tabIndex={-1} className="space-y-2 outline-none">
            <p className="text-sm text-destructive">
              Could not refresh the weekly briefing. {error}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
              Retry weekly briefing
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {!!d.wins?.length && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                <h3 id="weekly-briefing-wins" className="text-xs font-semibold">Wins</h3>
              </div>
              <ul className="space-y-1" aria-labelledby="weekly-briefing-wins">
                {d.wins.map((w: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-emerald-500" aria-hidden="true">•</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!d.worries?.length && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                <h3 id="weekly-briefing-watch" className="text-xs font-semibold">Watch</h3>
              </div>
              <ul className="space-y-1" aria-labelledby="weekly-briefing-watch">
                {d.worries.map((w: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-amber-500" aria-hidden="true">•</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {d.one_thing && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex gap-2.5 items-start mt-2">
            <Target className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="text-xs uppercase tracking-wide font-semibold text-primary mb-0.5">
                The one thing this week
              </h3>
              <p className="text-sm font-medium">{d.one_thing}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
