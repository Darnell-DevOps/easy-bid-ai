import { Check, FileText, Eye, CheckCircle2, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export type DealStage = "sent" | "viewed" | "accepted" | "paid";

interface Props {
  currentStage: DealStage;
  className?: string;
}

const STAGES: { id: DealStage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "sent", label: "Sent", icon: FileText },
  { id: "viewed", label: "Viewed", icon: Eye },
  { id: "accepted", label: "Accepted", icon: CheckCircle2 },
  { id: "paid", label: "Paid", icon: CreditCard },
];

const ORDER: Record<DealStage, number> = { sent: 0, viewed: 1, accepted: 2, paid: 3 };

export default function DealProgressTracker({ currentStage, className }: Props) {
  const currentIdx = ORDER[currentStage];

  return (
    <div className={cn("rounded-xl border border-border bg-card/60 p-4 sm:p-5", className)}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3 text-center sm:text-left">
        Deal Progress
      </p>
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isComplete = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isPending = i > currentIdx;

          return (
            <div key={stage.id} className="flex items-center flex-1 min-w-0 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className={cn(
                    "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border-2 transition-all shrink-0",
                    isComplete && "bg-emerald-500 border-emerald-500 text-white",
                    isCurrent && "bg-purple/20 border-purple text-purple animate-pulse",
                    isPending && "bg-muted/30 border-border text-muted-foreground",
                  )}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] sm:text-xs font-medium whitespace-nowrap",
                    (isComplete || isCurrent) ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stage.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-1 sm:mx-2 rounded -translate-y-2.5 transition-all",
                    i < currentIdx ? "bg-emerald-500" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
