import { memo, useEffect, useState } from "react";
import { AnimateIn } from "@/hooks/use-scroll-animation";
import { Repeat, TrendingUp, Sparkles, RefreshCw, CreditCard, AlertCircle, CheckCircle2, ArrowUpRight, Wallet } from "lucide-react";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Heights as percentages — premium "up and to the right"
const baseHeights = [22, 28, 32, 38, 44, 50, 58, 64, 70, 76, 84, 92];

const subs = [
  { name: "Acme Co.", plan: "Brand retainer · monthly", amount: "£1,800", state: "active", since: "since Jan 2026" },
  { name: "Globex", plan: "Growth retainer · monthly", amount: "£2,400", state: "active", since: "since Mar 2026" },
  { name: "Initech", plan: "Care plan · quarterly", amount: "£900", state: "recovering", since: "card retry · attempt 2" },
  { name: "Umbrella Studios", plan: "Strategy retainer · monthly", amount: "£3,200", state: "renewed", since: "auto-renewed today" },
];

const features = [
  { icon: RefreshCw, label: "Auto-charge subscriptions" },
  { icon: CreditCard, label: "Recurring billing" },
  { icon: AlertCircle, label: "Smart payment recovery" },
  { icon: TrendingUp, label: "MRR tracking" },
  { icon: Wallet, label: "Subscription management" },
  { icon: Repeat, label: "Renewal automation" },
];

function RetainersSection({ embedded = false }: { embedded?: boolean } = {}) {
  const [animateBars, setAnimateBars] = useState(false);
  const [mrr, setMrr] = useState(0);

  useEffect(() => {
    // Trigger bar animation shortly after mount
    const t = setTimeout(() => setAnimateBars(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Counter from 0 → 24,800
    const target = 24800;
    const duration = 1400;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setMrr(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section id="retainers" className={`${embedded ? "py-10 md:py-14" : "py-24"} px-4 relative overflow-hidden scroll-mt-20 w-full`}>
      <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
        <div
          className="absolute top-1/4 -right-24 w-[520px] h-[520px] rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.45), transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 -left-24 w-[460px] h-[460px] rounded-full blur-3xl opacity-25"
          style={{ background: "radial-gradient(closest-side, hsl(var(--purple) / 0.45), transparent 70%)" }}
        />
      </div>

      <div className="container max-w-6xl">
        <AnimateIn className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/10 text-xs text-accent mb-4">
            <Sparkles className="w-3 h-3" /> Recurring revenue, on autopilot
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Turn one-time projects into <span className="text-shimmer-gradient">recurring revenue</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Convert delivered projects into monthly retainers that auto-charge, auto-renew and recover failed payments — without you lifting a finger.
          </p>
        </AnimateIn>

        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          {/* MRR chart card */}
          <AnimateIn direction="left" className="lg:col-span-3">
            <div className="relative h-full">
              <div className="absolute -inset-4 rounded-3xl bg-accent/10 blur-3xl opacity-60 pointer-events-none" />
              <div className="relative rounded-3xl border border-white/10 bg-card/70 backdrop-blur-xl p-6 md:p-8 shadow-2xl shadow-accent/15 h-full">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                      Monthly recurring revenue
                    </p>
                    <p className="text-4xl md:text-5xl font-bold text-foreground tabular-nums">
                      £{mrr.toLocaleString()}
                    </p>
                    <p className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 mt-2">
                      <ArrowUpRight className="w-3.5 h-3.5" /> +38% this quarter
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-accent" />
                  </div>
                </div>

                {/* Animated bar chart */}
                <div className="relative h-44 md:h-56">
                  {/* Gridlines */}
                  <div aria-hidden className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="border-t border-white/5" />
                    ))}
                  </div>
                  {/* Trend line glow */}
                  <svg
                    aria-hidden
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                  >
                    <defs>
                      <linearGradient id="trend-line" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.0" />
                        <stop offset="50%" stopColor="hsl(var(--accent))" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="hsl(var(--purple))" stopOpacity="0.9" />
                      </linearGradient>
                    </defs>
                    <polyline
                      fill="none"
                      stroke="url(#trend-line)"
                      strokeWidth="0.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        filter: "drop-shadow(0 0 4px hsl(var(--accent) / 0.55))",
                      }}
                      points={baseHeights
                        .map((h, i) => `${(i / (baseHeights.length - 1)) * 100},${100 - h}`)
                        .join(" ")}
                    />
                  </svg>
                  {/* Bars */}
                  <div className="absolute inset-0 flex items-end gap-1.5 md:gap-2">
                    {baseHeights.map((h, i) => (
                      <div key={months[i]} className="flex-1 flex flex-col items-center justify-end h-full">
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-accent/60 to-purple/60 border border-accent/30 transition-all ease-out"
                          style={{
                            height: animateBars ? `${h}%` : "0%",
                            transitionDuration: "900ms",
                            transitionDelay: `${i * 70}ms`,
                            boxShadow: "0 0 12px -2px hsl(var(--accent) / 0.45)",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 px-0.5">
                  {months.filter((_, i) => i % 2 === 0).map((m) => (
                    <span key={m} className="text-[10px] text-muted-foreground/70">{m}</span>
                  ))}
                </div>

                {/* Stat strip */}
                <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/10">
                  {[
                    { label: "Active subs", value: "24" },
                    { label: "Renewal rate", value: "96%" },
                    { label: "Recovered", value: "£3.2k" },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-lg font-bold text-foreground">{s.value}</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimateIn>

          {/* Subscription cards */}
          <AnimateIn direction="right" className="lg:col-span-2">
            <div className="space-y-3 h-full">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 px-1">
                Live subscriptions
              </p>
              {subs.map((s, i) => {
                const stateMeta =
                  s.state === "renewed"
                    ? { label: "Renewed", icon: CheckCircle2, ring: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" }
                    : s.state === "recovering"
                    ? { label: "Recovering", icon: RefreshCw, ring: "border-amber-500/40 bg-amber-500/10 text-amber-400" }
                    : { label: "Active", icon: CheckCircle2, ring: "border-accent/40 bg-accent/10 text-accent" };
                const StateIcon = stateMeta.icon;
                return (
                  <div
                    key={s.name}
                    className="group relative p-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-15px_hsl(var(--accent)/0.4)] transition-all duration-300"
                    style={{ animation: `hero-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both`, animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{s.plan}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1.5 truncate">{s.since}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <p className="text-base font-bold text-foreground tabular-nums">{s.amount}<span className="text-[10px] text-muted-foreground font-normal">/mo</span></p>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stateMeta.ring}`}>
                          <StateIcon className={`w-2.5 h-2.5 ${s.state === "recovering" ? "animate-spin" : ""}`} />
                          {stateMeta.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </AnimateIn>
        </div>

        {/* Feature pills */}
        <AnimateIn className="mt-12">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-4xl mx-auto">
            {features.map((f) => (
              <span
                key={f.label}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-sm text-xs text-foreground hover:border-accent/40 hover:bg-accent/[0.06] transition-all"
              >
                <f.icon className="w-3.5 h-3.5 text-accent" />
                {f.label}
              </span>
            ))}
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}

export default memo(RetainersSection);
