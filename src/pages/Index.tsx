import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Zap, AlertTriangle, Clock, XCircle, UserX, ArrowRight, CheckCircle, Briefcase, ShieldCheck, CreditCard, HandCoins, FileCheck, Star, Lock, PlayCircle, MessageSquare, Repeat, Calendar, Users, Brain, Sparkles, PenLine, Inbox, Upload, RefreshCw, BarChart3, Send, LayoutDashboard } from "lucide-react";
import { AnimateIn } from "@/hooks/use-scroll-animation";
import LiveDemo from "@/components/landing/LiveDemo";
import { track } from "@/lib/landing-analytics";

const steps = [
  { number: "1", title: "Capture & qualify leads", description: "AI replies to inbound emails, scores deals, and surfaces who's worth your time — no manual triage." },
  { number: "2", title: "Close with proposals & contracts", description: "Generate a polished proposal, e-sign contract, and one-click Accept & Pay flow — all from one link." },
  { number: "3", title: "Run & grow accounts", description: "Onboarding, retainers, bookings, churn alerts and AI insights keep every client moving forward." },
];

const painPoints = [
  { icon: UserX, text: "Clients ghost after proposals" },
  { icon: Clock, text: "You chase invoices manually" },
  { icon: XCircle, text: "Deals fall through the cracks" },
  { icon: AlertTriangle, text: "Retainers churn without warning" },
];

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
];

const deliverables = [
  "Win more deals with AI-crafted proposals",
  "Get paid the moment a client accepts",
  "Lock in recurring revenue with retainers",
  "Spot churn and slipping deals before they happen",
];

