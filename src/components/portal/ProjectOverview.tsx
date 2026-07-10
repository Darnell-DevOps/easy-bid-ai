import { Link as RouterLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileSignature,
  FileText,
  Rocket,
  Sparkles,
  Clock,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStage } from "./ProjectProgressTracker";

interface ActivityEvent {
  id: string;
  iso: string;
  label: string;
  tone: "blue" | "purple" | "emerald" | "amber" | "rose";
}

interface UpcomingBooking {
  scheduled_at: string;
  meeting_name?: string | null;
}

interface NextAction {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  ctaLabel: string;
  disabled?: boolean;
}

interface Props {
  clientName: string;
  projectName: string;
  stage: ProjectStage;
  stageLabel: string;
  nextAction: NextAction | null;
  upcomingBooking: UpcomingBooking | null;
  upcomingDeadline: { title: string; due_at: string } | null;
  activity: ActivityEvent[];
  progressPct: number;
}

const TONE_BG: Record<ActivityEvent["tone"], string> = {
  blue: "bg-blue-500/15 text-blue-400",
  purple: "bg-purple/15 text-purple",
  emerald: "bg-emerald-500/15 text-emerald-400",
  amber: "bg-amber-500/15 text-amber-400",
  rose: "bg-rose-500/15 text-rose-400",
};

const TONE_DOT: Record<ActivityEvent["tone"], string> = {
  blue: "bg-blue-400",
  purple: "bg-purple",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
};

const TONE_ICON: Record<ActivityEvent["tone"], React.ComponentType<{ className?: string }>> = {
  blue: FileText,
  purple: FileSignature,
  emerald: CheckCircle2,
  amber: Calendar,
  rose: CreditCard,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} at ${time}`;
}

export default function ProjectOverview({
  clientName,
  projectName,
  stage,
  stageLabel,
  nextAction,
  upcomingBooking,
  upcomingDeadline,
  activity,
  progressPct,
}: Props) {
  const firstName = clientName.split(" ")[0] || clientName;
  const NextIcon = nextAction?.icon || Sparkles;
  const liveActivity = activity.slice(0, 3);

  return (
    <section className="space-y-4">
      {/* Welcome header — glass + animated progress */}
      <div className="relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl p-5 sm:p-6 overflow-hidden shadow-[0_30px_80px_-30px_hsl(var(--accent)/0.35)]">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-purple/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-purple font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              Project Hub · {stageLabel}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1">
              Welcome back, <span className="bg-gradient-to-r from-accent to-purple bg-clip-text text-transparent">{firstName}</span>
            </h1>
            <p className="text-sm text-muted-foreground truncate">{projectName}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold mb-1">Progress</p>
            <p className="text-2xl sm:text-3xl font-bold tabular-nums bg-gradient-to-r from-accent to-purple bg-clip-text text-transparent">
              {progressPct}%
            </p>
          </div>
        </div>
        <div className="relative mt-5 h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent via-purple to-accent rounded-full transition-all duration-700 ease-out shadow-[0_0_20px_hsl(var(--accent)/0.6)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Next action + side info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Next action card */}
        <div className="relative lg:col-span-2 rounded-2xl border border-purple/30 bg-card/70 backdrop-blur-xl p-5 sm:p-6 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-purple/15 blur-3xl pointer-events-none" />
          <p className="relative text-[10px] uppercase tracking-[0.25em] text-purple font-semibold mb-3">
            Next Action
          </p>
          {nextAction ? (
            <div className="relative flex items-start gap-4">
              <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-purple/30 to-accent/30 border border-purple/50 flex items-center justify-center flex-shrink-0 shadow-[0_0_24px_hsl(var(--accent)/0.4)]">
                <NextIcon className="w-5 h-5 text-foreground" />
                <span className="absolute inset-0 rounded-xl border border-accent/40 animate-ping opacity-60" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
                  {nextAction.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">{nextAction.description}</p>
                {nextAction.href ? (
                  <Button
                    asChild
                    className="gap-2 bg-accent text-accent-foreground font-semibold hover:bg-accent/90 shadow-lg shadow-purple/20"
                  >
                    <RouterLink to={nextAction.href}>
                      {nextAction.ctaLabel}
                      <ArrowRight className="w-4 h-4" />
                    </RouterLink>
                  </Button>
                ) : nextAction.onClick ? (
                  <Button
                    onClick={nextAction.onClick}
                    disabled={nextAction.disabled}
                    className="gap-2 bg-accent text-accent-foreground font-semibold hover:bg-accent/90 shadow-lg shadow-purple/20"
                  >
                    {nextAction.ctaLabel}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="relative flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-accent/20 border border-emerald-400/40 flex items-center justify-center flex-shrink-0">
                <Rocket className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
                  You're all set
                </h3>
                <p className="text-sm text-muted-foreground">
                  Nothing's required from you right now — we'll be in touch with project updates.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Side info stack */}
        <div className="space-y-4">
          {/* Upcoming booking */}
          <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold mb-3">
              Upcoming Booking
            </p>
            {upcomingBooking ? (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple/15 border border-purple/30 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-purple" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {upcomingBooking.meeting_name || "Kickoff call"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatWhen(upcomingBooking.scheduled_at)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No call booked yet.</p>
            )}
          </div>

          {/* Live activity ticker */}
          <div className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 to-background/40 backdrop-blur-xl p-5 overflow-hidden">
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
            <p className="relative text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              Live Activity
            </p>
            {liveActivity.length === 0 ? (
              <p className="relative text-xs text-muted-foreground">Updates will appear here in real time.</p>
            ) : (
              <div className="relative space-y-2.5">
                {liveActivity.map((e) => (
                  <div key={e.id} className="flex items-center gap-2.5 text-sm">
                    <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse shrink-0", TONE_DOT[e.tone])} />
                    <span className="text-foreground/90 flex-1 truncate text-xs">{e.label}</span>
                    <span className="text-[10px] text-muted-foreground/70 font-mono shrink-0">{timeAgo(e.iso)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming deadline (optional) */}
          {upcomingDeadline && (
            <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl p-5">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold mb-3">
                Upcoming Deadline
              </p>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{upcomingDeadline.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatWhen(upcomingDeadline.due_at)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent activity timeline */}
      {activity.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold mb-4">
            Recent Activity
          </p>
          <ol className="space-y-3">
            {activity.slice(0, 6).map((e) => {
              const Icon = TONE_ICON[e.tone];
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-lg transition-colors hover:bg-background/40"
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", TONE_BG[e.tone])}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-foreground flex-1 truncate">{e.label}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0 font-mono">{timeAgo(e.iso)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
