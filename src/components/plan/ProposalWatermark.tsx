import { Sparkles } from "lucide-react";

/**
 * Diagonal "Made with CloseSync — Free Plan" watermark overlay shown on
 * Free-plan proposals (both owner preview and client portal). Non-interactive.
 */
export default function ProposalWatermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden select-none"
    >
      {/* Tiled diagonal label */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rotate-[-22deg] flex flex-col gap-10 opacity-[0.06]">
          {Array.from({ length: 6 }).map((_, row) => (
            <div key={row} className="flex gap-12 whitespace-nowrap">
              {Array.from({ length: 4 }).map((_, col) => (
                <span
                  key={col}
                  className="text-foreground text-3xl sm:text-5xl font-extrabold tracking-tight"
                >
                  CloseSync · Free Plan
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Corner badge — slightly more visible */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md border border-border/60 bg-card/80 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold backdrop-blur">
        <Sparkles className="w-3 h-3 text-accent" />
        Made with CloseSync
      </div>
    </div>
  );
}
