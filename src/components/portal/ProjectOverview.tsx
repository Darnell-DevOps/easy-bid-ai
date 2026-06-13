import { Link as RouterLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  Rocket,
  Sparkles,
  Clock,
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
}

const TONE_BG: Record<ActivityEvent["tone"], string> = {
  blue: "bg-blue-500/15 text-blue-400",
  purple: "bg-purple/15 text-purple",
  emerald: "bg-emerald-500/15 text-emerald-400",
  amber: "bg-amber-500/15 text-amber-400",
  rose: "bg-rose-500/15 text-rose-400",
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
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
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
}: Props) {
  const firstName = clientName.split(" ")[0] || clientName;
  const NextIcon = nextAction?.icon || Sparkles;

  return (
    <section className="space-y-4">
      {/* Welcome header */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-purple/10 via-card to-accent/5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-purple font-semibold mb-1.5">
              Project Hub
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1 truncate">
              Welcome back, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground truncate">{projectName}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-purple/30 bg-purple/10 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-purple animate-pulse" />
            <span className="text-xs font-semibold text-foreground">{stageLabel}</span>
          </div>
        </div>
      </div>

      {/* Next action + side info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Next action card */}
        <div className="lg:col-span-2 rounded-xl border border-purple/30 bg-gradient-to-br from-purple/10 via-card to-transparent p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-purple font-semibold mb-3">
            Next Action
          </p>
          {nextAction ? (
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-purple/20 flex items-center justify-center flex-shrink-0">
                <NextIcon className="w-5 h-5 text-purple" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
                  {nextAction.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">{nextAction.description}</p>
                {nextAction.href ? (
                  <Button
                    asChild
                    className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold hover:brightness-110"
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
                    className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold hover:brightness-110"
                  >
                    {nextAction.ctaLabel}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
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
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">
              Upcoming Booking
            </p>
            {upcomingBooking ? (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple/15 flex items-center justify-center flex-shrink-0">
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
              <p className="text-xs text-muted-foreground">
                No call booked yet.
              </p>
            )}
          </div>

          {/* Upcoming deadline */}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">
              Upcoming Deadline
            </p>
            {upcomingDeadline ? (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {upcomingDeadline.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatWhen(upcomingDeadline.due_at)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No upcoming deadlines.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity timeline */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-4">
          Recent Activity
        </p>
        {activity.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Activity from your project will show up here.
          </p>
        ) : (
          <ol className="space-y-3">
            {activity.slice(0, 6).map((e) => {
              const Icon = TONE_ICON[e.tone];
              return (
                <li key={e.id} className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", TONE_BG[e.tone])}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-foreground flex-1 truncate">{e.label}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(e.iso)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
