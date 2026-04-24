import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Zap, AlertTriangle, Clock, XCircle, UserX, ArrowRight, CheckCircle, Briefcase, ShieldCheck, CreditCard, HandCoins, FileCheck, Star, Lock } from "lucide-react";
import { AnimateIn } from "@/hooks/use-scroll-animation";

const steps = [
  { number: "1", title: "Send your proposal", description: "Generate a polished proposal in seconds and share it with one link." },
  { number: "2", title: "Client accepts it", description: "Your client reviews and accepts the proposal in one click — no email back-and-forth." },
  { number: "3", title: "Client pays instantly", description: "Payment is collected automatically the moment they accept. No chasing invoices." },
];

const painPoints = [
  { icon: UserX, text: "Clients ghost after proposals" },
  { icon: Clock, text: "You chase invoices manually" },
  { icon: XCircle, text: "Deals fall through the cracks" },
  { icon: AlertTriangle, text: "Payments are slow or missed" },
];

const deliverables = [
  "A polished, client-ready proposal",
  "One-click Accept & Pay flow",
  "Automatic invoice & receipt",
  "Money in your account, not chased",
];

const plans = [
  {
    name: "Free",
    price: "£0",
    period: "/month",
    description: "Try it out — no card required",
    features: [
      "1 proposal per month",
      "Watermarked proposals",
      "No payment collection",
      "No policy generator",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "£29",
    period: "/month",
    description: "Get paid instantly. Turn leads into clients automatically.",
    features: [
      "Accept & Pay flow",
      "Payment collection (Paddle)",
      "Unlimited proposals",
      "AI lead response",
      "Policies auto-attach",
      "No watermark",
    ],
    cta: "Get Paid Faster",
    popular: true,
    valueLine: "Close just one extra client and it pays for itself.",
    trustItems: ["7-day free trial", "Cancel anytime", "Secure payments via Paddle"],
  },
];

export default function Index() {
  const [activeStep, setActiveStep] = useState(0);
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
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
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16 px-4 md:px-8">
          <span className="text-xl font-semibold text-foreground tracking-tight">
            Close<span className="text-gradient-sync">Sync</span> <span className="text-foreground">AI</span>
          </span>
          <span className="text-xs text-muted-foreground ml-2">by StriveSync</span>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:brightness-110 h-9">Start closing deals</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative py-16 md:py-24 px-4 overflow-hidden">
        {/* Animated gradient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 w-[720px] h-[420px] rounded-full blur-3xl opacity-60 animate-hero-glow"
          style={{
            background:
              "radial-gradient(closest-side, hsl(var(--accent) / 0.45), hsl(var(--purple) / 0.30) 55%, transparent 75%)",
          }}
        />
        <div className="relative container max-w-3xl text-center" style={{ animation: "hero-fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) both" }}>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight leading-tight mb-6">
            Close deals faster and <span className="bg-gradient-to-r from-accent to-purple bg-clip-text text-transparent font-extrabold">get paid instantly</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed" style={{ animation: "hero-fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both" }}>
            Send proposals your clients can accept and pay in one simple flow — <span className="text-foreground font-semibold">no chasing, no back-and-forth.</span>
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4" style={{ animation: "hero-fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both" }}>
            <Link to="/signup">
              <Button size="lg" className="bg-gradient-to-r from-accent to-purple text-accent-foreground bg-[length:200%_100%] hover:bg-[position:100%_0] transition-[background-position,transform,box-shadow] duration-500 hover:shadow-[0_0_28px_hsl(var(--accent)/0.5)] px-10 h-14 text-base gap-2 hover:scale-[1.03] hover:-translate-y-0.5">
                Get Paid Faster
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/sample">
              <Button size="lg" variant="outline" className="px-10 h-14 text-base hover:scale-[1.03] hover:-translate-y-0.5 hover:border-accent/50 transition-all duration-300">
                View Sample Proposal
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-center gap-5 mt-3" style={{ animation: "hero-fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both" }}>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Zap className="w-3 h-3 text-accent" />Fast</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="w-3 h-3 text-accent" />Secure payments</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="w-3 h-3 text-accent" />Professional</span>
          </div>
        </div>
      </section>

      {/* Pain Section */}
      <section className="py-16 px-4">
        <AnimateIn className="container max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Tired of chasing clients for money?</h2>
          <p className="text-muted-foreground text-lg mb-12 max-w-xl mx-auto">
            The gap between "yes" and getting paid is where most freelancers lose revenue.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {painPoints.map((p, i) => (
              <AnimateIn key={p.text} delay={i * 100} direction="up">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border text-left hover:border-destructive/40 hover:bg-card/80 transition-all duration-300 group">
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
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Turn proposals into <span className="bg-gradient-to-r from-accent to-purple bg-clip-text text-transparent">paid deals</span></h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
              Your client gets one link.<br />
              They review, accept, and pay — <span className="text-foreground font-semibold">instantly.</span>
            </p>
          </AnimateIn>

          <AnimateIn direction="scale">
            <div className="relative">
              <div className="absolute -inset-4 bg-purple/20 rounded-3xl blur-2xl pointer-events-none" />
              <div className="relative rounded-2xl border-2 border-accent/30 bg-card shadow-2xl shadow-accent/10 p-8 md:p-12">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4">
                  {[
                    { icon: FileText, label: "Proposal", sub: "Sent in minutes", color: "accent" },
                    { icon: FileCheck, label: "Accept", sub: "One click", color: "accent" },
                    { icon: HandCoins, label: "Payment", sub: "Money in", color: "accent" },
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
                              ? "text-accent translate-x-0"
                              : isActive
                              ? "text-accent md:translate-x-1"
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
              Three steps from proposal to paid.
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
            <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-8">What you get</h3>
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {deliverables.map((item, i) => (
                <AnimateIn key={item} delay={i * 100} direction="up">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border text-left hover:border-accent/30 hover:bg-card/80 transition-all duration-300 group">
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
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Built for freelancers and agencies that want to get paid</h2>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mx-auto">
            Stop sending proposals into the void. Send proposals that close themselves.
          </p>
        </AnimateIn>
      </section>

      {/* Social Proof */}
      <section className="py-16 px-4">
        <div className="container max-w-3xl">
          <AnimateIn className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Trusted by freelancers and agencies</h2>
            <p className="text-muted-foreground text-sm">Real outcomes from people who stopped chasing invoices.</p>
          </AnimateIn>
          <AnimateIn direction="scale">
            <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-8 md:p-10 text-center max-w-2xl mx-auto shadow-lg shadow-accent/5">
              <div className="flex items-center justify-center gap-1 mb-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>
              <blockquote className="text-lg md:text-xl text-foreground font-medium leading-relaxed mb-5">
                “This helped me stop chasing invoices and close clients faster.”
              </blockquote>
              <p className="text-sm text-muted-foreground">— Freelance Consultant</p>
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
                <Card className={`border relative transition-all duration-300 flex flex-col h-full hover:translate-y-[-4px] ${plan.popular ? "border-accent border-2 shadow-2xl shadow-accent/30 ring-2 ring-accent/40 z-10" : "border-border shadow-none hover:border-muted-foreground/30"}`}>
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-semibold tracking-wide shadow-lg shadow-accent/30">
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
                    <Link to="/signup" className="mt-auto">
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
              Close just one extra client and it pays for itself.
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
              Stop chasing clients — <span className="bg-gradient-to-r from-accent to-purple bg-clip-text text-transparent">start closing deals</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Join freelancers and agencies who turned their proposals into a payment machine.
            </p>
            <Link to="/signup">
              <Button size="lg" className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:brightness-110 hover:shadow-[0_0_24px_hsl(var(--accent)/0.5)] px-10 h-14 text-base gap-2 transition-all hover:scale-105">
                Start closing deals
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </AnimateIn>
      </section>

      {/* Trust badges */}
      <section className="px-4 pb-10">
        <AnimateIn className="container max-w-4xl">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10 py-6 px-6 rounded-xl border border-border/60 bg-card/40 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-accent" /> Secure payments via Paddle</span>
            <span className="hidden md:inline-block w-px h-4 bg-border" />
            <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-accent" /> Professional client-ready proposals</span>
            <span className="hidden md:inline-block w-px h-4 bg-border" />
            <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-accent" /> Built for agencies & freelancers</span>
          </div>
        </AnimateIn>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Close<span className="text-gradient-sync">Sync</span> <span className="text-foreground">AI</span>
          </span>
          <p>© 2026 StriveSync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
