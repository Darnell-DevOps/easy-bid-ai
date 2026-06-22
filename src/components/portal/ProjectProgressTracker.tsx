import {
  CheckCircle2,
  FileText,
  FileSignature,
  CreditCard,
  ClipboardList,
  CalendarCheck,
  Rocket,
  Circle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectStage =
  | "proposal"
  | "contract"
  | "payment"
  | "onboarding"
  | "kickoff"
  | "active";

const STAGES: {
  id: ProjectStage;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "proposal", label: "Proposal", detail: "Review and accept your proposal", icon: FileText },
  { id: "contract", label: "Contract", detail: "Sign your service agreement", icon: FileSignature },
  { id: "payment", label: "Payment", detail: "Secure your slot with payment", icon: CreditCard },
  { id: "onboarding", label: "Onboarding", detail: "Share project details with us", icon: ClipboardList },
  { id: "kickoff", label: "Kickoff", detail: "Book the call that gets us started", icon: CalendarCheck },
  { id: "active", label: "Project Active", detail: "We're delivering on your project", icon: Rocket },
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
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl p-5 sm:p-6 shadow-[0_20px_60px_-30px_hsl(var(--accent)/0.3)]",
        className,
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold mb-4">
        Project Progress
      </p>
      <div className="space-y-3">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isComplete = i < currentIdx || currentStage === "active";
          const isCurrent = i === currentIdx && currentStage !== "active";
          const isPending = !isComplete && !isCurrent;

          const statusPill = isComplete
            ? { label: "Complete", cls: "border-emerald-400/40 text-emerald-400 bg-emerald-400/5" }
            : isCurrent
            ? { label: "In progress", cls: "border-accent/50 text-accent bg-accent/5" }
            : { label: "Pending", cls: "border-border/40 text-muted-foreground" };

          return (
            <div
              key={stage.id}
              className={cn(
                "group relative flex items-start gap-4 p-4 rounded-xl border transition-all duration-500",
                isCurrent &&
                  "border-accent/60 bg-accent/5 shadow-[0_0_40px_-10px_hsl(var(--accent)/0.5)]",
                isComplete && "border-border/50 bg-background/30",
                isPending && "border-border/30 bg-background/10 opacity-60",
              )}
            >
              {/* Connector line */}
              {i < STAGES.length - 1 && (
                <span
                  className={cn(
                    "absolute left-[27px] top-[52px] bottom-[-14px] w-px transition-colors duration-500",
                    isComplete
                      ? "bg-gradient-to-b from-emerald-400/60 to-accent/10"
                      : "bg-border/40",
                  )}
                />
              )}

              {/* Status icon */}
              <div
                className={cn(
                  "relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-500",
                  isComplete &&
                    "bg-gradient-to-br from-emerald-500/20 to-accent/20 border-emerald-400/40",
                  isCurrent &&
                    "bg-gradient-to-br from-accent/30 to-purple/30 border-accent/60 shadow-[0_0_24px_hsl(var(--accent)/0.6)]",
                  isPending && "bg-muted/20 border-border/40",
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-scale-in" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground" />
                )}
                {isCurrent && (
                  <span className="absolute inset-0 rounded-full border border-accent/50 animate-ping" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      className={cn(
                        "w-3.5 h-3.5 shrink-0",
                        isPending ? "text-muted-foreground" : "text-foreground/80",
                      )}
                    />
                    <span className="font-medium text-sm text-foreground truncate">{stage.label}</span>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
                      statusPill.cls,
                    )}
                  >
                    {statusPill.label}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">{stage.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
