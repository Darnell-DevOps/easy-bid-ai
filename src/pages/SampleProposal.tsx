import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";

const scopeItems = [
  "UX audit & competitor analysis",
  "Custom landing page design",
  "About, Services & Contact subpages",
  "Mobile-responsive development",
  "SEO optimisation & performance tuning",
  "Browser & device testing",
];

const timeline = [
  { phase: "Discovery & Research", duration: "Days 1–3" },
  { phase: "Wireframes & Design", duration: "Days 4–7" },
  { phase: "Development & Integration", duration: "Days 8–12" },
  { phase: "Testing & Launch", duration: "Days 13–14" },
];

const pricing = [
  { item: "UX Audit & Strategy", cost: "£200" },
  { item: "UI Design (4 pages)", cost: "£400" },
  { item: "Frontend Development", cost: "£350" },
  { item: "Content Migration & SEO", cost: "£150" },
  { item: "QA & Launch Support", cost: "£100" },
];

export default function SampleProposal() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16 px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <Link to="/signup">
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 h-9">
              Create Your First Proposal Free
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container max-w-3xl px-4 py-16 md:py-24">
        {/* Header */}
        <div className="mb-12">
          <span className="text-xs font-medium text-accent uppercase tracking-wider">Sample Proposal</span>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4 tracking-tight">
            Website Redesign for ABC Company
          </h1>
          <p className="text-muted-foreground">
            Prepared by <span className="text-foreground font-medium">James Carter</span> · Carter Digital Studio
          </p>
          <p className="text-sm text-muted-foreground mt-1">April 10, 2026</p>
        </div>

        <div className="space-y-10">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4 pb-3 border-b border-border">Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Thank you for considering Carter Digital Studio for your website redesign. After reviewing your current site and discussing your goals, we're confident we can deliver a modern, high-converting website that reflects ABC Company's brand and drives measurable results. This proposal outlines our approach, timeline, and investment.
            </p>
          </section>

          {/* Scope */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4 pb-3 border-b border-border">Scope of Work</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {scopeItems.map((item) => (
                <div key={item} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                  <CheckCircle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Timeline */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4 pb-3 border-b border-border">Timeline</h2>
            <Card>
              <CardContent className="p-0">
                {timeline.map((phase, i) => (
                  <div
                    key={phase.phase}
                    className={`flex items-center justify-between px-5 py-4 ${i < timeline.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-semibold text-accent">
                        {i + 1}
                      </div>
                      <span className="text-sm text-foreground">{phase.phase}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{phase.duration}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground mt-3">Total estimated delivery: <span className="text-foreground font-medium">2 weeks</span> from project kick-off.</p>
          </section>

          {/* Pricing */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4 pb-3 border-b border-border">Pricing Breakdown</h2>
            <Card>
              <CardContent className="p-0">
                {pricing.map((row, i) => (
                  <div
                    key={row.item}
                    className={`flex items-center justify-between px-5 py-3.5 ${i < pricing.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <span className="text-sm text-muted-foreground">{row.item}</span>
                    <span className="text-sm text-foreground font-medium">{row.cost}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-5 py-4 border-t-2 border-accent/30 bg-accent/5">
                  <span className="text-sm font-semibold text-foreground">Total Investment</span>
                  <span className="text-lg font-bold text-accent">£1,200</span>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Next Steps */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4 pb-3 border-b border-border">Next Steps</h2>
            <ol className="space-y-3 text-sm text-muted-foreground list-decimal pl-5">
              <li>Review this proposal and let us know if you have any questions.</li>
              <li>Once approved, we'll send a contract and invoice for the deposit (50%).</li>
              <li>We'll schedule a kick-off call to align on goals and assets needed.</li>
              <li>Work begins — you'll receive progress updates at each milestone.</li>
            </ol>
          </section>

          {/* CTA */}
          <div className="pt-8 border-t border-border text-center">
            <p className="text-muted-foreground mb-6">This proposal was generated by CloseSync AI in under 2 minutes.</p>
            <Link to="/signup">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-[0_0_20px_hsl(var(--accent)/0.4)] px-10 h-14 text-base gap-2 transition-all">
                Create Your First Proposal Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
