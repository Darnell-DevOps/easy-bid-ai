import { useEffect, useState } from "react";
import { AnimateIn } from "@/hooks/use-scroll-animation";
import { Sparkles, FileText, Inbox, PenLine, LayoutDashboard, Send, Brain, CheckCircle, Loader2 } from "lucide-react";

const capabilities = [
  {
    icon: FileText,
    title: "AI Proposal Generation",
    desc: "Turn a one-line brief into a polished, on-brand proposal in seconds.",
  },
  {
    icon: Inbox,
    title: "AI Lead Response Drafting",
    desc: "Auto-replies to inbound leads with the right tone, qualifying questions and next step.",
  },
  {
    icon: PenLine,
    title: "AI Contract Generation",
    desc: "Generates legally-sound contracts pre-filled from the accepted proposal.",
  },
  {
    icon: LayoutDashboard,
    title: "AI Onboarding Assistance",
    desc: "Builds smart intake forms and chases missing info so you don’t have to.",
  },
  {
    icon: Send,
    title: "AI Follow-Up Reminders",
    desc: "Detects silence, drafts the nudge, and sends it at the right moment.",
  },
];

type FeedItem = {
  icon: typeof Sparkles;
  text: string;
  meta: string;
  tone: "ai" | "done" | "live";
};

const feedScript: FeedItem[] = [
  { icon: Inbox, text: "Drafted reply to Sarah at Acme Co.", meta: "Inbound lead · qualified", tone: "ai" },
  { icon: FileText, text: "Generated proposal — Brand refresh", meta: "£4,800 · 3 deliverables", tone: "ai" },
  { icon: PenLine, text: "Contract sent for e-signature", meta: "Awaiting signature · 2 min", tone: "live" },
  { icon: CheckCircle, text: "Payment received from Acme Co.", meta: "£4,800 · via Paddle", tone: "done" },
  { icon: LayoutDashboard, text: "Onboarding form sent to client", meta: "Smart intake · 7 fields", tone: "ai" },
  { icon: Send, text: "Follow-up nudge scheduled", meta: "James went quiet · sending 9am", tone: "ai" },
  { icon: Brain, text: "Churn risk flagged on Globex retainer", meta: "Last login · 14 days ago", tone: "live" },
];

function useTypewriter(text: string, key: number, speed = 22) {
  const [out, setOut] = useState("");
  useEffect(() => {
    setOut("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, key, speed]);
  return out;
}

export default function AIAssistant() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2400);
    return () => clearInterval(id);
  }, []);

  // Rolling window of 4 visible items with newest on top
  const visible: FeedItem[] = Array.from({ length: 4 }).map((_, i) => {
    const idx = (tick - i + feedScript.length * 10) % feedScript.length;
    return feedScript[idx];
  });
  const latest = visible[0];
  const typed = useTypewriter(latest.text, tick, 22);

  return (
    <section id="ai" className="py-24 px-4 relative overflow-hidden scroll-mt-20">
      <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(closest-side, hsl(var(--purple) / 0.45), transparent 70%)" }}
        />
      </div>

      <div className="container max-w-6xl">
        <AnimateIn className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/10 text-xs text-accent mb-4">
            <Sparkles className="w-3 h-3 animate-pulse" /> Built-in AI · always working
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            AI that helps you <span className="text-shimmer-gradient">close clients faster</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            CloseSync’s AI doesn’t just sit in a chat box. It writes your proposals, drafts your replies, generates your contracts, runs your onboarding and follows up while you sleep.
          </p>
        </AnimateIn>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-start">
          {/* Left — capability cards */}
          <div className="space-y-3">
            {capabilities.map((c, i) => (
              <AnimateIn key={c.title} delay={i * 60} direction="left">
                <div className="group relative p-5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden hover:border-accent/40 hover:bg-white/[0.05] hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-15px_hsl(var(--accent)/0.4)] transition-all duration-300">
                  <div
                    aria-hidden
                    className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(circle at top left, hsl(var(--accent) / 0.18), transparent 60%)",
                    }}
                  />
                  <div className="relative flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center flex-shrink-0 group-hover:border-accent/50 transition-colors">
                      <c.icon className="w-5 h-5 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground mb-1">{c.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
                    </div>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>

          {/* Right — live AI activity feed */}
          <AnimateIn direction="right">
            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-accent/10 blur-3xl opacity-60 pointer-events-none animate-soft-pulse" />
              <div className="relative rounded-3xl border border-white/10 bg-card/70 backdrop-blur-xl shadow-2xl shadow-accent/20 overflow-hidden">
                {/* Window chrome */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
                      <Brain className="w-3.5 h-3.5 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">CloseSync AI · activity</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Working live across your accounts
                      </p>
                    </div>
                  </div>
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                </div>

                {/* Feed */}
                <div className="p-5 space-y-2.5 min-h-[340px]">
                  {visible.map((item, i) => {
                    const isLatest = i === 0;
                    const Icon = item.icon;
                    const toneRing =
                      item.tone === "done"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : item.tone === "live"
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-purple/40 bg-purple/10 text-purple";
                    const toneLabel =
                      item.tone === "done" ? "Done" : item.tone === "live" ? "Live" : "AI";
                    return (
                      <div
                        key={`${tick}-${i}`}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-500 ${
                          isLatest
                            ? "border-accent/40 bg-accent/[0.06] shadow-[0_10px_30px_-15px_hsl(var(--accent)/0.45)]"
                            : "border-white/5 bg-white/[0.02]"
                        }`}
                        style={{
                          opacity: 1 - i * 0.18,
                          transform: `translateY(${i === 0 ? "0" : "0"})`,
                          animation: isLatest ? "hero-fade-up 0.5s ease-out both" : undefined,
                        }}
                      >
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${toneRing}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                              {toneLabel}
                            </p>
                            <span className="text-[10px] text-muted-foreground/60">·</span>
                            <p className="text-[10px] text-muted-foreground">just now</p>
                          </div>
                          <p className="text-sm font-medium text-foreground leading-snug">
                            {isLatest ? (
                              <>
                                {typed}
                                <span className="inline-block w-1.5 h-3.5 -mb-0.5 ml-0.5 bg-accent animate-pulse" />
                              </>
                            ) : (
                              item.text
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.meta}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer composer */}
                <div className="px-5 py-3 border-t border-white/10 flex items-center gap-3 bg-white/[0.02]">
                  <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <p className="text-xs text-muted-foreground truncate flex-1">
                    Ask CloseSync to draft, send, follow up, or recover…
                  </p>
                  <span className="text-[10px] text-muted-foreground/70 hidden sm:block">⌘K</span>
                </div>
              </div>
            </div>
          </AnimateIn>
        </div>
      </div>
    </section>
  );
}
