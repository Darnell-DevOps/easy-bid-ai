import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle,
  FileCheck,
  FileText,
  HandCoins,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";
import { track } from "@/lib/landing-analytics";

/**
 * Self-running 60-second product demo embedded on the landing page.
 * Three stages loop continuously: Compose → Accept → Paid.
 * Pure presentation — no backend calls, no auth.
 * Respects prefers-reduced-motion (renders a static three-frame view).
 */

const STAGE_LENGTH_MS = 6000; // 6s per stage * 3 stages = 18s/loop
const TICK_MS = 50;

type Stage = 0 | 1 | 2;

const STAGES = [
  { label: "Compose", sub: "Generate a polished proposal", icon: FileText },
  { label: "Accept", sub: "Client signs in one click", icon: FileCheck },
  { label: "Paid", sub: "Money lands in your account", icon: HandCoins },
] as const;

const TYPED_LINES = [
  "Brand refresh — Acme Co.",
  "Logo + identity system",
  "3 web page concepts",
  "Total: £4,800",
];

function useTypewriter(active: boolean, lines: string[], stageProgress: number): string[] {
  // Full text revealed across stage 0 (progress 0 → 1)
  if (!active) return lines;
  const totalChars = lines.reduce((acc, l) => acc + l.length + 1, 0);
  const visible = Math.floor(totalChars * Math.min(1, stageProgress * 1.1));
  const out: string[] = [];
  let remaining = visible;
  for (const line of lines) {
    if (remaining <= 0) {
      out.push("");
    } else if (remaining >= line.length) {
      out.push(line);
      remaining -= line.length + 1;
    } else {
      out.push(line.slice(0, remaining));
      remaining = 0;
    }
  }
  return out;
}

