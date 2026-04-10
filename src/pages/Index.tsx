import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Zap, Download, AlertTriangle, Clock, XCircle, UserX, ArrowRight, CheckCircle, Briefcase, ShieldCheck } from "lucide-react";

const steps = [
  { number: "1", title: "Enter your client details", description: "Fill in a simple form with the client name, service type, budget, and timeline." },
  { number: "2", title: "AI generates your proposal and invoice instantly", description: "Our AI creates a polished proposal, pricing breakdown, and invoice in seconds." },
  { number: "3", title: "Download and send to your client", description: "Export as PDF, review, and send. Done in under two minutes." },
];

const painPoints = [
  { icon: Clock, text: "Losing clients because you reply too late" },
  { icon: AlertTriangle, text: "Spending hours writing proposals manually" },
  { icon: XCircle, text: "Looking unprofessional compared to competitors" },
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
    cta: "Create Your First Proposal Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "£9",
    period: "/month",
    description: "For freelancers and agencies closing more deals",
    features: ["Unlimited proposals", "No watermark", "Invoice export", "Custom branding", "Proposal history"],
    cta: "Create Unlimited Proposals",
    popular: true,
    valueLine: "Less than the cost of 1 client lost",
  },
];

export default function Index() {
  const [sampleOpen, setSampleOpen] = useState(false);

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
              <Button size="sm" className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:brightness-110 h-9">Create Your First Proposal Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 md:py-36 px-4">
        <div className="container max-w-3xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight leading-tight mb-6">
            Create proposals that win clients — in <span className="bg-gradient-to-r from-accent to-purple bg-clip-text text-transparent font-extrabold">minutes</span>.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
            Stop losing clients because of slow proposals. Generate a professional proposal and invoice in under <span className="text-foreground font-semibold">2 minutes</span>.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:brightness-110 hover:shadow-[0_0_20px_hsl(var(--accent)/0.4)] px-10 h-14 text-base gap-2 transition-all">
                Create Your First Proposal Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="px-10 h-14 text-base" onClick={() => setSampleOpen(true)}>
              View Sample Proposal
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-6">No signup required to try • Generate your first proposal in seconds</p>
          <div className="flex items-center justify-center gap-5 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Zap className="w-3 h-3 text-accent" />Fast</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="w-3 h-3 text-accent" />Secure</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="w-3 h-3 text-accent" />Professional</span>
          </div>
        </div>
      </section>

      {/* Product Preview */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">See how it works</h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            From client details to a ready-to-send proposal in seconds.
          </p>
          <div className="relative">
            <div className="absolute -inset-4 bg-purple/20 rounded-3xl blur-2xl pointer-events-none" />
            <div className="relative rounded-2xl border-2 border-accent/30 bg-card shadow-2xl shadow-accent/10 overflow-hidden">
              <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-destructive/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <span className="text-xs text-accent font-medium ml-2 uppercase tracking-wider">Live preview</span>
                </div>
                <span className="text-[10px] text-accent/80 bg-accent/10 px-2 py-0.5 rounded-full font-medium animate-pulse">● Generated just now</span>
              </div>
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                {/* Form side */}
                <div className="p-6 text-left space-y-4">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Client Details</h3>
                  {[
                    { label: "Client Name", value: "ABC Company" },
                    { label: "Service Type", value: "Website Redesign" },
                    { label: "Budget", value: "£1,200" },
                  ].map((field) => (
                    <div key={field.label} className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">{field.label}</span>
                      <div className="h-9 rounded-md bg-muted/50 border border-border flex items-center px-3">
                        <span className="text-xs text-foreground/70">{field.value}</span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2">
                    <div className="h-10 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
                      <span className="text-xs font-medium text-accent">Generate Proposal →</span>
                    </div>
                  </div>
                </div>
                {/* Preview side */}
                <div className="p-6 text-left space-y-3 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent animate-shimmer pointer-events-none" />
                  <h3 className="text-sm font-semibold text-foreground mb-3">Generated Proposal</h3>
                  <p className="text-sm font-medium text-foreground/90">Website redesign proposal for ABC Company</p>
                  <div className="space-y-1.5 text-xs text-foreground/70">
                    <p>Scope: Landing page + 3 subpages</p>
                    <p>Timeline: 2 weeks</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border space-y-1.5">
                    <p className="text-xs text-muted-foreground">Pricing Breakdown</p>
                    <div className="flex justify-between text-xs text-foreground/70">
                      <span>Design & Development</span><span>£900</span>
                    </div>
                    <div className="flex justify-between text-xs text-foreground/70">
                      <span>Content & QA</span><span>£300</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold text-accent pt-1 border-t border-border/50">
                      <span>Total</span><span>£1,200</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-6">Generated in under 2 minutes</p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container max-w-3xl text-center">
          <p className="text-muted-foreground text-lg mb-8">Used by freelancers and agencies to close more clients</p>
          <div className="flex flex-col sm:flex-row justify-center gap-6 mb-12">
            {[
              { icon: Clock, text: "Save hours on every proposal" },
              { icon: Zap, text: "Look more professional instantly" },
              { icon: ArrowRight, text: "Close deals faster" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-sm text-foreground">
                <item.icon className="w-4 h-4 text-accent flex-shrink-0" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <blockquote className="max-w-lg mx-auto border-l-2 border-accent pl-4 text-left">
            <p className="text-sm text-foreground/80 italic leading-relaxed">
              "This tool saved me hours every week and helped me land more clients"
            </p>
            <footer className="mt-2 text-xs text-muted-foreground">— Freelance Consultant</footer>
          </blockquote>
        </div>
      </section>

      {/* Pain Section */}
      <section className="py-28 px-4 bg-card border-y border-border">
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
      <section id="how-it-works" className="py-28 px-4">
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
      <section className="py-28 px-4 bg-card border-y border-border">
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
              <Button size="lg" className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:brightness-110 hover:shadow-[0_0_20px_hsl(var(--accent)/0.4)] px-10 h-14 text-base gap-2 transition-all">
                Create Your First Proposal Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-28 px-4 bg-card border-y border-border">
        <div className="container max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-lg">No hidden fees. Cancel anytime.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto items-start">
            {plans.map((plan) => (
              <Card key={plan.name} className={`border relative transition-all ${plan.popular ? "border-accent border-2 shadow-2xl shadow-accent/30 ring-2 ring-accent/40 md:scale-110 md:-my-6 z-10" : "border-border shadow-none"}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                    Most popular
                  </div>
                )}
                <CardContent className={plan.popular ? "p-10" : "p-8"}>
                  <h3 className={`font-semibold text-foreground mb-1 ${plan.popular ? "text-xl" : "text-lg"}`}>{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>
                  <div className="mb-2">
                    <span className={`font-bold text-foreground ${plan.popular ? "text-5xl" : "text-4xl"}`}>{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  {plan.valueLine && (
                    <p className="text-xs text-accent mb-6 font-medium">{plan.valueLine}</p>
                  )}
                  {!plan.valueLine && <div className="mb-6" />}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup">
                    <Button className={`w-full h-12 text-base transition-all ${plan.popular ? "bg-gradient-to-r from-accent to-purple text-accent-foreground hover:brightness-110 hover:shadow-[0_0_24px_hsl(var(--accent)/0.5)] font-semibold" : "hover:brightness-110"}`} variant={plan.popular ? "default" : "outline"}>
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

      {/* Sample Proposal Modal */}
      <Dialog open={sampleOpen} onOpenChange={setSampleOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sample Proposal — Website Redesign</DialogTitle>
            <DialogDescription>This is an example of what CloseSync AI generates for you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 text-sm">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Project Overview</h3>
              <p className="text-muted-foreground leading-relaxed">
                We propose a complete website redesign for ABC Company, including a modern landing page and three subpages optimised for conversions and mobile responsiveness.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Scope of Work</h3>
              <ul className="space-y-1 text-muted-foreground list-disc pl-5">
                <li>UX audit of the existing website</li>
                <li>Custom landing page design</li>
                <li>3 subpages (About, Services, Contact)</li>
                <li>Mobile-responsive development</li>
                <li>SEO optimisation &amp; performance tuning</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Timeline</h3>
              <p className="text-muted-foreground">Estimated delivery: <span className="text-foreground font-medium">2 weeks</span> from project kick-off.</p>
            </div>
            <div className="border-t border-border pt-4">
              <h3 className="font-semibold text-foreground mb-3">Pricing Breakdown</h3>
              <div className="space-y-2 text-muted-foreground">
                <div className="flex justify-between"><span>Design &amp; Development</span><span className="text-foreground">£900</span></div>
                <div className="flex justify-between"><span>Content &amp; QA</span><span className="text-foreground">£300</span></div>
                <div className="flex justify-between font-semibold text-foreground border-t border-border pt-2 mt-2">
                  <span>Total</span><span>£1,200</span>
                </div>
              </div>
            </div>
            <div className="pt-2">
              <Link to="/signup">
                <Button className="w-full bg-gradient-to-r from-accent to-purple text-accent-foreground hover:brightness-110 h-12 text-base gap-2">
                  Create Your First Proposal Free <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}