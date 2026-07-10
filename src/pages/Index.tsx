import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Zap,
  ArrowRight,
  CheckCircle,
  ShieldCheck,
  HandCoins,
  Star,
  Lock,
  MessageSquare,
  Repeat,
  Calendar,
  Users,
  Brain,
  PenLine,
  Inbox,
  Upload,
  RefreshCw,
  BarChart3,
  Send,
  LayoutDashboard,
  Terminal,
} from "lucide-react";
import { AnimateIn } from "@/hooks/use-scroll-animation";

import AIAssistant from "@/components/landing/AIAssistant";
import RetainersSection from "@/components/landing/RetainersSection";
import ClientPortalShowcase from "@/components/landing/ClientPortalShowcase";
import { track } from "@/lib/landing-analytics";

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const platform = [
  { icon: FileText, title: "AI Proposals", desc: "Polished, on-brand proposals generated in seconds." },
  { icon: PenLine, title: "Contracts & E-signatures", desc: "Send, track and legally bind agreements with one link." },
  { icon: HandCoins, title: "Payment Collection", desc: "One-click Accept & Pay — money lands without invoicing." },
  { icon: Repeat, title: "Retainers & Subscriptions", desc: "Lock in recurring revenue with automated renewals." },
  { icon: Inbox, title: "AI Lead Replies", desc: "Auto-respond to inbound emails and qualify leads instantly." },
  { icon: Users, title: "Client Portal", desc: "A branded space where clients review, sign and pay." },
  { icon: Calendar, title: "Booking & Calendar", desc: "Public booking pages, reminders and host notifications." },
  { icon: LayoutDashboard, title: "Client Onboarding", desc: "Smart intake forms that handle the back-and-forth for you." },
  { icon: Send, title: "Automated Follow-Ups", desc: "AI nudges deals forward when clients go quiet." },
  { icon: Upload, title: "File Uploads", desc: "Collect deliverables and assets without third-party tools." },
  { icon: RefreshCw, title: "Recurring Billing", desc: "Subscriptions, dunning recovery and renewal automation." },
  { icon: BarChart3, title: "Progress Tracking", desc: "Live dashboards for deals, revenue and time saved." },
  { icon: Star, title: "Review Collection", desc: "Auto-request reviews after kickoff and turn happy clients into social proof." },
];

const journey = [
  { icon: MessageSquare, title: "Lead", sub: "Inbound enquiry", desc: "AI replies, qualifies and scores the lead the moment it lands." },
  { icon: FileText, title: "Proposal", sub: "Sent in minutes", desc: "Generate a polished, on-brand proposal from a short brief." },
  { icon: PenLine, title: "Contract", sub: "E-signed", desc: "Send and legally bind your terms — no DocuSign required." },
  { icon: HandCoins, title: "Payment", sub: "Collected", desc: "One-click Accept & Pay. Money lands the moment they sign." },
  { icon: LayoutDashboard, title: "Onboarding", sub: "Auto-kickoff", desc: "Smart intake forms collect everything you need without back-and-forth." },
  { icon: Repeat, title: "Retainer", sub: "Recurring revenue", desc: "Subscriptions, renewals and dunning recovery handled for you." },
  { icon: Brain, title: "Ongoing Client", sub: "Managed by AI", desc: "Bookings, follow-ups, churn alerts and weekly briefings on autopilot." },
];


const terminalLog = [
  { t: "09:41:02", text: "inbound lead received — sarah@acme.co", tag: "LEAD" },
  { t: "09:41:04", text: "ai reply sent · lead scored 87/100", tag: "AI" },
  { t: "09:52:18", text: "proposal generated — brand refresh · £4,800", tag: "DOC" },
  { t: "11:03:45", text: "contract e-signed by client", tag: "SIGN" },
  { t: "11:03:51", text: "payment collected · £4,800.00", tag: "PAID" },
  { t: "11:04:00", text: "onboarding form dispatched", tag: "FLOW" },
  { t: "11:04:02", text: "retainer scheduled · £1,200/mo", tag: "REV" },
];

