import PageMeta from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/landing-analytics";
import { consumeOAuthRedirect } from "@/lib/oauth-return";
import {
  ArrowRight,
  Check,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

const workflowChapters = [
  {
    icon: Inbox,
    title: "Qualify and propose",
    description: "Capture the enquiry, understand the brief and create a proposal from the same client context.",
    points: ["Lead capture and qualification", "Branded proposals", "Structured follow-up"],
  },
  {
    icon: PenLine,
    title: "Agree and collect payment",
    description: "Move from approval to signed terms and a paid deposit without sending the client between tools.",
    points: ["Built-in e-signatures", "Payments through Paddle", "A complete activity trail"],
  },
  {
    icon: LayoutDashboard,
    title: "Onboard with context",
    description: "Collect the information needed to begin, with every decision and document already attached.",
    points: ["Flexible onboarding forms", "Branded client portal", "Bookings and retainers"],
  },
];

const connectedMoments = [
  "Enquiry",
  "Qualification",
  "Proposal",
  "Contract",
  "Payment",
  "Onboarding",
  "Kickoff",
];

const clientTimeline = [
  { icon: Inbox, label: "Enquiry", detail: "Brand refresh brief received", state: "Complete" },
  { icon: FileText, label: "Proposal", detail: "Approved at GBP 4,800", state: "Complete" },
  { icon: PenLine, label: "Contract", detail: "Signed by Sarah Chen", state: "Complete" },
  { icon: CreditCard, label: "Deposit", detail: "GBP 2,400 collected", state: "Complete" },
  { icon: LayoutDashboard, label: "Onboarding", detail: "Client form sent", state: "In progress" },
];

const automationFeatures = [
  {
    title: "Draft from real client context",
    description: "Create proposals and replies using the brief already attached to the client.",
  },
  {
    title: "Surface what needs attention",
    description: "See stalled deals, missing information and upcoming commitments without searching.",
  },
  {
    title: "Keep every action understandable",
    description: "Follow-ups, approvals, signatures and payments remain visible in one timeline.",
  },
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
    <span className="inline-flex items-baseline gap-1.5" aria-label="CloseSync AI">
      <span className="text-lg font-semibold tracking-[var(--cs-tracking-tight)] text-[color:var(--cs-text-primary)]">
        Close<span className="text-[color:var(--cs-primary)]">Sync</span>
      </span>
      <span className="text-xs font-medium text-[color:var(--cs-text-secondary)]">AI</span>
    </span>
  );
}

