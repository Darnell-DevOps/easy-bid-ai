import { useEffect, useState } from "react";
import { CheckCircle2, FileText, PenLine, CreditCard, ClipboardList, CalendarCheck, Sparkles, Circle, Loader2, ShieldCheck } from "lucide-react";
import { AnimateIn } from "@/hooks/use-scroll-animation";

type StageState = "done" | "active" | "pending";

const stages = [
  {
    icon: FileText,
    title: "Proposal accepted",
    detail: "Brand identity refresh — £8,400",
    meta: "Accepted by Maya at Acme Co.",
  },
  {
    icon: PenLine,
    title: "Contract signed",
    detail: "MSA + SOW countersigned",
    meta: "E-signature verified · Audit trail saved",
  },
  {
    icon: CreditCard,
    title: "Payment completed",
    detail: "£4,200 deposit · Card ending 4242",
    meta: "Settled instantly via CloseSync Pay",
  },
  {
    icon: ClipboardList,
    title: "Onboarding submitted",
    detail: "Brand assets, access & goals collected",
    meta: "12 of 12 fields complete",
  },
  {
    icon: CalendarCheck,
    title: "Kickoff booked",
    detail: "Tue 14 May · 10:00 BST · Google Meet",
    meta: "Calendar invite sent to all attendees",
  },
];

export default function ClientPortalShowcase() {
  const [activeIndex, setActiveIndex] = useState(2);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % (stages.length + 1));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const getState = (i: number): StageState => {
    if (i < activeIndex) return "done";
    if (i === activeIndex) return "active";
    return "pending";
  };

  const completedCount = Math.min(activeIndex, stages.length);
  const progress = (completedCount / stages.length) * 100;

  return (
    <section id="portal" className="relative py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-60">
        <div className="absolute top-1/3 left-1/4 w-[480px] h-[480px] rounded-full bg-accent/10 blur-[120px] animate-soft-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[420px] h-[420px] rounded-full bg-purple/10 blur-[120px] animate-soft-pulse" style={{ animationDelay: "1.5s" }} />
      </div>

      <div className="container mx-auto px-4 max-w-7xl">
        <AnimateIn className="text-center mb-14 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card/60 border border-border/60 backdrop-blur-xl mb-5">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Client Portal</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            A portal your clients <span className="text-gradient-sync">actually trust</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            One branded workspace where every proposal, signature, payment and milestone updates in real time — no more chasing email threads.
          </p>
        </AnimateIn>

        <div className="grid lg:grid-cols-5 gap-6 items-start">
          {/* Portal mock */}
          <AnimateIn className="lg:col-span-3">
            <div className="relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl overflow-hidden shadow-[0_30px_80px_-20px_hsl(var(--accent)/0.25)]">
              {/* window chrome */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border/60 bg-background/40">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                </div>
                <div className="ml-3 flex-1 text-xs text-muted-foreground font-mono truncate">
                  portal.closesync.io / acme-co / project-orbit
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </div>
              </div>

              {/* header */}
              <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 border-b border-border/40">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Project Orbit · Acme Co.</div>
                  <h3 className="text-xl font-semibold">Welcome back, Maya 👋</h3>
                  <p className="text-sm text-muted-foreground mt-1">Your project is on track. Here's what's happened so far.</p>
                </div>
                <div className="hidden sm:flex flex-col items-end">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Progress</div>
                  <div className="text-2xl font-bold tabular-nums">{Math.round(progress)}%</div>
                </div>
              </div>

              {/* progress bar */}
              <div className="px-6 pt-4">
                <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* stages */}
              <div className="p-6 space-y-3">
                {stages.map((stage, i) => {
                  const state = getState(i);
                  const Icon = stage.icon;
                  return (
                    <div
                      key={stage.title}
                      className={`group relative flex items-start gap-4 p-4 rounded-xl border transition-all duration-500 ${
                        state === "active"
                          ? "border-accent/60 bg-accent/5"
                          : state === "done"
                          ? "border-border/50 bg-background/30"
                          : "border-border/30 bg-background/10 opacity-60"
                      }`}
                    >
                      {/* connector line */}
                      {i < stages.length - 1 && (
                        <span
                          className={`absolute left-[27px] top-[52px] bottom-[-14px] w-px transition-colors duration-500 ${
                            state === "done" ? "bg-gradient-to-b from-accent/60 to-accent/10" : "bg-border/40"
                          }`}
                        />
                      )}

                      {/* status icon */}
                      <div
                        className={`relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-500 ${
                          state === "done"
                            ? "bg-gradient-to-br from-emerald-500/20 to-accent/20 border-emerald-400/40"
                            : state === "active"
                            ? "bg-accent/15 border-accent/60"
                            : "bg-muted/20 border-border/40"
                        }`}
                      >
                        {state === "done" ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-scale-in" />
                        ) : state === "active" ? (
                          <Loader2 className="w-4 h-4 text-accent animate-spin" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground" />
                        )}
                        {state === "active" && (
                          <span className="absolute inset-0 rounded-full border border-accent/50 animate-ping" />
                        )}
                      </div>

                      {/* content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-3.5 h-3.5 ${state === "pending" ? "text-muted-foreground" : "text-foreground/80"}`} />
                            <span className="font-medium text-sm">{stage.title}</span>
                          </div>
                          <span
                            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              state === "done"
                                ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/5"
                                : state === "active"
                                ? "border-accent/50 text-accent bg-accent/5"
                                : "border-border/40 text-muted-foreground"
                            }`}
                          >
                            {state === "done" ? "Complete" : state === "active" ? "In progress" : "Pending"}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{stage.detail}</div>
                        <div className="text-[11px] text-muted-foreground/70 mt-1.5 font-mono">{stage.meta}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </AnimateIn>

          {/* side rail */}
          <div className="lg:col-span-2 space-y-4">
            <AnimateIn delay={120}>
              <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <h3 className="font-semibold">Why clients love it</h3>
                </div>
                <ul className="space-y-3 text-sm">
                  {[
                    "One branded link replaces 12 email threads",
                    "Sign, pay and onboard without leaving the portal",
                    "Live status — no 'where are we?' calls",
                    "Audit trail and receipts always at hand",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </AnimateIn>

            <AnimateIn delay={200}>
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 to-background/40 backdrop-blur-xl p-6 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-accent/10 blur-3xl" />
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Live activity</div>
                <div className="space-y-3">
                  {[
                    { who: "Maya", what: "viewed the contract", when: "just now", tone: "accent" },
                    { who: "CloseSync", what: "auto-sent welcome email", when: "2m ago", tone: "purple" },
                    { who: "Stripe", what: "confirmed deposit £4,200", when: "5m ago", tone: "emerald" },
                  ].map((a, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span
                        className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                          a.tone === "accent" ? "bg-accent" : a.tone === "purple" ? "bg-purple" : "bg-emerald-400"
                        }`}
                      />
                      <span className="font-medium">{a.who}</span>
                      <span className="text-muted-foreground">{a.what}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground/70 font-mono">{a.when}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimateIn>

            <AnimateIn delay={280}>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Avg. close time", value: "2.4d" },
                  { label: "Sign rate", value: "94%" },
                  { label: "On-time pay", value: "98%" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 text-center">
                    <div className="text-xl font-bold text-gradient-sync">{s.value}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </AnimateIn>
          </div>
        </div>
      </div>
    </section>
  );
}