const marqueeItems = [
  "AI PROPOSALS",
  "E-SIGNATURES",
  "ONE-CLICK PAYMENTS",
  "RETAINERS",
  "LEAD REPLIES",
  "CLIENT PORTAL",
  "BOOKINGS",
  "ONBOARDING",
  "FOLLOW-UPS",
  "RECURRING BILLING",
  "CHURN ALERTS",
  "REVIEW COLLECTION",
];

const plans = [
  {
    name: "Free",
    price: "£0",
    period: "/month",
    description: "Try the platform — no card required",
    features: ["1 proposal per month", "Watermarked proposals", "No payment collection", "Limited AI insights"],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "£29",
    period: "/month",
    description: "The full platform to close clients and run accounts.",
    features: [
      "Unlimited proposals, contracts & invoices",
      "One-click Accept & Pay (Paddle)",
      "Retainers, bookings & client portal",
      "Inbound email AI & lead assistant",
      "AI coach: deal scores, churn risk, briefings",
      "No watermark · priority support",
    ],
    cta: "Start Closing & Operating",
    popular: true,
    valueLine: "One extra closed client more than pays for it.",
    trustItems: ["7-day free trial", "Cancel anytime", "Secure payments via Paddle"],
  },
];

/* ------------------------------------------------------------------ */
/* Scroll hooks (page-local)                                           */
/* ------------------------------------------------------------------ */

function useScrollY() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return scrollY;
}

/** Progress (0 → 1) through a tall scroll-pinned container. */
function usePinnedProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;
        if (scrollable <= 0) return;
        setProgress(Math.min(1, Math.max(0, -rect.top / scrollable)));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return { ref, progress };
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function MonoTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
      {children}
    </span>
  );
}