const plans = [
  {
    name: "Free",
    price: "£0",
    period: "/month",
    description: "Try the platform — no card required",
    features: [
      "1 proposal per month",
      "Watermarked proposals",
      "No payment collection",
      "Limited AI insights",
    ],
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

export default function Index() {
  const [activeStep, setActiveStep] = useState(0);
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
    track("landing_view");
    const id = setInterval(() => setActiveStep((s) => (s + 1) % 3), 1600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowStickyCta(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Page-wide ambient background glow (very subtle, slow) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute top-[20%] -left-[10%] w-[60vw] h-[60vw] max-w-[820px] max-h-[820px] rounded-full blur-3xl animate-ambient-drift"
          style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.18), transparent 70%)" }}
        />
        <div
          className="absolute top-[55%] -right-[10%] w-[55vw] h-[55vw] max-w-[760px] max-h-[760px] rounded-full blur-3xl animate-ambient-drift-alt"
          style={{ background: "radial-gradient(closest-side, hsl(var(--purple) / 0.20), transparent 70%)", animationDelay: "-8s" }}
        />
        <div
          className="absolute bottom-[5%] left-[30%] w-[40vw] h-[40vw] max-w-[560px] max-h-[560px] rounded-full blur-3xl animate-ambient-drift"
          style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.12), transparent 70%)", animationDelay: "-14s" }}
        />
      </div>
      {/* Sticky premium nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/30">
        <div className="container flex items-center justify-between h-16 px-4 md:px-8">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-foreground tracking-tight">
              Close<span className="text-gradient-sync">Sync</span> <span className="text-foreground">AI</span>
            </span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-muted-foreground">by CloseSync</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#platform" className="hover:text-foreground transition-colors">Platform</a>
            <a href="#live-demo" className="hover:text-foreground transition-colors">Demo</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <Link to="/login" className="hover:text-foreground transition-colors">Login</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="md:hidden">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/signup" onClick={() => track("cta_click", { location: "nav" })}>
              <Button size="sm" className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:brightness-110 hover:shadow-[0_0_20px_hsl(var(--accent)/0.45)] transition-all h-9">Start free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Cinematic Hero */}
      <section className="relative min-h-[92vh] flex items-center pt-24 pb-16 md:pt-28 md:pb-20 px-4 overflow-hidden">
        {/* Layered animated background */}
        <div aria-hidden className="absolute inset-0 -z-10">
          <div
            className="absolute inset-0 opacity-80 animate-gradient-shift"
            style={{
              background:
                "linear-gradient(120deg, hsl(var(--background)) 0%, hsl(var(--accent) / 0.18) 35%, hsl(var(--purple) / 0.22) 65%, hsl(var(--background)) 100%)",
              backgroundSize: "200% 200%",
            }}
          />
          <div
            className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full blur-3xl opacity-60 animate-hero-glow"
            style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.55), transparent 70%)" }}
          />
          <div
            className="absolute bottom-[-160px] right-[-120px] w-[620px] h-[620px] rounded-full blur-3xl opacity-50 animate-hero-glow"
            style={{ background: "radial-gradient(closest-side, hsl(var(--purple) / 0.55), transparent 70%)", animationDelay: "2.5s" }}
          />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--foreground) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.5) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
            }}
          />
          <div className="absolute inset-0 bg-background/55" />
        </div>

        <div className="relative container grid lg:grid-cols-12 gap-10 lg:gap-6 items-center">
          {/* Left: copy */}
          <div className="lg:col-span-7 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs text-muted-foreground mb-6 animate-hero-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              The AI client workflow platform — replace 8 tools with one
            </div>
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground tracking-tight leading-[1.05] mb-6 animate-hero-fade-up"
              style={{ animationDelay: "0.1s" }}
            >
              Run your entire client business.
              <br />
              <span className="bg-gradient-to-r from-accent via-purple to-accent bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient-shift">
                From lead to retainer. On autopilot.
              </span>
            </h1>
            <p
              className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed animate-hero-fade-up"
              style={{ animationDelay: "0.2s" }}
            >
              Win proposals, e-sign contracts, collect payments, onboard new clients, run bookings and grow retainers — orchestrated by <span className="text-foreground font-semibold">one AI workflow</span> that runs while you sleep.
            </p>
            <div
              className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 animate-hero-fade-up"
              style={{ animationDelay: "0.3s" }}
            >
              <Link to="/signup" className="w-full sm:w-auto" onClick={() => track("cta_click", { location: "hero" })}>
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-accent to-purple text-accent-foreground bg-[length:200%_100%] hover:bg-[position:100%_0] transition-[background-position,transform,box-shadow] duration-500 hover:shadow-[0_0_36px_hsl(var(--accent)/0.55)] px-10 h-14 text-base gap-2 hover:scale-[1.03] hover:-translate-y-0.5">
                  Start free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#live-demo" className="w-full sm:w-auto" onClick={() => track("cta_click", { location: "hero_demo" })}>
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-10 h-14 text-base bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-300 gap-2">
                  <PlayCircle className="w-4 h-4" /> See 60-second demo
                </Button>
              </a>
            </div>
            <p
              className="text-xs text-muted-foreground mt-6 animate-hero-fade-up"
              style={{ animationDelay: "0.45s" }}
            >
              Built for freelancers, consultants, and agencies. ·{" "}
              <Link to="/sample" className="underline hover:text-foreground" onClick={() => track("sample_view")}>
                View static sample proposal
              </Link>
            </p>
          </div>

          {/* Right: layered glassmorphism mockups */}
          <div className="lg:col-span-5 relative h-[420px] sm:h-[480px] lg:h-[540px] hidden md:block">
            <div className="absolute inset-8 rounded-[2rem] bg-gradient-to-br from-accent/20 to-purple/20 blur-2xl" />

            {/* Subtle directional flow hint */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[12%] bottom-[12%] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-accent/40 to-transparent animate-flow-hint"
            />

            {/* Proposal mockup card */}
            <div
              className="absolute top-2 left-2 sm:left-4 w-[78%] rounded-2xl border border-white/10 bg-card/70 backdrop-blur-xl shadow-2xl shadow-accent/10 p-5 animate-float-slower animate-hero-fade-up"
              style={{ animationDelay: "0.35s", transform: "rotate(-3deg)" }}
            >
              <div className="absolute inset-0 rounded-2xl pointer-events-none animate-hero-card-glow" style={{ animationDelay: "0s" }} />
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple flex items-center justify-center">
                  <FileText className="w-4 h-4 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Proposal — Brand Refresh</p>
                  <p className="text-[10px] text-muted-foreground">Sent to acme.co · just now</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 rounded bg-foreground/10 w-[90%]" />
                <div className="h-2 rounded bg-foreground/10 w-[75%]" />
                <div className="h-2 rounded bg-foreground/10 w-[82%]" />
              </div>
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-[10px] text-muted-foreground">Total</span>
                <span className="text-sm font-bold text-foreground">£4,800.00</span>
              </div>
            </div>

            {/* Acceptance badge */}
            <div
              className="absolute top-[42%] left-[-12px] sm:left-2 rounded-2xl border border-accent/30 bg-card/85 backdrop-blur-xl shadow-2xl shadow-accent/20 px-5 py-4 sm:px-6 sm:py-5 flex items-center gap-4 animate-float-slow animate-hero-fade-up"
              style={{ animationDelay: "0.55s" }}
            >
              <div className="absolute inset-0 rounded-2xl pointer-events-none animate-hero-card-glow" style={{ animationDelay: "-6s" }} />
              <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                <FileCheck className="w-6 h-6 text-accent" />
              </div>
              <div className="pr-1">
                <p className="text-sm font-semibold text-foreground">Client accepted</p>
                <p className="text-[11px] text-muted-foreground">Sarah K. · 2 min ago</p>
                <span className="inline-block mt-1.5 text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">Signed & approved</span>
              </div>
            </div>

            {/* Payment confirmation */}
            <div
              className="absolute bottom-2 right-0 sm:right-2 w-[72%] rounded-2xl border border-white/10 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-xl shadow-2xl shadow-purple/20 p-5 animate-float-slow animate-hero-fade-up"
              style={{ animationDelay: "0.7s", transform: "rotate(2deg)" }}
            >
              <div className="absolute inset-0 rounded-2xl pointer-events-none animate-hero-card-glow" style={{ animationDelay: "-3s" }} />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple flex items-center justify-center shadow-lg shadow-accent/30">
                    <HandCoins className="w-4 h-4 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Payment received</p>
                    <p className="text-[10px] text-muted-foreground">Paddle · secure</p>
                  </div>
                </div>
                <CheckCircle className="w-4 h-4 text-accent" />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">Amount</p>
                  <p className="text-2xl font-bold bg-gradient-to-r from-accent to-purple bg-clip-text text-transparent">£4,800</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Status</p>
                  <span className="inline-block text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">Paid</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live 60-second product demo */}
      <LiveDemo />

      {/* Platform / Ecosystem */}
      <section id="platform" className="py-20 px-4 scroll-mt-20">
        <div className="container max-w-6xl">
          <AnimateIn className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/10 text-xs text-accent mb-4">
              <Sparkles className="w-3 h-3" /> One platform · twelve workflows
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything you need to <span className="text-shimmer-gradient">run client work</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Stop paying for — and switching between — Proposify, DocuSign, Stripe Invoicing, HubSpot, Calendly, Notion onboarding docs and a dozen Zapier hacks. CloseSync runs your entire client workflow from one place.
            </p>
          </AnimateIn>

          {/* Workflow chain */}
          <AnimateIn className="mb-10">
            <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-3 max-w-4xl mx-auto px-2">
              {["Lead", "Proposal", "Contract", "Payment", "Onboarding", "Retainer"].map((stage, i, arr) => (
                <div key={stage} className="flex items-center gap-2 sm:gap-3">
                  <span className="px-3 py-1.5 rounded-full border border-accent/30 bg-accent/5 text-xs sm:text-sm font-medium text-foreground backdrop-blur-sm">
                    {stage}
                  </span>
                  {i < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-accent/60 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </AnimateIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {platform.map((p, i) => (
              <AnimateIn key={p.title} delay={i * 60} direction="up">
                <div className="group relative h-full p-5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden hover:border-accent/40 hover:-translate-y-1 hover:shadow-[0_18px_50px_-15px_hsl(var(--accent)/0.45)] transition-all duration-300">
                  {/* Hover glow */}
                  <div
                    aria-hidden
                    className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(circle at top left, hsl(var(--accent) / 0.18), transparent 60%), radial-gradient(circle at bottom right, hsl(var(--purple) / 0.18), transparent 60%)",
                    }}
                  />
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/25 to-purple/25 border border-accent/30 flex items-center justify-center mb-4 group-hover:shadow-[0_0_22px_hsl(var(--accent)/0.55)] group-hover:scale-110 transition-all duration-300">
                      <p.icon className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1.5">{p.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Pain Section */}
      <section className="py-16 px-4">
        <AnimateIn className="container max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Tired of stitching together 8 tools to run client work?</h2>
          <p className="text-muted-foreground text-lg mb-12 max-w-xl mx-auto">
            The gap between "interested lead" and "happy retainer client" is where most agencies leak revenue.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {painPoints.map((p, i) => (
              <AnimateIn key={p.text} delay={i * 100} direction="up">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border text-left hover:border-destructive/40 hover:bg-card/80 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_hsl(var(--destructive)/0.35)] transition-all duration-300 group">
                  <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0 group-hover:bg-destructive/20 transition-colors">
                    <p.icon className="w-4 h-4 text-destructive" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{p.text}</span>
                </div>
              </AnimateIn>
            ))}
          </div>
        </AnimateIn>
      </section>

      {/* Money Moment Section */}
      <section className="py-16 px-4">
        <div className="container max-w-4xl">
          <AnimateIn className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Turn proposals into <span className="text-shimmer-gradient">paid, onboarded, retained clients</span></h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
              One AI workflow takes every client from <span className="text-foreground font-semibold">lead → proposal → contract → payment → onboarding → retainer</span> — without you stitching tools together.
            </p>
          </AnimateIn>

          <AnimateIn direction="scale">
            <div className="relative">
              <div className="absolute -inset-4 bg-purple/20 rounded-3xl blur-2xl pointer-events-none" />
              <div className="relative rounded-2xl border-2 border-accent/30 bg-card shadow-2xl shadow-accent/10 p-8 md:p-12">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4">
                  {[
                    { icon: MessageSquare, label: "Capture", sub: "AI replies & qualifies", color: "accent" },
                    { icon: FileCheck, label: "Close", sub: "Sign & pay in one link", color: "accent" },
                    { icon: Repeat, label: "Operate", sub: "Retain & grow", color: "accent" },
                  ].map((item, i, arr) => {
                    const isActive = activeStep === i;
                    return (
                    <div key={item.label} className="flex flex-col md:flex-row items-center gap-6 md:gap-4 flex-1">
                      <div className="flex flex-col items-center text-center flex-1">
                        <div
                          className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-purple/20 border flex items-center justify-center mb-3 transition-all duration-700 ease-out ${
                            isActive
                              ? "border-accent scale-110 shadow-[0_0_28px_hsl(var(--accent)/0.5)]"
                              : "border-accent/30 shadow-lg shadow-accent/10"
                          }`}
                        >
                          <item.icon className={`w-7 h-7 transition-colors duration-500 ${isActive ? "text-accent" : "text-accent/70"}`} />
                        </div>
                        <p className={`font-semibold transition-colors duration-500 ${isActive ? "text-foreground" : "text-foreground/80"}`}>{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
                      </div>
                      {i < arr.length - 1 && (
                        <ArrowRight
                          className={`w-6 h-6 rotate-90 md:rotate-0 flex-shrink-0 transition-all duration-500 ${
                            activeStep > i || (activeStep === 0 && i === arr.length - 1)
                              ? "text-accent"
                              : isActive
                              ? "text-accent animate-arrow-slide"
                              : "text-accent/40"
                          }`}
                        />
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 px-4">
        <div className="container max-w-4xl">
          <AnimateIn className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">How it works</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Three stages. One platform. Every client, end-to-end.
            </p>
          </AnimateIn>

          <div className="max-w-3xl mx-auto space-y-6 mb-16">
            {steps.map((s, i) => (
              <AnimateIn key={s.number} delay={i * 150} direction="left">
                <div className="flex gap-5 items-start group">
                  <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-lg font-bold flex-shrink-0 group-hover:scale-110 group-hover:shadow-[0_0_16px_hsl(var(--accent)/0.4)] transition-all duration-300">
                    {s.number}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>

          {/* What you get */}
          <AnimateIn className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-8">What you walk away with</h3>
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {deliverables.map((item, i) => (
                <AnimateIn key={item} delay={i * 100} direction="up">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border text-left hover:border-accent/40 hover:bg-card/80 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_hsl(var(--accent)/0.35)] transition-all duration-300 group">
                    <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium text-foreground">{item}</span>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Credibility */}
      <section className="py-16 px-4">
        <AnimateIn className="container max-w-2xl text-center">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <Briefcase className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Built for agencies and consultants who want to grow without the busywork</h2>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mx-auto">
            Stop juggling docs, e-sign apps, invoice tools and spreadsheets. Run every client — from inbound lead to renewed retainer — in one place.
          </p>
        </AnimateIn>
      </section>

      {/* Social Proof */}
      <section className="py-16 px-4">
        <div className="container max-w-3xl">
          <AnimateIn className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Trusted by agencies and consultants</h2>
            <p className="text-muted-foreground text-sm">Real outcomes from operators who replaced their stack with CloseSync.</p>
          </AnimateIn>
          <AnimateIn direction="scale">
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-8 md:p-10 text-center max-w-2xl mx-auto shadow-lg shadow-accent/5">
              <div className="flex items-center justify-center gap-1 mb-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>
              <blockquote className="text-lg md:text-xl text-foreground font-medium leading-relaxed mb-5">
                “We retired three tools. Proposals, contracts, payments, retainers — it’s all in here, and the AI actually moves deals forward.”
              </blockquote>
              <p className="text-sm text-muted-foreground">— Agency Founder</p>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 pb-24 px-4">
        <div className="container max-w-4xl">
          <AnimateIn className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-lg">No hidden fees. Cancel anytime.</p>
          </AnimateIn>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto items-stretch">
            {plans.map((plan, i) => (
              <AnimateIn key={plan.name} delay={i * 150} direction="up">
                <Card className={`border relative transition-all duration-500 flex flex-col h-full hover:-translate-y-1.5 ${plan.popular ? "border-accent border-2 shadow-2xl shadow-accent/30 ring-2 ring-accent/40 z-10 hover:shadow-[0_20px_60px_-15px_hsl(var(--accent)/0.55)] animate-border-glow" : "border-border shadow-none hover:border-accent/40 hover:shadow-[0_12px_40px_-15px_hsl(var(--accent)/0.25)]"}`}>
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-semibold tracking-wide shadow-lg shadow-accent/30 animate-soft-pulse">
                      Most popular
                    </div>
                  )}
                  <CardContent className="p-8 flex flex-col flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-1">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>
                    <div className="mb-2">
                      <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    {plan.valueLine ? (
                      <p className="text-xs text-accent mb-6 font-medium">{plan.valueLine}</p>
                    ) : (
                      <div className="mb-6" />
                    )}
                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                          <CheckCircle className="w-4 h-4 text-accent flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link to="/signup" className="mt-auto" onClick={() => track("cta_click", { location: plan.popular ? "pricing_pro" : "pricing_free" })}>
                      <Button className={`w-full h-12 text-base transition-all ${plan.popular ? "bg-gradient-to-r from-accent to-purple text-accent-foreground hover:brightness-110 hover:shadow-[0_0_24px_hsl(var(--accent)/0.5)] font-semibold" : "hover:brightness-110"}`} variant={plan.popular ? "default" : "outline"}>
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
                  </CardContent>
                </Card>
              </AnimateIn>
            ))}
          </div>
          <AnimateIn>
            <p className="text-center text-sm text-muted-foreground mt-12">
              One closed deal more than covers the year. Everything else is upside.
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <AnimateIn className="container max-w-3xl text-center">
          <div className="rounded-3xl border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-purple/5 p-10 md:p-16">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-purple flex items-center justify-center mx-auto mb-6 shadow-lg shadow-accent/30">
              <CreditCard className="w-7 h-7 text-accent-foreground" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Stop running your business in 8 tabs — <span className="text-shimmer-gradient">run it in CloseSync</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Join the agencies and consultants closing more, churning less, and shipping client work without the busywork.
            </p>
            <Link to="/signup" onClick={() => track("cta_click", { location: "final" })}>
              <Button size="lg" className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:brightness-110 hover:shadow-[0_0_24px_hsl(var(--accent)/0.5)] px-10 h-14 text-base gap-2 transition-all hover:scale-105">
                Start free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </AnimateIn>
      </section>

      {/* Trust badges */}
      <section className="px-4 pb-10">
        <AnimateIn className="container max-w-4xl">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10 py-6 px-6 rounded-xl border border-border/60 bg-card/40 text-sm text-muted-foreground transition-all duration-500 hover:border-accent/30 hover:shadow-[0_10px_40px_-20px_hsl(var(--accent)/0.4)]">
            <span className="group flex items-center gap-2 transition-all duration-300 hover:text-foreground hover:-translate-y-0.5"><ShieldCheck className="w-4 h-4 text-accent transition-all duration-300 group-hover:drop-shadow-[0_0_6px_hsl(var(--accent)/0.7)]" /> Secure payments via Paddle</span>
            <span className="hidden md:inline-block w-px h-4 bg-border" />
            <span className="group flex items-center gap-2 transition-all duration-300 hover:text-foreground hover:-translate-y-0.5"><Brain className="w-4 h-4 text-accent transition-all duration-300 group-hover:drop-shadow-[0_0_6px_hsl(var(--accent)/0.7)]" /> AI-powered closing &amp; ops</span>
            <span className="hidden md:inline-block w-px h-4 bg-border" />
            <span className="group flex items-center gap-2 transition-all duration-300 hover:text-foreground hover:-translate-y-0.5"><Zap className="w-4 h-4 text-accent transition-all duration-300 group-hover:drop-shadow-[0_0_6px_hsl(var(--accent)/0.7)]" /> Built for agencies &amp; consultants</span>
          </div>
        </AnimateIn>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Close<span className="text-gradient-sync">Sync</span> <span className="text-foreground">AI</span>
          </span>
          <p>© 2026 CloseSync. All rights reserved.</p>
        </div>
      </footer>

      {/* Sticky bottom CTA */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-2xl transition-all duration-500 ease-out ${
          showStickyCta
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-6 pointer-events-none"
        }`}
        style={{ willChange: "opacity, transform" }}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-3 rounded-full border border-accent/30 bg-card/90 backdrop-blur-md shadow-2xl shadow-accent/20">
          <p className="text-sm text-foreground font-medium hidden sm:block">Ready to close more &amp; operate less?</p>
          <p className="text-sm text-foreground font-medium sm:hidden">Close &amp; operate</p>
          <Link to="/signup" onClick={() => track("cta_click", { location: "sticky" })}>
            <Button size="sm" className="bg-gradient-to-r from-accent to-purple text-accent-foreground bg-[length:200%_100%] hover:bg-[position:100%_0] transition-[background-position,transform,box-shadow] duration-500 hover:shadow-[0_0_20px_hsl(var(--accent)/0.5)] h-9 px-5 gap-2 hover:-translate-y-0.5">
              Start free
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
