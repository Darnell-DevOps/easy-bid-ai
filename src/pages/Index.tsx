import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Zap, Download, AlertTriangle, Clock, XCircle, UserX, ArrowRight, CheckCircle, Briefcase } from "lucide-react";

const steps = [
  { number: "1", title: "Enter your client details", description: "Fill in a simple form with the client name, service type, budget, and timeline." },
  { number: "2", title: "AI generates your proposal and invoice instantly", description: "Our AI creates a polished proposal, pricing breakdown, and invoice in seconds." },
  { number: "3", title: "Download and send to your client", description: "Export as PDF, review, and send. Done in under two minutes." },
];

const painPoints = [
  { icon: Clock, text: "Takes too long" },
  { icon: AlertTriangle, text: "Slows down your response time" },
  { icon: XCircle, text: "Makes you look less professional" },
  { icon: UserX, text: "Can cost you clients" },
];

const deliverables = [
  "A polished, client-ready proposal",
  "A clear pricing breakdown",
  "A professional invoice",
  "Ready to send in minutes",
];

const plans = [
  {
    name: "Free",
    price: "£0",
    period: "/month",
    description: "Get started with no commitment",
    features: ["3 proposals per month", "AI proposal generation", "Watermark on exports"],
    cta: "Get Started Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "£9",
    period: "/month",
    description: "For freelancers and agencies closing more deals",
    features: ["Unlimited proposals", "No watermark", "PDF export", "Invoice export", "Custom branding", "Proposal history"],
    cta: "Upgrade to Pro",
    popular: true,
  },
];

export default function Index() {
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
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">Sign up</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 md:py-32 px-4">
        <div className="container max-w-3xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight leading-tight mb-6">
            Turn lead details into a professional proposal and invoice in under <span className="bg-gradient-to-r from-accent to-purple bg-clip-text text-transparent">2 minutes</span>.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Stop losing clients because of slow proposals. Generate a professional proposal and invoice in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:opacity-90 px-8 h-12 text-base gap-2">
                Start Free – No Credit Card
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/proposal/example">
              <Button size="lg" variant="outline" className="px-8 h-12 text-base">
                See Example Proposal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pain Section */}
      <section className="py-20 px-4 bg-card border-y border-border">
        <div className="container max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Still writing proposals manually?</h2>
          <p className="text-muted-foreground text-lg mb-12 max-w-xl mx-auto">
            Manual proposals are holding your business back.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {painPoints.map((p) => (
              <div key={p.text} className="flex items-center gap-3 p-4 rounded-lg bg-background border border-border text-left">
                <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <p.icon className="w-4 h-4 text-destructive" />
                </div>
                <span className="text-sm font-medium text-foreground">{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">How it works</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Three simple steps from lead info to a ready-to-send proposal.
            </p>
          </div>
          <div className="space-y-6">
            {steps.map((s) => (
              <div key={s.number} className="flex gap-5 items-start">
                <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-lg font-bold flex-shrink-0">
                  {s.number}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="py-20 px-4 bg-card border-y border-border">
        <div className="container max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12">What you get</h2>
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {deliverables.map((item) => (
              <div key={item} className="flex items-center gap-3 p-4 rounded-lg bg-background border border-border text-left">
                <CheckCircle className="w-5 h-5 text-accent flex-shrink-0" />
                <span className="text-sm font-medium text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Credibility */}
      <section className="py-20 px-4">
        <div className="container max-w-2xl text-center">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <Briefcase className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Built for agencies and consultants</h2>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mx-auto">
            Designed for professionals who need to respond to leads quickly and close more deals.
          </p>
          <div className="mt-10">
            <Link to="/signup">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 h-12 text-base">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-card border-y border-border">
        <div className="container max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-lg">No hidden fees. Cancel anytime.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {plans.map((plan) => (
              <Card key={plan.name} className={`border relative ${plan.popular ? "border-accent shadow-lg shadow-accent/10" : "border-border shadow-none"}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                    Most popular
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="text-lg font-semibold text-foreground mb-1">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup">
                    <Button className={`w-full ${plan.popular ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}`} variant={plan.popular ? "default" : "outline"}>
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">
            If this helps you close just one extra client, it pays for itself.
          </p>
        </div>
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