import { useAIInsight } from "@/hooks/use-ai-insight";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { scoreColor } from "@/lib/ai-coach";

interface ProposalAuditPanelProps {
  proposalId: string;
}

export default function ProposalAuditPanel({ proposalId }: ProposalAuditPanelProps) {
  const { insight, loading, generating, error, refresh } = useAIInsight({
    entityType: "audit",
    entityId: proposalId,
    kind: "audit",
    functionName: "ai-proposal-audit",
    payload: { proposalId },
    autoGenerate: false,
  });

  const details = (insight?.details ?? {}) as any;
  const hasResult = !!insight;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">AI Proposal Audit</h3>
              <p className="text-xs text-muted-foreground">
                Pricing verdict, scope clarity, and rewrite tips
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={refresh}
            disabled={generating || loading}
            className="gap-1.5"
          >
            {generating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Auditing...
              </>
            ) : hasResult ? (
              <>
                <RefreshCw className="w-3.5 h-3.5" /> Re-run audit
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" /> Run AI Audit
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded p-2">
            {error}
          </div>
        )}

        {hasResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Overall" value={`${details.overall_score ?? "—"}/100`} score={details.overall_score} />
              <Stat
                label="Close odds"
                value={`${details.predicted_close_probability ?? "—"}%`}
                score={details.predicted_close_probability}
              />
              <Stat
                label="Scope clarity"
                value={`${details.scope_clarity_score ?? "—"}/100`}
                score={details.scope_clarity_score}
              />
            </div>

            <div className="rounded-lg border border-border/60 bg-card p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Pricing</span>
                <Badge variant={details.pricing_verdict === "fair" ? "secondary" : "outline"} className="text-xs">
                  {details.pricing_verdict}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{details.pricing_rationale}</p>
              {details.suggested_price_low && details.suggested_price_high && (
                <p className="text-xs font-medium">
                  Suggested range: {details.suggested_price_low.toLocaleString()} –{" "}
                  {details.suggested_price_high.toLocaleString()}
                </p>
              )}
            </div>

            {!!details.strengths?.length && (
              <Section title="Strengths" icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}>
                <ul className="space-y-1">
                  {details.strengths.map((s: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="text-emerald-500">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {!!details.missing_sections?.length && (
              <Section title="Missing or weak" icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}>
                <div className="flex flex-wrap gap-1.5">
                  {details.missing_sections.map((s: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs border-amber-500/40 text-amber-500">
                      {s}
                    </Badge>
                  ))}
                </div>
              </Section>
            )}

            {!!details.rewrite_suggestions?.length && (
              <Section title="Rewrite suggestions" icon={<Sparkles className="w-3.5 h-3.5 text-primary" />}>
                <ul className="space-y-2">
                  {details.rewrite_suggestions.map((r: any, i: number) => (
                    <li key={i} className="text-xs">
                      <p className="font-medium text-foreground">{r.target}</p>
                      <p className="text-muted-foreground mt-0.5">{r.suggestion}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, score }: { label: string; value: string; score?: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${typeof score === "number" ? scoreColor(score) : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}
