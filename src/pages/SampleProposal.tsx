import PageMeta from "@/components/PageMeta";
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
      <PageMeta title="Sample AI Proposal | CloseSync AI" description="See an example of an AI-generated client proposal built with CloseSync AI." path="/sample" />
      {/* Nav */}
      <nav aria-label="Sample proposal navigation" className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16 px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <ArrowLeft aria-hidden="true" className="w-4 h-4" /> Back to home
          </Link>
          <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 h-9">
            <Link to="/signup">
              Create Your First Proposal Free
            </Link>
          </Button>
        </div>
      </nav>

      <main className="container max-w-3xl px-4 py-16 md:py-24">
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
            <ul className="grid sm:grid-cols-2 gap-3">
              {scopeItems.map((item) => (
                <li key={item} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                  <CheckCircle aria-hidden="true" className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Timeline */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4 pb-3 border-b border-border">Timeline</h2>
            <Card>
              <CardContent className="p-0">
                <ol>
                  {timeline.map((phase, i) => (
                    <li
                      key={phase.phase}
                      className={`flex items-center justify-between px-5 py-4 ${i < timeline.length - 1 ? "border-b border-border" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-semibold text-accent">
                          {i + 1}
                        </span>
                        <span className="text-sm text-foreground">{phase.phase}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{phase.duration}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground mt-3">Total estimated delivery: <span className="text-foreground font-medium">2 weeks</span> from project kick-off.</p>
          </section>

          {/* Pricing */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4 pb-3 border-b border-border">Pricing Breakdown</h2>
            <Card>
              <CardContent className="p-0">
                <dl>
                  {pricing.map((row, i) => (
                    <div
                      key={row.item}
                      className={`flex items-center justify-between px-5 py-3.5 ${i < pricing.length - 1 ? "border-b border-border" : ""}`}
                    >
                      <dt className="text-sm text-muted-foreground">{row.item}</dt>
                      <dd className="text-sm text-foreground font-medium">{row.cost}</dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-5 py-4 border-t-2 border-accent/30 bg-accent/5">
                    <dt className="text-sm font-semibold text-foreground">Total Investment</dt>
                    <dd className="text-lg font-bold text-accent">£1,200</dd>
                  </div>
                </dl>
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
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 px-10 h-14 text-base gap-2 transition-colors">
              <Link to="/signup">
                Create Your First Proposal Free
                <ArrowRight aria-hidden="true" className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
