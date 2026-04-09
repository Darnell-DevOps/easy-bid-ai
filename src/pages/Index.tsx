import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download, Shield, Clock, Star } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "AI-Powered Proposals",
    description: "Enter your lead details and get a polished, professional proposal generated in seconds.",
  },
  {
    icon: FileText,
    title: "Instant Invoices",
    description: "Automatically generate itemised invoices alongside your proposals. No double entry.",
  },
  {
    icon: Download,
    title: "PDF Export",
    description: "Download beautifully formatted proposals and invoices as PDF, ready to send.",
  },
  {
    icon: Clock,
    title: "Under 2 Minutes",
    description: "From lead info to a ready-to-send proposal in under two minutes. Focus on closing, not formatting.",
  },
  {
    icon: Shield,
    title: "Professional & Trustworthy",
    description: "Clean, modern templates that make your agency look established and reliable.",
  },
  {
    icon: Star,
    title: "Saved History",
    description: "Access all your past proposals anytime. Track what you've sent and to whom.",
  },
];

const plans = [
  {
    name: "Basic",
    price: "£19",
    period: "/month",
    description: "Perfect for freelancers getting started",
    features: ["5 proposals per month", "AI proposal generation", "PDF export", "Email support"],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    price: "£39",
    period: "/month",
    description: "For agencies and busy consultants",
    features: [
      "Unlimited proposals",
      "AI proposal generation",
      "PDF export",
      "Saved proposal history",
      "Custom branding",
      "Priority support",
    ],
    cta: "Start Free Trial",
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
            ProposalFlow <span className="text-accent">AI</span>
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
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
            Turn lead details into a professional proposal and invoice in under 2 minutes.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            ProposalFlow AI helps small agencies, consultants, and freelancers create professional proposals and invoices instantly. No templates. No formatting. Just results.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 h-12 text-base">
                Start for free
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg" className="px-8 h-12 text-base">
                See how it works
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-card border-y border-border">
        <div className="container max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Everything you need to close faster</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Stop spending hours on proposals. Let AI handle the heavy lifting while you focus on your clients.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="border border-border bg-background shadow-none hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="container max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-lg">No hidden fees. Cancel anytime.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`border relative ${
                  plan.popular
                    ? "border-accent shadow-lg shadow-accent/10"
                    : "border-border shadow-none"
                }`}
              >
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
                    <Button
                      className={`w-full ${
                        plan.popular
                          ? "bg-accent text-accent-foreground hover:bg-accent/90"
                          : ""
                      }`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            ProposalFlow <span className="text-accent">AI</span>
          </span>
          <p>© {new Date().getFullYear()} ProposalFlow AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