export default function LiveDemo() {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const startedRef = useRef(false);
  const completedLoopsRef = useRef(0);

  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  useEffect(() => {
    if (reducedMotion || !playing) return;
    const id = setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + TICK_MS;
        const cycle = STAGE_LENGTH_MS * 3;
        if (next >= cycle) {
          completedLoopsRef.current += 1;
          if (completedLoopsRef.current === 1) track("demo_complete");
          return 0;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, reducedMotion]);

  // Track first start
  useEffect(() => {
    if (!reducedMotion && playing && !startedRef.current) {
      startedRef.current = true;
      track("demo_start");
    }
  }, [playing, reducedMotion]);

  const stage: Stage = reducedMotion
    ? 2
    : (Math.floor(elapsedMs / STAGE_LENGTH_MS) as Stage);
  const stageProgress = reducedMotion ? 1 : (elapsedMs % STAGE_LENGTH_MS) / STAGE_LENGTH_MS;
  const cycleProgress = reducedMotion ? 1 : elapsedMs / (STAGE_LENGTH_MS * 3);

  const typed = useTypewriter(stage === 0, TYPED_LINES, stageProgress);

  // Stage 2 amount counter ticks 0 → 4800
  const amount = stage === 2 ? Math.floor(4800 * Math.min(1, stageProgress * 1.4)) : stage > 2 ? 4800 : 0;

  return (
    <section id="live-demo" className="py-16 px-4 scroll-mt-20">
      <div className="container max-w-5xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/10 text-xs text-accent mb-4">
            <Sparkles className="w-3 h-3" /> Live demo
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            See it work in 60 seconds
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Watch a proposal go from <span className="text-foreground font-semibold">composed</span> to{" "}
            <span className="text-foreground font-semibold">paid</span> — no signup needed.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 md:p-8 shadow-2xl shadow-accent/5">
          {/* Stage indicator */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              {STAGES.map((s, i) => {
                const active = i === stage;
                const done = i < stage;
                const Icon = s.icon;
                return (
                  <div key={s.label} className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                        active
                          ? "border-accent bg-accent/15 text-accent shadow-[0_0_18px_hsl(var(--accent)/0.45)]"
                          : done
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                            : "border-border bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="hidden sm:block min-w-0">
                      <p className={`text-xs font-semibold truncate ${active ? "text-foreground" : "text-muted-foreground"}`}>
                        {s.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{s.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="w-9 h-9 rounded-full border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:border-accent/40 flex items-center justify-center flex-shrink-0"
              aria-label={playing ? "Pause demo" : "Play demo"}
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 rounded-full bg-muted overflow-hidden mb-6">
            <div
              className="h-full bg-gradient-to-r from-accent to-purple"
              style={{ width: `${Math.min(100, cycleProgress * 100)}%` }}
            />
          </div>

          {/* Stage content */}
          <div className="relative min-h-[280px] sm:min-h-[300px]">
            {/* Stage 0 — Compose */}
            <div
              className={`absolute inset-0 transition-opacity duration-500 ${stage === 0 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              <div className="rounded-xl border border-border bg-background/60 p-5 max-w-xl mx-auto">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/60">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple flex items-center justify-center">
                    <FileText className="w-4 h-4 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">New proposal</p>
                    <p className="text-[10px] text-muted-foreground">Drafting…</p>
                  </div>
                </div>
                <div className="space-y-2.5 font-mono text-sm">
                  {typed.map((line, i) => (
                    <p
                      key={i}
                      className={`text-foreground/90 min-h-[1.25rem] ${
                        i === typed.length - 1 || (i < typed.length - 1 && typed[i + 1] === "")
                          ? "after:content-['▍'] after:text-accent after:animate-pulse"
                          : ""
                      }`}
                    >
                      {line || "\u00A0"}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Stage 1 — Accept */}
            <div
              className={`absolute inset-0 transition-opacity duration-500 ${stage === 1 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <div
                  className="rounded-xl border border-border bg-background/60 p-5"
                  style={{ transform: stage === 1 ? "rotate(-1.5deg)" : "rotate(0deg)", transition: "transform 600ms ease-out" }}
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Proposal</p>
                  <p className="text-sm font-semibold text-foreground mb-3">Brand refresh — Acme Co.</p>
                  <div className="space-y-1.5">
                    <div className="h-2 rounded bg-foreground/10 w-[90%]" />
                    <div className="h-2 rounded bg-foreground/10 w-[75%]" />
                    <div className="h-2 rounded bg-foreground/10 w-[82%]" />
                  </div>
                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Total</span>
                    <span className="text-sm font-bold text-foreground">£4,800</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                      <FileCheck className="w-4 h-4 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Sarah opened it</p>
                      <p className="text-[11px] text-muted-foreground">Acme Co. · just now</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    className={`w-full h-12 rounded-xl bg-gradient-to-r from-accent to-purple text-accent-foreground text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-accent/30 ${
                      stage === 1 && stageProgress > 0.4 ? "ring-2 ring-accent/60 ring-offset-2 ring-offset-card" : ""
                    }`}
                    style={{
                      transform: stage === 1 && stageProgress > 0.4 ? "scale(1.02)" : "scale(1)",
                      transition: "transform 400ms ease-out",
                    }}
                  >
                    <CheckCircle className="w-4 h-4" /> Accept &amp; Pay
                  </button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    One click. No PDFs. No DocuSign.
                  </p>
                </div>
              </div>
            </div>

            {/* Stage 2 — Paid */}
            <div
              className={`absolute inset-0 transition-opacity duration-500 ${stage === 2 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              <div className="max-w-md mx-auto">
                <div className="relative rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 to-purple/10 p-6 text-center overflow-hidden">
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at center, hsl(var(--accent) / ${0.25 * stageProgress}), transparent 70%)`,
                    }}
                  />
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-purple flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/40">
                      <HandCoins className="w-7 h-7 text-accent-foreground" />
                    </div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Payment received</p>
                    <p className="text-5xl font-bold bg-gradient-to-r from-accent to-purple bg-clip-text text-transparent tabular-nums">
                      £{amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">From Acme Co. · via Paddle</p>
                    {stageProgress > 0.7 && (
                      <Link
                        to="/signup"
                        onClick={() => track("cta_click", { location: "demo" })}
                        className="inline-flex items-center gap-2 mt-5 px-4 h-10 rounded-full bg-foreground text-background text-sm font-semibold hover:scale-[1.02] transition-transform"
                      >
                        Start your free trial <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
