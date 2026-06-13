import { Check, FileText, FileSignature, CreditCard, ClipboardList, CalendarCheck, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectStage =
  | "proposal"
  | "contract"
  | "payment"
  | "onboarding"
  | "kickoff"
  | "active";

const STAGES: { id: ProjectStage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "proposal", label: "Proposal", icon: FileText },
  { id: "contract", label: "Contract", icon: FileSignature },
  { id: "payment", label: "Payment", icon: CreditCard },
  { id: "onboarding", label: "Onboarding", icon: ClipboardList },
  { id: "kickoff", label: "Kickoff", icon: CalendarCheck },
  { id: "active", label: "Project Active", icon: Rocket },
];

const ORDER: Record<ProjectStage, number> = {
  proposal: 0,
  contract: 1,
  payment: 2,
  onboarding: 3,
  kickoff: 4,
  active: 5,
};

interface Props {
  currentStage: ProjectStage;
  className?: string;
}

export default function ProjectProgressTracker({ currentStage, className }: Props) {
  const currentIdx = ORDER[currentStage];

  return (
    <div className={cn("rounded-xl border border-border bg-card/60 p-4 sm:p-5", className)}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3 text-center sm:text-left">
        Project Progress
      </p>
      <div className="flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isComplete = i < currentIdx || currentStage === "active";
          const isCurrent = i === currentIdx && currentStage !== "active";
          return (
            <div key={stage.id} className="flex items-center flex-1 min-w-0 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className={cn(
                    "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border-2 transition-all shrink-0",
                    isComplete && "bg-emerald-500 border-emerald-500 text-white",
                    isCurrent && "bg-purple/20 border-purple text-purple animate-pulse",
                    !isComplete && !isCurrent && "bg-muted/30 border-border text-muted-foreground",
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
                    (i < currentIdx || currentStage === "active") ? "bg-emerald-500" : "bg-border",
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