function ClientRecordPreview() {
  return (
    <div
      role="region"
      aria-labelledby="landing-client-record-label landing-client-record-name"
      className="overflow-hidden rounded-[var(--cs-radius-lg)] border border-[color:var(--cs-border-default)] bg-[var(--cs-bg-elevated)] shadow-[var(--cs-shadow-sm)]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[color:var(--cs-border-subtle)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p id="landing-client-record-label" className="text-xs font-medium text-[color:var(--cs-text-secondary)]">
            Example client record
          </p>
          <p id="landing-client-record-name" className="mt-1 truncate text-sm font-semibold text-[color:var(--cs-text-primary)]">
            Briar &amp; Co. - Brand refresh
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-[var(--cs-radius-sm)] bg-[var(--cs-success-bg)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--cs-text-primary)]">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--cs-success)]" />
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
                className="relative grid grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-[color:var(--cs-border-subtle)] py-4 last:border-0"
              >
                {index < clientTimeline.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[17px] top-[46px] h-[26px] w-px bg-[var(--cs-border-default)]"
                  />
                )}
                <span
                  className={`relative z-[1] flex h-9 w-9 items-center justify-center rounded-full border ${
                    isCurrent
                      ? "landing-workflow-current border-[color:var(--cs-primary)] bg-[var(--cs-violet-50)] text-[color:var(--cs-primary)]"
                      : "border-[color:var(--cs-border-default)] bg-[var(--cs-bg-page)] text-[color:var(--cs-text-secondary)]"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[color:var(--cs-text-primary)]">{item.label}</span>
                  <span className="mt-0.5 block break-words text-xs leading-5 text-[color:var(--cs-text-secondary)] sm:truncate">
                    {item.detail}
                  </span>
                </span>
                <span
                  className={`text-xs font-medium ${
                    isCurrent ? "text-[color:var(--cs-primary)]" : "text-[color:var(--cs-text-secondary)]"
                  }`}
                >
                  {item.state}
                </span>
              </li>
            );
          })}
        </ol>

        <aside
          aria-label="Commercial summary"
          className="border-t border-[color:var(--cs-border-subtle)] bg-[var(--cs-bg-subtle)] p-5 sm:p-6 md:border-l md:border-t-0"
        >
          <p className="text-xs font-medium text-[color:var(--cs-text-secondary)]">Commercial summary</p>
          <p className="mt-5 text-3xl font-semibold tracking-[var(--cs-tracking-tight)] text-[color:var(--cs-text-primary)]">
            GBP 4,800
          </p>
          <p className="mt-1 text-sm text-[color:var(--cs-text-secondary)]">Project value</p>

          <div className="my-6 h-px bg-[var(--cs-border-default)]" />

          <p className="text-xs font-medium text-[color:var(--cs-text-secondary)]">Next action</p>
          <p className="mt-3 text-sm font-semibold text-[color:var(--cs-text-primary)]">Review onboarding response</p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--cs-text-secondary)]">Due tomorrow, assigned to you</p>

          <div className="mt-6 rounded-[var(--cs-radius-md)] border border-[color:var(--cs-violet-100)] bg-[var(--cs-violet-50)] p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--cs-text-primary)]">
              <ShieldCheck className="h-4 w-4 text-[color:var(--cs-primary)]" aria-hidden="true" />
              Activity recorded
            </div>
            <p className="mt-2 text-xs leading-5 text-[color:var(--cs-text-secondary)]">
              Approval, signature and payment stay attached to this client.
            </p>
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
    <div
      className="landing-shell min-h-[100dvh] overflow-x-hidden bg-[var(--cs-bg-page)] text-[color:var(--cs-text-primary)]"
      data-design-provenance="user-pinned-default-attio-2026-08-25"
    >
      <PageMeta
        title="CloseSync - Client operations, in one place"
        description="Manage proposals, contracts, payments, onboarding and ongoing client work in one clear workspace."
        path="/"
      />

      <header className="sticky top-0 z-50 border-b border-[color:var(--cs-border-subtle)] bg-[var(--cs-bg-page)]">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label="CloseSync home">
            <Brand />
          </Link>

          <nav
            className="hidden items-center gap-8 text-sm font-medium text-[color:var(--cs-text-secondary)] md:flex"
            aria-label="Main navigation"
          >
            <a href="#product" className="transition-colors hover:text-[color:var(--cs-text-primary)]">Product</a>
            <a href="#workflow" className="transition-colors hover:text-[color:var(--cs-text-primary)]">Workflow</a>
            <a href="#pricing" className="transition-colors hover:text-[color:var(--cs-text-primary)]">Pricing</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/login"
              className="px-2 py-2 text-sm font-medium text-[color:var(--cs-text-primary)] transition-colors hover:text-[color:var(--cs-primary)]"
            >
              Sign in
            </Link>
            <Button
              asChild
              className="h-10 rounded-[var(--cs-radius-sm)] bg-[var(--cs-primary)] px-4 text-sm font-medium text-white shadow-none hover:bg-[var(--cs-primary-hover)] sm:px-5"
            >
              <Link to="/signup" onClick={() => track("cta_click", { location: "nav" })}>
                Start free
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1}>
        <section className="border-b border-[color:var(--cs-border-subtle)] bg-[var(--cs-bg-page)] px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
            <div className="max-w-xl">
              <h1 className="cs-text-display max-w-[14ch] text-[color:var(--cs-text-primary)]">
                Every client handoff, connected.
              </h1>
              <p className="mt-6 max-w-[58ch] text-base leading-7 text-[color:var(--cs-text-secondary)] sm:text-lg sm:leading-8">
                CloseSync connects proposals, contracts, payments and onboarding to one client record, so the next step is always clear.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  size="lg"
                  className="h-12 w-full rounded-[var(--cs-radius-sm)] bg-[var(--cs-primary)] px-6 text-base font-medium text-white shadow-none hover:bg-[var(--cs-primary-hover)] sm:w-auto"
                >
                  <Link to="/signup" onClick={() => track("cta_click", { location: "hero" })}>
                    Start free
                    <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Link
                  to="/sample"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--cs-radius-sm)] border border-[color:var(--cs-border-default)] bg-[var(--cs-bg-page)] px-5 text-sm font-medium text-[color:var(--cs-text-primary)] transition-colors hover:bg-[var(--cs-bg-subtle)]"
                  onClick={() => track("sample_view")}
                >
                  View sample proposal
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <ClientRecordPreview />
          </div>
        </section>

        <section className="border-b border-[color:var(--cs-border-subtle)] bg-[var(--cs-bg-subtle)] px-5 sm:px-8" aria-label="Product capabilities">
          <div className="mx-auto grid max-w-7xl divide-y divide-[color:var(--cs-border-default)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {[
              ["One client record", "From first enquiry onwards"],
              ["Built-in signatures", "Contracts without another tool"],
              ["Paddle payments", "Deposits and recurring billing"],
              ["Client portal", "A clear view for both sides"],
            ].map(([title, detail]) => (
              <div key={title} className="px-0 py-5 sm:px-6 lg:px-8">
                <p className="text-sm font-semibold text-[color:var(--cs-text-primary)]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--cs-text-secondary)]">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="product" className="scroll-mt-24 bg-[var(--cs-bg-page)] px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <h2 className="cs-text-h1 text-[color:var(--cs-text-primary)]">
                Every handoff stays attached to the client.
              </h2>
              <p className="mt-5 max-w-[65ch] text-base leading-7 text-[color:var(--cs-text-secondary)]">
                CloseSync gives your team one shared history, one current status and one clear next action from enquiry through delivery.
              </p>
            </div>

            <ol
              aria-label="Connected client journey"
              className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-4 border-y border-[color:var(--cs-border-default)] py-5"
            >
              {connectedMoments.map((moment, index) => (
                <li key={moment} className="flex items-center gap-3 text-sm font-medium text-[color:var(--cs-text-primary)]">
                  <span>{moment}</span>
                  {index < connectedMoments.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-[color:var(--cs-primary)]" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>

            <div id="workflow" className="scroll-mt-24 pt-8">
              {workflowChapters.map((chapter) => {
                const Icon = chapter.icon;
                return (
                  <article
                    key={chapter.title}
                    className="grid gap-6 border-b border-[color:var(--cs-border-default)] py-10 first:pt-4 md:grid-cols-[0.42fr_0.58fr] md:gap-12"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--cs-radius-sm)] bg-[var(--cs-violet-50)] text-[color:var(--cs-primary)]">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <h3 className="cs-text-h3 pt-1.5 text-[color:var(--cs-text-primary)]">{chapter.title}</h3>
                    </div>
                    <div>
                      <p className="max-w-[62ch] text-base leading-7 text-[color:var(--cs-text-secondary)]">
                        {chapter.description}
                      </p>
                      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
                        {chapter.points.map((point) => (
                          <li key={point} className="flex items-start gap-2.5 text-sm text-[color:var(--cs-text-primary)]">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--cs-primary)]" aria-hidden="true" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-[color:var(--cs-border-subtle)] bg-[var(--cs-bg-subtle)] px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
            <div>
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--cs-radius-sm)] bg-[var(--cs-violet-50)] text-[color:var(--cs-primary)]">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="cs-text-h1 mt-6 max-w-lg text-[color:var(--cs-text-primary)]">
                AI works inside the client record.
              </h2>
              <p className="mt-5 max-w-lg text-base leading-7 text-[color:var(--cs-text-secondary)]">
                Draft faster and spot what needs attention while keeping every important action visible and under your control.
              </p>
            </div>

            <div className="border-t border-[color:var(--cs-border-default)]">
              {automationFeatures.map((feature) => (
                <div key={feature.title} className="grid gap-2 border-b border-[color:var(--cs-border-default)] py-6 sm:grid-cols-[0.42fr_0.58fr] sm:gap-8">
                  <h3 className="text-base font-semibold text-[color:var(--cs-text-primary)]">{feature.title}</h3>
                  <p className="text-sm leading-6 text-[color:var(--cs-text-secondary)]">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24 bg-[var(--cs-bg-page)] px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="cs-text-h1 text-[color:var(--cs-text-primary)]">Pricing that stays easy to understand.</h2>
              <p className="mt-4 text-base leading-7 text-[color:var(--cs-text-secondary)]">
                Start free. Upgrade when CloseSync becomes part of your client workflow.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={`relative flex h-full flex-col rounded-[var(--cs-radius-lg)] border bg-[var(--cs-bg-elevated)] p-7 shadow-[var(--cs-shadow-xs)] sm:p-8 ${
                    plan.recommended ? "border-[color:var(--cs-primary)]" : "border-[color:var(--cs-border-default)]"
                  }`}
                >
                  {plan.recommended && (
                    <span className="absolute right-6 top-6 rounded-[var(--cs-radius-sm)] bg-[var(--cs-violet-50)] px-2.5 py-1 text-xs font-medium text-[color:var(--cs-primary)]">
                      Recommended
                    </span>
                  )}
                  <p className="text-sm font-semibold text-[color:var(--cs-text-secondary)]">{plan.name}</p>
                  <div className="mt-5 flex items-end gap-1">
                    <span className="text-4xl font-semibold tracking-[var(--cs-tracking-display)] text-[color:var(--cs-text-primary)]">
                      {plan.price}
                    </span>
                    <span className="pb-1 text-sm text-[color:var(--cs-text-secondary)]">/ month</span>
                  </div>
                  <p className="mt-4 min-h-[48px] text-sm leading-6 text-[color:var(--cs-text-secondary)]">{plan.description}</p>

                  <div className="my-7 h-px bg-[var(--cs-border-subtle)]" />

                  <ul className="flex-1 space-y-3.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-[color:var(--cs-text-primary)]">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--cs-primary)]" aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    className={`mt-8 h-12 w-full rounded-[var(--cs-radius-sm)] text-sm font-medium shadow-none ${
                      plan.recommended
                        ? "bg-[var(--cs-primary)] text-white hover:bg-[var(--cs-primary-hover)]"
                        : "border-[color:var(--cs-border-default)] bg-[var(--cs-bg-page)] text-[color:var(--cs-text-primary)] hover:bg-[var(--cs-bg-subtle)]"
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

            <p className="mt-8 text-center text-xs text-[color:var(--cs-text-secondary)]">
              Cancel anytime. Payments are processed securely through Paddle.
            </p>
          </div>
        </section>

        <section className="border-y border-[color:var(--cs-violet-100)] bg-[var(--cs-violet-50)] px-5 py-16 sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div>
              <h2 className="cs-text-h2 text-[color:var(--cs-text-primary)]">Keep the next client moving.</h2>
              <p className="mt-3 text-base text-[color:var(--cs-text-secondary)]">Start with the free plan. No card required.</p>
            </div>
            <Button
              asChild
              size="lg"
              className="h-12 rounded-[var(--cs-radius-sm)] bg-[var(--cs-primary)] px-7 text-base font-medium text-white shadow-none hover:bg-[var(--cs-primary-hover)]"
            >
              <Link to="/signup" onClick={() => track("cta_click", { location: "final" })}>
                Start free
                <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-[var(--cs-bg-page)] px-5 py-9 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <Brand />
          <p className="text-xs text-[color:var(--cs-text-secondary)]">Copyright 2026 CloseSync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