function HeroTerminal() {
  const [visibleLines, setVisibleLines] = useState(1);
  useEffect(() => {
    const id = setInterval(() => {
      setVisibleLines((v) => (v >= terminalLog.length ? 1 : v + 1));
    }, 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative rounded-xl border border-border bg-card/80 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/40">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/50">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-[11px] text-muted-foreground tracking-wide">closesync — workflow.log</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-accent">live</span>
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        </div>
      </div>
      {/* Log body */}
      <div className="p-4 sm:p-5 font-mono text-[11px] sm:text-xs leading-relaxed min-h-[280px]">
        {terminalLog.slice(0, visibleLines).map((line, i) => (
          <div key={`${line.t}-${i}`} className="lp-log-in flex items-start gap-3 py-1">
            <span className="text-muted-foreground/60 shrink-0">{line.t}</span>
            <span
              className={`shrink-0 w-12 text-center rounded px-1 py-px text-[9px] font-semibold tracking-wider ${
                line.tag === "PAID"
                  ? "bg-success/15 text-success"
                  : line.tag === "AI"
                    ? "bg-purple/15 text-purple"
                    : "bg-accent/10 text-accent"
              }`}
            >
              {line.tag}
            </span>
            <span className="text-foreground/85">{line.text}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 py-1 text-muted-foreground">
          <span className="text-accent">→</span>
          <span className="lp-caret inline-block w-2 h-3.5 bg-accent/80" />
        </div>
      </div>
      {/* Bottom status strip */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-secondary/30 font-mono text-[10px] text-muted-foreground">
        <span>PIPELINE: ACTIVE</span>
        <span className="text-accent">£4,800 COLLECTED</span>
        <span>0 MANUAL STEPS</span>
      </div>
    </div>
  );
}

function CapabilityMarquee() {
  const items = [...marqueeItems, ...marqueeItems];
  return (
    <div className="lp-marquee relative border-y border-border/60 bg-secondary/20 py-4 overflow-hidden" aria-hidden>
      <div className="lp-marquee-track items-center gap-0">
        {items.map((item, i) => (
          <span key={`${item}-${i}`} className="flex items-center shrink-0">
            <span className="font-mono text-xs tracking-[0.25em] text-muted-foreground px-6">{item}</span>
            <span className="text-accent/50 text-xs">✦</span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}

/** Scroll-pinned client journey — the immersive centerpiece. */
function ScrollJourney() {
  const { ref, progress } = usePinnedProgress();
  const active = Math.min(journey.length - 1, Math.floor(progress * journey.length));
  const stage = journey[active];
  const Icon = stage.icon;

  return (
    <section id="workflow" ref={ref} className="relative scroll-mt-20" style={{ height: `${journey.length * 60 + 100}vh` }}>
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden px-4">
        {/* Backdrop */}
        <div aria-hidden className="absolute inset-0 -z-10 lp-dot-grid opacity-[0.35]" style={{ maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)" }} />

        <div className="container max-w-6xl">
          <div className="text-center mb-10 md:mb-14">
            <MonoTag>The full client journey</MonoTag>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight mt-4 text-balance">
              From first hello to <span className="text-gradient-sync">lifetime client</span>
            </h2>
          </div>

          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 lg:gap-16 items-center max-w-5xl mx-auto">
            {/* Left: giant stage index */}
            <div className="relative text-center lg:text-left">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
                Stage {String(active + 1).padStart(2, "0")} / {String(journey.length).padStart(2, "0")}
              </p>
              <p className="text-7xl md:text-8xl lg:text-9xl font-bold tracking-tighter text-foreground/[0.08] select-none leading-none" aria-hidden>
                {String(active + 1).padStart(2, "0")}
              </p>
              <div className="-mt-8 md:-mt-12">
                <h3 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">{stage.title}</h3>
                <p className="font-mono text-xs text-accent mt-2 uppercase tracking-widest">{stage.sub}</p>
                <p className="text-muted-foreground mt-4 max-w-sm mx-auto lg:mx-0 leading-relaxed">{stage.desc}</p>
              </div>
            </div>

            {/* Right: stage rail */}
            <div className="relative hidden sm:block">
              <div aria-hidden className="absolute left-[23px] top-4 bottom-4 w-px bg-border">
                <div
                  className="absolute top-0 inset-x-0 bg-accent transition-[height] duration-300 ease-out"
                  style={{ height: `${((active + 1) / journey.length) * 100}%` }}
                />
              </div>
              <div className="space-y-1.5">
                {journey.map((s, i) => {
                  const SIcon = s.icon;
                  const isActive = i === active;
                  const isDone = i < active;
                  return (
                    <div
                      key={s.title}
                      className={`relative flex items-center gap-4 rounded-lg py-2.5 pl-1 pr-4 transition-all duration-300 ${
                        isActive ? "bg-accent/[0.06]" : ""
                      }`}
                    >
                      <div
                        className={`relative z-10 w-[46px] h-[46px] rounded-lg border flex items-center justify-center shrink-0 transition-all duration-300 ${
                          isActive
                            ? "border-accent bg-accent text-accent-foreground"
                            : isDone
                              ? "border-accent/40 bg-card text-accent"
                              : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        <SIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold transition-colors duration-300 ${isActive ? "text-foreground" : isDone ? "text-foreground/70" : "text-muted-foreground"}`}>
                          {s.title}
                        </p>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 truncate">{s.sub}</p>
                      </div>
                      {isDone && <CheckCircle className="w-3.5 h-3.5 text-accent ml-auto shrink-0" />}
                      {isActive && (
                        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-accent shrink-0 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-accent animate-pulse" /> live
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile: compact progress dots */}
            <div className="flex sm:hidden items-center justify-center gap-2">
              {journey.map((s, i) => (
                <span
                  key={s.title}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-6 bg-accent" : i < active ? "w-1.5 bg-accent/50" : "w-1.5 bg-border"}`}
                />
              ))}
            </div>
          </div>

          {/* Scroll hint */}
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60 mt-10 md:mt-14">
            Keep scrolling to advance the pipeline
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Index() {
  const scrollY = useScrollY();
  const [docProgress, setDocProgress] = useState(0);
  const showStickyCta = scrollY > 700;

  useEffect(() => {
    track("landing_view");
  }, []);

  useEffect(() => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    setDocProgress(total > 0 ? Math.min(1, scrollY / total) : 0);
  }, [scrollY]);

  return (
    <div className="min-h-screen bg-background relative overflow-x-clip">
      {/* Nav with scroll progress */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-16 px-4 md:px-8">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-semibold text-foreground tracking-tight">
              Close<span className="text-gradient-sync">Sync</span> AI
            </span>
            <span className="hidden lg:inline font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
              SYS.ONLINE
            </span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#platform" className="hover:text-foreground transition-colors">Platform</a>
            <a href="#ai" className="hover:text-foreground transition-colors">AI</a>
            
            <a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <Link to="/login" className="hover:text-foreground transition-colors">Login</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="md:hidden">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/signup" onClick={() => track("cta_click", { location: "nav" })}>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors h-9">
                Start free
              </Button>
            </Link>
          </div>
        </div>
        {/* Scroll progress bar */}
        <div aria-hidden className="absolute bottom-0 left-0 h-px w-full bg-transparent">
          <div className="h-full bg-accent origin-left transition-transform duration-150 ease-out" style={{ transform: `scaleX(${docProgress})` }} />
        </div>
      </nav>

      {/* ============ Hero ============ */}
      <section className="relative min-h-screen flex items-center pt-28 pb-20 px-4 overflow-hidden">
        {/* Grid + beam backdrop with subtle parallax */}
        <div aria-hidden className="absolute inset-0 -z-10" style={{ transform: `translateY(${scrollY * 0.12}px)` }}>
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--foreground) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.5) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "radial-gradient(ellipse 70% 60% at 50% 35%, black 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 35%, black 30%, transparent 75%)",
            }}
          />
          <div
            className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[560px] rounded-full blur-3xl opacity-40"
            style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.22), transparent 70%)" }}
          />
          {/* Scanning beam */}
          <div className="lp-beam absolute left-1/2 -translate-x-1/2 w-[56rem] max-w-full h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
        </div>

        <div className="relative container grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Copy */}
          <div className="lg:col-span-6 text-center lg:text-left">
            <div className="animate-hero-fade-up mb-6">
              <MonoTag>The AI client workflow platform</MonoTag>
            </div>
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground tracking-tighter leading-[0.98] mb-6 animate-hero-fade-up text-balance"
              style={{ animationDelay: "0.1s" }}
            >
              Run your entire client business.
              <br />
              <span className="text-gradient-sync">On autopilot.</span>
            </h1>
            <p
              className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-9 leading-relaxed animate-hero-fade-up"
              style={{ animationDelay: "0.2s" }}
            >
              Win proposals, e-sign contracts, collect payments, onboard clients and grow retainers — orchestrated by{" "}
              <span className="text-foreground font-semibold">one AI workflow</span> that runs while you sleep.
            </p>
            <div
              className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 animate-hero-fade-up"
              style={{ animationDelay: "0.3s" }}
            >
              <Link to="/signup" className="w-full sm:w-auto" onClick={() => track("cta_click", { location: "hero" })}>
                <Button size="lg" className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-9 h-14 text-base gap-2">
                  Start free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#platform" className="w-full sm:w-auto" onClick={() => track("cta_click", { location: "hero_platform" })}>
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-9 h-14 text-base bg-secondary/40 border-border hover:bg-secondary hover:border-accent/40 transition-colors gap-2">
                  <ArrowRight className="w-4 h-4" /> Explore the platform
                </Button>
              </a>
            </div>
            <div
              className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground animate-hero-fade-up"
              style={{ animationDelay: "0.45s" }}
            >
              <span className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-accent" /> Replaces 8 tools</span>
              <span className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-accent" /> 12 workflows</span>
              <Link to="/sample" className="underline underline-offset-4 hover:text-foreground transition-colors normal-case tracking-normal text-xs" onClick={() => track("sample_view")}>
                View sample proposal
              </Link>
            </div>
          </div>

          {/* Terminal */}
          <div className="lg:col-span-6 animate-hero-fade-up" style={{ animationDelay: "0.35s" }}>
            <HeroTerminal />
          </div>
        </div>

        {/* Scroll indicator */}
        <div aria-hidden className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 text-muted-foreground/60">
          <span className="font-mono text-[9px] uppercase tracking-[0.3em]">Scroll</span>
          <span className="w-px h-8 bg-gradient-to-b from-muted-foreground/60 to-transparent" />
        </div>
      </section>

      {/* ============ Capability marquee ============ */}
      <CapabilityMarquee />

      

      {/* ============ Platform grid ============ */}
      <section id="platform" className="py-24 px-4 scroll-mt-20">
        <div className="container max-w-6xl">
          <AnimateIn className="mb-14">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <MonoTag>Platform / 13 workflows</MonoTag>
                <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight mt-4 text-balance">
                  Everything you need to
                  <br className="hidden md:block" /> run client work
                </h2>
              </div>
              <p className="text-muted-foreground max-w-sm leading-relaxed md:text-right">
                Stop switching between Proposify, DocuSign, Stripe, Calendly and a dozen Zapier hacks. One platform runs it all.
              </p>
            </div>
          </AnimateIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-border/60">
            {platform.map((p, i) => (
              <AnimateIn key={p.title} delay={(i % 3) * 80}>
                <div className="group relative h-full p-6 border-b border-r border-border/60 hover:bg-accent/[0.04] transition-colors duration-300">
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center group-hover:border-accent/40 group-hover:text-accent transition-colors duration-300 text-muted-foreground">
                      <p.icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground/50 tracking-widest">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1.5">{p.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              </AnimateIn>
            ))}
            {/* Filler CTA cell */}
            <AnimateIn delay={160}>
              <Link
                to="/signup"
                onClick={() => track("cta_click", { location: "platform_grid" })}
                className="group flex h-full flex-col justify-between p-6 border-b border-r border-border/60 bg-accent/[0.05] hover:bg-accent/[0.09] transition-colors duration-300"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">Start now</span>
                <div className="flex items-center justify-between mt-8">
                  <span className="text-sm font-semibold text-foreground">Try every workflow free</span>
                  <ArrowRight className="w-4 h-4 text-accent group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </AnimateIn>
          </div>
        </div>
      </section>
      {/* ============ Scroll-pinned journey ============ */}
      <ScrollJourney />

      {/* ============ AI Assistant (kept animated section) ============ */}
      <AIAssistant />

      {/* ============ Retainers (kept animated section) ============ */}
      <RetainersSection />

      {/* ============ Client Portal (kept animated section) ============ */}
      <ClientPortalShowcase />

      {/* ============ Social proof ============ */}
      <section className="py-24 px-4">
        <div className="container max-w-3xl">
          <AnimateIn direction="scale">
            <figure className="relative rounded-xl border border-border bg-card/50 p-8 md:p-12 text-center">
              <span aria-hidden className="absolute top-6 left-8 font-mono text-6xl text-accent/15 leading-none select-none">"</span>
              <div className="flex items-center justify-center gap-1 mb-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>
              <blockquote className="text-xl md:text-2xl text-foreground font-medium leading-relaxed text-balance mb-6">
                We retired three tools. Proposals, contracts, payments, retainers — it&apos;s all in here, and the AI actually moves deals forward.
              </blockquote>
              <figcaption className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                — Agency Founder
              </figcaption>
            </figure>
          </AnimateIn>
        </div>
      </section>

      {/* ============ Pricing ============ */}
      <section id="pricing" className="py-24 px-4 scroll-mt-20">
        <div className="container max-w-4xl">
          <AnimateIn className="text-center mb-14">
            <MonoTag>Pricing</MonoTag>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight mt-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-lg mt-3">No hidden fees. Cancel anytime.</p>
          </AnimateIn>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto items-stretch">
            {plans.map((plan, i) => (
              <AnimateIn key={plan.name} delay={i * 120} direction="up">
                <div
                  className={`relative flex flex-col h-full rounded-xl border p-8 transition-colors duration-300 ${
                    plan.popular ? "border-accent bg-accent/[0.05]" : "border-border bg-card/50 hover:border-accent/30"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-accent-foreground font-mono text-[10px] font-semibold uppercase tracking-[0.15em]">
                      Most popular
                    </div>
                  )}
                  <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{plan.name}</p>
                  <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>
                  <div className="mb-2">
                    <span className="text-5xl font-bold text-foreground tracking-tight">{plan.price}</span>
                    <span className="text-muted-foreground font-mono text-sm">{plan.period}</span>
                  </div>
                  {plan.valueLine ? (
                    <p className="text-xs text-accent mb-6 font-medium">{plan.valueLine}</p>
                  ) : (
                    <div className="mb-6" />
                  )}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                        <CheckCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup" className="mt-auto" onClick={() => track("cta_click", { location: plan.popular ? "pricing_pro" : "pricing_free" })}>
                    <Button
                      className={`w-full h-12 text-base transition-colors ${plan.popular ? "bg-accent text-accent-foreground hover:bg-accent/90 font-semibold" : ""}`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                  {plan.trustItems && (
                    <ul className="mt-5 space-y-2">
                      {plan.trustItems.map((t) => (
                        <li key={t} className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                          <Lock className="w-3 h-3 text-accent" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </AnimateIn>
            ))}
          </div>
          <AnimateIn>
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mt-12">
              One closed deal covers the year — everything else is upside
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* ============ Final CTA ============ */}
      <section className="py-28 px-4 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 lp-dot-grid opacity-25" style={{ maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)" }} />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[420px] rounded-full blur-3xl opacity-40"
            style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.25), transparent 70%)" }}
          />
        </div>
        <AnimateIn className="container max-w-3xl text-center">
          <MonoTag>Ready when you are</MonoTag>
          <h2 className="text-4xl md:text-6xl font-bold text-foreground tracking-tighter mt-6 mb-6 text-balance">
            Stop running your business in 8 tabs.
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Join the agencies and consultants closing more, churning less, and shipping client work without the busywork.
          </p>
          <Link to="/signup" onClick={() => track("cta_click", { location: "final" })}>
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 px-12 h-14 text-base gap-2 transition-colors">
              Start free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-12 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-accent" /> Secure payments via Paddle</span>
            <span className="flex items-center gap-2"><Brain className="w-3.5 h-3.5 text-accent" /> AI-powered closing &amp; ops</span>
            <span className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-accent" /> Built for agencies</span>
          </div>
        </AnimateIn>
      </section>

      {/* ============ Footer ============ */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Close<span className="text-gradient-sync">Sync</span> AI
          </span>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em]">© 2026 CloseSync · All rights reserved</p>
        </div>
      </footer>

      {/* ============ Sticky CTA ============ */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-2xl transition-all duration-500 ease-out ${
          showStickyCta ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-6 pointer-events-none"
        }`}
        style={{ willChange: "opacity, transform" }}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-3 rounded-full border border-border bg-card/90 backdrop-blur-md shadow-2xl shadow-black/40">
          <p className="text-sm text-foreground font-medium hidden sm:block">Ready to close more &amp; operate less?</p>
          <p className="text-sm text-foreground font-medium sm:hidden">Close &amp; operate</p>
          <Link to="/signup" onClick={() => track("cta_click", { location: "sticky" })}>
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors h-9 px-5 gap-2">
              Start free
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
