// Shared helpers for the AI lead score (Hot / Warm / Cold / Unclear)
export type LeadScore = "Hot" | "Warm" | "Cold" | "Unclear";

export const scoreRank = (s: string | null | undefined): number => {
  switch (s) {
    case "Hot": return 3;
    case "Warm": return 2;
    case "Cold": return 1;
    case "Unclear": return 0;
    default: return -1;
  }
};

export const scoreTone = (s: string | null | undefined): string => {
  switch (s) {
    case "Hot":
      return "bg-rose-500/15 text-rose-500 border-rose-500/30";
    case "Warm":
      return "bg-amber-500/15 text-amber-600 border-amber-500/30";
    case "Cold":
      return "bg-slate-500/15 text-slate-400 border-slate-500/30";
    default:
      return "bg-muted/40 text-muted-foreground border-border";
  }
};

export const scoreLabel = (s: string | null | undefined): string =>
  s && ["Hot", "Warm", "Cold", "Unclear"].includes(s) ? s : "Unclear";
