// Shared types + helpers for the AI Sales Coach feature.

export type InsightKind =
  | "deal_score"
  | "lead_score"
  | "audit"
  | "churn_risk"
  | "coach_feed"
  | "weekly_briefing";

export type InsightEntityType = "proposal" | "retainer" | "dashboard" | "audit" | "lead";
export type InsightSeverity = "info" | "warning" | "critical";

export interface AIInsight {
  id: string;
  user_id: string;
  entity_type: InsightEntityType;
  entity_id: string | null;
  kind: InsightKind;
  score: number | null;
  severity: InsightSeverity | null;
  summary: string;
  details: Record<string, any>;
  recommended_action: string | null;
  action_url: string | null;
  generated_at: string;
  expires_at: string | null;
  dismissed_at: string | null;
}

// Cache TTL in ms — frontend uses this to decide whether to trigger regeneration.
export const INSIGHT_TTL_MS: Record<InsightKind, number> = {
  deal_score: 6 * 60 * 60 * 1000, // 6h
  lead_score: 12 * 60 * 60 * 1000, // 12h
  churn_risk: 12 * 60 * 60 * 1000, // 12h
  coach_feed: 60 * 60 * 1000, // 1h
  weekly_briefing: 7 * 24 * 60 * 60 * 1000, // 7d
  audit: Number.POSITIVE_INFINITY, // manual re-run only
};

export function isInsightStale(insight: AIInsight | null, kind: InsightKind): boolean {
  if (!insight) return true;
  const ttl = INSIGHT_TTL_MS[kind];
  if (!Number.isFinite(ttl)) return false;
  const age = Date.now() - new Date(insight.generated_at).getTime();
  return age > ttl;
}

export function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  if (score >= 25) return "text-orange-500";
  return "text-rose-500";
}

export function scoreBg(score: number): string {
  if (score >= 75) return "bg-emerald-500/15 border-emerald-500/30";
  if (score >= 50) return "bg-amber-500/15 border-amber-500/30";
  if (score >= 25) return "bg-orange-500/15 border-orange-500/30";
  return "bg-rose-500/15 border-rose-500/30";
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Hot";
  if (score >= 60) return "Warm";
  if (score >= 40) return "Lukewarm";
  if (score >= 20) return "Cold";
  return "Stale";
}

export function severityStyles(severity: InsightSeverity | null) {
  switch (severity) {
    case "critical":
      return {
        card: "border-rose-500/30 bg-rose-500/5",
        iconWrap: "bg-rose-500/15",
        icon: "text-rose-500",
        button: "bg-rose-500 text-white hover:bg-rose-500/90",
      };
    case "warning":
      return {
        card: "border-amber-500/30 bg-amber-500/5",
        iconWrap: "bg-amber-500/15",
        icon: "text-amber-500",
        button: "bg-amber-500 text-white hover:bg-amber-500/90",
      };
    default:
      return {
        card: "border-blue-500/30 bg-blue-500/5",
        iconWrap: "bg-blue-500/15",
        icon: "text-blue-500",
        button: "bg-blue-500 text-white hover:bg-blue-500/90",
      };
  }
}
