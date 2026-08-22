import PageMeta from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/landing-analytics";
import { consumeOAuthRedirect } from "@/lib/oauth-return";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  PenLine,
  ShieldCheck,
} from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

const workflowPillars = [
  {
    icon: Inbox,
    title: "Win the work",
    description: "Capture the enquiry, understand the brief and send a clear proposal from one client record.",
    points: ["Lead capture and qualification", "Branded proposals", "Structured follow-up"],
  },
  {
    icon: PenLine,
    title: "Agree and get paid",
    description: "Move from approval to signed terms and a paid deposit without sending clients between tools.",
    points: ["Built-in e-signatures", "Payments through Paddle", "A complete activity trail"],
  },
  {
    icon: ClipboardCheck,
    title: "Start with context",
    description: "Collect the information your team needs and give the client one clear place to follow progress.",
    points: ["Flexible onboarding forms", "Branded client portal", "Bookings and retainers"],
  },
];

const clientTimeline = [
  { icon: Inbox, label: "Enquiry", detail: "Brand refresh brief received", state: "Complete" },
  { icon: FileText, label: "Proposal", detail: "Approved at GBP 4,800", state: "Complete" },
  { icon: PenLine, label: "Contract", detail: "Signed by Sarah Chen", state: "Complete" },
  { icon: CreditCard, label: "Deposit", detail: "GBP 2,400 collected", state: "Complete" },
  { icon: LayoutDashboard, label: "Onboarding", detail: "Client form sent", state: "In progress" },
];

const plans = [
  {
    name: "Free",
    price: "\u00A30",
    description: "A straightforward way to try the proposal workflow.",
    features: ["1 proposal per month", "Watermarked proposals", "Limited AI insights", "No card required"],
    cta: "Start free",
    location: "pricing_free",
  },
  {
    name: "Pro",
    price: "\u00A329",
    description: "The complete client operations workspace for independent teams.",
    features: [
      "Unlimited proposals and contracts",
      "E-signatures and Paddle payments",
      "Onboarding, bookings and client portal",
      "Retainers and recurring billing",
      "AI drafting and account insights",
      "No watermark",
    ],
    cta: "Start 7-day trial",
    location: "pricing_pro",
    recommended: true,
  },
];

function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#182338] text-[11px] font-bold tracking-tight text-white">
        CS
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-[#182338]">
        Close<span className="text-[#3858bd]">Sync</span>
      </span>
    </span>
  );
}

function ClientRecordPreview() {
  return (
    <div
      role="region"
      aria-labelledby="landing-client-record-label landing-client-record-name"
      className="overflow-hidden rounded-2xl border border-[#d9dee8] bg-white shadow-[0_20px_60px_rgba(24,35,56,0.10)]"
    >
      <div className="flex items-center justify-between border-b border-[#e3e7ee] px-5 py-4 sm:px-6">
        <div>
          <p id="landing-client-record-label" className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657084]">Client record</p>
          <p id="landing-client-record-name" className="mt-1 text-sm font-semibold text-[#182338]">Acme Studio - Brand refresh</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md bg-[#edf7f1] px-2.5 py-1.5 text-xs font-semibold text-[#27734f]">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#2f8b60]" />
          Active
        </span>
      </div>

      <div className="grid md:grid-cols-[1.35fr_0.65fr]">
        <ol aria-label="Client workflow" className="px-5 py-3 sm:px-6">
          {clientTimeline.map((item, index) => {
            const Icon = item.icon;
            const isCurrent = item.state === "In progress";
            return (
              <li
                key={item.label}
                aria-current={isCurrent ? "step" : undefined}
                className="relative grid grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-[#edf0f4] py-4 last:border-0"
              >
                {index < clientTimeline.length - 1 && (
                  <span aria-hidden className="absolute left-[17px] top-[46px] h-[26px] w-px bg-[#dfe4ec]" />
                )}
                <span
                  className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border ${
                    isCurrent
                      ? "border-[#3858bd] bg-[#eef2ff] text-[#3858bd]"
                      : "border-[#d8dee8] bg-white text-[#5f6b7d]"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#182338]">{item.label}</span>
                  <span className="mt-0.5 block break-words text-xs leading-5 text-[#657084] sm:truncate">{item.detail}</span>
                </span>
                <span className={`text-xs font-medium ${isCurrent ? "text-[#3858bd]" : "text-[#657084]"}`}>
                  {item.state}
                </span>
              </li>
            );
          })}
        </ol>

        <aside aria-label="Commercial summary" className="border-t border-[#e3e7ee] bg-[#f7f8fa] p-5 sm:p-6 md:border-l md:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657084]">Commercial summary</p>
          <p className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-[#182338]">GBP 4,800</p>
          <p className="mt-1 text-sm text-[#657084]">Project value</p>

          <div className="my-6 h-px bg-[#dfe4eb]" />

          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657084]">Next action</p>
          <p className="mt-3 text-sm font-semibold text-[#182338]">Review onboarding response</p>
          <p className="mt-1 text-xs leading-5 text-[#657084]">Due tomorrow - assigned to you</p>

          <div className="mt-6 rounded-lg border border-[#d9dee8] bg-white p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#26334a]">
              <ShieldCheck className="h-4 w-4 text-[#3858bd]" />
              Activity recorded
            </div>
            <p className="mt-2 text-xs leading-5 text-[#657084]">Proposal approval, signature and payment stay attached to this client.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    track("landing_view");
  }, []);

  useEffect(() => {
    return consumeOAuthRedirect((path) => navigate(path, { replace: true }));
  }, [navigate]);

  return (
    <div className="landing-shell min-h-screen overflow-x-hidden bg-[#f7f8fa] text-[#182338]">
      <PageMeta
        title="CloseSync - Client operations, in one place"
        description="Manage proposals, contracts, payments, onboarding and ongoing client work in one clear workspace."
        path="/"
      />

      <header className="sticky top-0 z-50 border-b border-[#dfe3ea] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label="CloseSync home">
            <Brand />
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[#5f6b7d] md:flex" aria-label="Main navigation">
            <a href="#product" className="transition-colors hover:text-[#182338]">Product</a>
            <a href="#workflow" className="transition-colors hover:text-[#182338]">How it works</a>
            <a href="#pricing" className="transition-colors hover:text-[#182338]">Pricing</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/login" className="px-2 py-2 text-sm font-semibold text-[#26334a] transition-colors hover:text-[#3858bd]">
              Sign in
            </Link>
            <Button asChild className="h-10 rounded-lg bg-[#182338] px-4 text-sm font-semibold text-white shadow-none hover:bg-[#2b3b58] sm:px-5">
              <Link to="/signup" onClick={() => track("cta_click", { location: "nav" })}>
                Start free
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1}>
        <section className="border-b border-[#dfe3ea] bg-[#f7f8fa] px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.86fr_1.14fr] lg:gap-16">
            <div className="max-w-xl">
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-[#526078]">
                Client operations for independent teams
              </p>
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-[#182338] sm:text-5xl lg:text-[3.65rem]">
                Move every client from enquiry to onboarding - in one place.
              </h1>
              <p className="mt-6 max-w-[60ch] text-base leading-7 text-[#5f6b7d] sm:text-lg sm:leading-8">
                CloseSync brings proposals, contracts, payments, onboarding and ongoing client work into one clear workflow, so nothing gets lost between tools.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="h-12 w-full rounded-lg bg-[#182338] px-6 text-base font-semibold text-white shadow-none hover:bg-[#2b3b58] sm:w-auto">
                  <Link to="/signup" onClick={() => track("cta_click", { location: "hero" })}>
                    Start free
                    <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Link
                  to="/sample"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-[#26334a] transition-colors hover:bg-[#eceff4]"
                  onClick={() => track("sample_view")}
                >
                  View sample proposal
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[#657084]">
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#3858bd]" /> No card required</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#3858bd]" /> 7-day Pro trial</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#3858bd]" /> Payments by Paddle</span>
              </div>
            </div>

            <ClientRecordPreview />
          </div>
        </section>

        <section className="border-b border-[#dfe3ea] bg-white px-5 sm:px-8" aria-label="Product capabilities">
          <div className="mx-auto grid max-w-7xl divide-y divide-[#e4e7ed] md:grid-cols-4 md:divide-x md:divide-y-0">
            {[
              ["One client record", "From first enquiry onwards"],
              ["Built-in signatures", "Contracts without another tool"],
              ["Paddle payments", "Deposits and recurring billing"],
              ["Client portal", "A clear view for both sides"],
            ].map(([title, detail]) => (
              <div key={title} className="px-0 py-5 md:px-6 lg:px-8">
                <p className="text-sm font-semibold text-[#26334a]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[#657084]">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="product" className="scroll-mt-24 bg-white px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 border-b border-[#dfe3ea] pb-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#526078]">The product</p>
                <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.03em] text-[#182338] sm:text-4xl">
                  Everything needed to run the commercial side of client work.
                </h2>
              </div>
              <p className="max-w-xl text-base leading-7 text-[#657084] lg:justify-self-end">
                CloseSync keeps the important handoffs connected. Your team sees what happened, what is due and what the client needs next.
              </p>
            </div>

            <div id="workflow" className="grid scroll-mt-24 gap-10 pt-12 md:grid-cols-3 md:gap-8">
              {workflowPillars.map((pillar, index) => {
                const Icon = pillar.icon;
                return (
                  <article key={pillar.title} className="border-t-2 border-[#182338] pt-6">
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef1f6] text-[#26334a]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-semibold text-[#657084]">0{index + 1}</span>
                    </div>
                    <h3 className="mt-6 text-xl font-semibold tracking-[-0.02em] text-[#182338]">{pillar.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#657084]">{pillar.description}</p>
                    <ul className="mt-6 space-y-3">
                      {pillar.points.map((point) => (
                        <li key={point} className="flex items-start gap-2.5 text-sm text-[#354259]">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3858bd]" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#182338] px-5 py-20 text-white sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#aebbd2]">Thoughtful automation</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">
                Useful assistance. Visible control.
              </h2>
              <p className="mt-5 max-w-lg text-base leading-7 text-[#c4ccda]">
                AI helps with drafting and routine follow-up, while the client record remains the source of truth. You can always see the context and the next action.
              </p>
            </div>

            <div className="divide-y divide-white/15 border-y border-white/15">
              {[
                ["Draft from real client context", "Create proposals and replies using the brief already attached to the client."],
                ["Surface what needs attention", "See stalled deals, missing information and upcoming commitments without searching."],
                ["Keep the activity understandable", "Follow-ups, approvals, signatures and payments remain visible in one timeline."],
              ].map(([title, detail], index) => (
                <div key={title} className="grid gap-3 py-6 sm:grid-cols-[34px_1fr] sm:gap-4">
                  <span className="text-sm font-semibold text-[#95a9e5]">0{index + 1}</span>
                  <div>
                    <h3 className="text-base font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#b7c1d2]">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24 bg-[#f7f8fa] px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#526078]">Pricing</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#182338] sm:text-4xl">Simple enough to decide quickly.</h2>
              <p className="mt-4 text-base text-[#657084]">Start free. Upgrade when CloseSync becomes part of your client workflow.</p>
            </div>

            <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={`relative flex h-full flex-col rounded-2xl border bg-white p-7 sm:p-8 ${
                    plan.recommended ? "border-[#3858bd]" : "border-[#d9dee8]"
                  }`}
                >
                  {plan.recommended && (
                    <span className="absolute right-6 top-6 rounded-md bg-[#eef2ff] px-2.5 py-1 text-xs font-semibold text-[#3858bd]">
                      Recommended
                    </span>
                  )}
                  <p className="text-sm font-semibold text-[#526078]">{plan.name}</p>
                  <div className="mt-5 flex items-end gap-1">
                    <span className="text-4xl font-semibold tracking-[-0.04em] text-[#182338]">{plan.price}</span>
                    <span className="pb-1 text-sm text-[#657084]">/ month</span>
                  </div>
                  <p className="mt-4 min-h-[48px] text-sm leading-6 text-[#657084]">{plan.description}</p>

                  <div className="my-7 h-px bg-[#e3e7ee]" />

                  <ul className="flex-1 space-y-3.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-[#354259]">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3858bd]" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    className={`mt-8 h-12 w-full rounded-lg text-sm font-semibold shadow-none ${
                      plan.recommended
                        ? "bg-[#182338] text-white hover:bg-[#2b3b58]"
                        : "border-[#cfd5df] bg-white text-[#26334a] hover:bg-[#f1f3f6]"
                    }`}
                    variant={plan.recommended ? "default" : "outline"}
                  >
                    <Link to="/signup" onClick={() => track("cta_click", { location: plan.location })}>
                      {plan.cta}
                    </Link>
                  </Button>
                </article>
              ))}
            </div>

            <p className="mt-8 text-center text-xs text-[#657084]">Cancel anytime. Payments are processed securely through Paddle.</p>
          </div>
        </section>

        <section className="border-y border-[#dfe3ea] bg-white px-5 py-20 sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-8 text-center lg:flex-row lg:text-left">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#182338]">Put the next client workflow in one place.</h2>
              <p className="mt-3 text-base text-[#657084]">Start with the free plan. No card required.</p>
            </div>
            <Button asChild size="lg" className="h-12 rounded-lg bg-[#182338] px-7 text-base font-semibold text-white shadow-none hover:bg-[#2b3b58]">
              <Link to="/signup" onClick={() => track("cta_click", { location: "final" })}>
                Start free
                <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-[#f7f8fa] px-5 py-9 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <Brand />
          <p className="text-xs text-[#657084]">Copyright 2026 CloseSync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
