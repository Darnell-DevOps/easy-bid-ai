import consultantProposalImage from "@/assets/landing/consultant-proposal-editorial.png";
import PageMeta from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CreditCard,
  FileCheck2,
  FileSignature,
  Inbox,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "@/styles/landing-concepts.css";

const conceptKeys = ["editorial", "system", "studio"] as const;
type ConceptKey = (typeof conceptKeys)[number];
type LandingCtaLocation = "hero" | "pricing_free" | "pricing_pro" | "footer";

const conceptLabels: Record<ConceptKey, string> = {
  editorial: "A - Editorial record",
  system: "B - Workflow system",
  studio: "C - Quiet studio",
};

const journey = ["Enquiry", "Qualification", "Proposal", "Contract", "Payment", "Onboarding", "Kickoff"];

const recordEvents = [
  { icon: Inbox, label: "Enquiry", detail: "Brand refresh brief received", state: "Complete" },
  { icon: FileCheck2, label: "Proposal", detail: "Approved at GBP 4,800", state: "Complete" },
  { icon: FileSignature, label: "Contract", detail: "Signed by Amina Patel", state: "Complete" },
  { icon: CreditCard, label: "Deposit", detail: "GBP 2,400 collected", state: "Complete" },
  { icon: LayoutDashboard, label: "Onboarding", detail: "Client form sent", state: "In progress" },
];

const closingChapters = [
  {
    icon: Inbox,
    title: "Understand the opportunity",
    description: "Capture the enquiry, qualify the brief and keep the original context ready for every next action.",
  },
  {
    icon: FileSignature,
    title: "Reach agreement",
    description: "Create the proposal, collect approval, send the contract and take payment without rebuilding the client record.",
  },
  {
    icon: LayoutDashboard,
    title: "Begin with context",
    description: "Move into onboarding, booking and ongoing work with every decision and document already attached.",
  },
];

const systemFriction = [
  "Enquiry context gets copied between tools",
  "Follow-ups depend on memory and manual checks",
  "Delivery starts without the full client history",
];

const systemCapabilities = [
  {
    icon: Inbox,
    title: "Capture and qualify",
    description: "Bring every enquiry, brief and qualification decision into one client record from the start.",
  },
  {
    icon: FileSignature,
    title: "Agree and get paid",
    description: "Move from proposal to signature and payment without rebuilding the context at each step.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Start and manage the work",
    description: "Carry every decision into onboarding, kickoff, bookings, retainers and ongoing delivery.",
  },
];

const proFeatures = [
  "Unlimited proposals and contracts",
  "E-signatures and Paddle payments",
  "Onboarding, bookings and client portal",
  "Retainers and recurring billing",
  "AI drafting and account insights",
];

function isConceptKey(value: string | undefined): value is ConceptKey {
  return conceptKeys.includes(value as ConceptKey);
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`concept-brand${inverse ? " concept-brand-inverse" : ""}`} aria-label="CloseSync AI">
      <span className="concept-brand-mark" aria-hidden="true">
        <img src="/closesync-mark.png" alt="" width="512" height="512" />
      </span>
      <span className="concept-brand-wordmark">
        Close<span className="concept-brand-accent">Sync</span>
      </span>
      <span className="concept-brand-ai">AI</span>
    </span>
  );
}

function ConceptToolbar({ active }: { active: ConceptKey }) {
  return (
    <aside className="concept-toolbar" aria-label="Landing page concept selector">
      <div className="concept-toolbar-inner">
        <p>CloseSync concept preview</p>
        <nav aria-label="Choose a landing page concept">
          <Link to="/">Current</Link>
          {conceptKeys.map((key) => (
            <Link key={key} to={`/landing-concepts/${key}`} aria-current={active === key ? "page" : undefined}>
              {conceptLabels[key]}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function ConceptHeader({
  inverse = false,
  showPrimaryAction = true,
}: {
  inverse?: boolean;
  showPrimaryAction?: boolean;
}) {
  return (
    <header className={`concept-header${inverse ? " concept-header-inverse" : ""}`}>
      <Link to="/" aria-label="CloseSync AI home">
        <Brand inverse={inverse} />
      </Link>
      <nav className="concept-primary-nav" aria-label="Primary navigation">
        <a href="#product">Product</a>
        <a href="#workflow">Workflow</a>
        <a href="#pricing">Pricing</a>
      </nav>
      <div className="concept-header-actions">
        <Link className="concept-sign-in" to="/login">Sign in</Link>
        {showPrimaryAction ? (
          <Button asChild size="sm" className="concept-button-primary">
            <Link to="/signup">Start free</Link>
          </Button>
        ) : null}
      </div>
    </header>
  );
}

function ConceptActions({
  showSecondary = true,
  onStartFree,
}: {
  showSecondary?: boolean;
  onStartFree?: () => void;
}) {
  return (
    <div className="concept-actions">
      <Button asChild size="lg" className="concept-button-primary">
        <Link to="/signup" onClick={onStartFree}>
          Start free
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
      {showSecondary ? (
        <Button asChild size="lg" variant="outline" className="concept-button-secondary">
          <Link to="/sample">
            View sample proposal
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function RecordPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`concept-record${compact ? " concept-record-compact" : ""}`} aria-labelledby="concept-record-title">
      <header className="concept-record-header">
        <div>
          <p>Example client record</p>
          <h2 id="concept-record-title">Briar &amp; Co. - Brand refresh</h2>
        </div>
        <span className="concept-status">
          <span aria-hidden="true" />
          Active
        </span>
      </header>
      <div className="concept-record-body">
        <ol aria-label="Example client workflow">
          {recordEvents.map((event, index) => {
            const Icon = event.icon;
            const current = event.state === "In progress";
            return (
              <li key={event.label} aria-current={current ? "step" : undefined}>
                <span className={`concept-record-icon${current ? " is-current" : ""}`}>
                  <Icon aria-hidden="true" />
                </span>
                <span className="concept-record-copy">
                  <strong>{event.label}</strong>
                  <span>{event.detail}</span>
                </span>
                <span className={current ? "is-current" : undefined}>{event.state}</span>
                {index < recordEvents.length - 1 ? <span className="concept-record-line" aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ol>
        <aside aria-label="Example commercial summary">
          <p>Project value</p>
          <strong>GBP 4,800</strong>
          <div>
            <span>Next action</span>
            <b>Review onboarding response</b>
            <small>Due tomorrow, assigned to you</small>
          </div>
          <p className="concept-illustrative">Illustrative product data</p>
        </aside>
      </div>
    </section>
  );
}

function JourneyRail() {
  return (
    <ol className="concept-journey" aria-label="Connected client journey">
      {journey.map((stage, index) => (
        <li key={stage}>
          <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <strong>{stage}</strong>
        </li>
      ))}
    </ol>
  );
}

function PricingDecision({
  quiet = false,
  onStartFree,
}: {
  quiet?: boolean;
  onStartFree?: (location: Extract<LandingCtaLocation, "pricing_free" | "pricing_pro">) => void;
}) {
  return (
    <section id="pricing" className={`concept-pricing${quiet ? " concept-pricing-quiet" : ""}`}>
      <div className="concept-pricing-copy">
        <h2>Start with proposals. Connect the rest when you're ready.</h2>
        <p>Use Free to prepare your first proposals, then choose Pro for the close-to-kickoff workflow.</p>
      </div>
      <div className="concept-plan concept-plan-free">
        <div>
          <span>Free</span>
          <strong>GBP 0</strong>
          <small>per month</small>
        </div>
        <p>Two proposals each month, limited AI insights and no card required.</p>
        <Button asChild variant="outline" className="concept-button-secondary">
          <Link to="/signup" onClick={() => onStartFree?.("pricing_free")}>Start free</Link>
        </Button>
      </div>
      <div className="concept-plan concept-plan-pro">
        <div>
          <span>Pro</span>
          <strong>GBP 29</strong>
          <small>per month</small>
        </div>
        <ul>
          {proFeatures.map((feature) => (
            <li key={feature}>
              <Check aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>
        <Button asChild className="concept-button-primary">
          <Link to="/signup" onClick={() => onStartFree?.("pricing_pro")}>Create an account</Link>
        </Button>
      </div>
    </section>
  );
}

function ConceptFooter({
  inverse = false,
  includeLegal = false,
  onStartFree,
}: {
  inverse?: boolean;
  includeLegal?: boolean;
  onStartFree?: () => void;
}) {
  return (
    <footer className={`concept-footer${inverse ? " concept-footer-inverse" : ""}${includeLegal ? " concept-footer-with-legal" : ""}`}>
      <Brand inverse={inverse} />
      <p>CloseSync AI</p>
      <nav aria-label="Footer navigation">
        <Link to="/sample">Sample proposal</Link>
        <Link to="/login">Sign in</Link>
        <Link to="/signup" onClick={onStartFree}>Start free</Link>
      </nav>
      {includeLegal ? (
        <nav className="concept-footer-legal" aria-label="Legal information">
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </nav>
      ) : null}
    </footer>
  );
}

function EditorialConcept() {
  return (
    <div className="landing-concept concept-editorial" data-design-provenance="refero-attio-mobbin-tines-2026-08-25">
      <ConceptHeader />
      <main id="landing-main" tabIndex={-1}>
        <section className="editorial-hero">
          <div className="editorial-hero-copy">
            <h1>Every step, connected.</h1>
            <p>From first enquiry to paid onboarding, every decision, document and next step stays attached to one client.</p>
            <ConceptActions />
          </div>
          <RecordPanel compact />
        </section>

        <section id="workflow" className="editorial-journey-section">
          <div>
            <h2>One client. One record. Every handoff connected.</h2>
            <p>CloseSync keeps the operational story intact as a lead becomes active client work.</p>
          </div>
          <JourneyRail />
        </section>

        <section id="product" className="editorial-chapters">
          <div className="editorial-chapters-intro">
            <h2>Built around the way service work actually closes.</h2>
            <p>Fewer resets, fewer missing details and a clearer next action for you and your client.</p>
          </div>
          <div className="editorial-chapter-list">
            {closingChapters.map((chapter) => {
              const Icon = chapter.icon;
              return (
                <article key={chapter.title}>
                  <Icon aria-hidden="true" />
                  <h3>{chapter.title}</h3>
                  <p>{chapter.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="editorial-ai">
          <div>
            <Sparkles aria-hidden="true" />
            <h2>AI that works from the client record.</h2>
          </div>
          <p>Draft proposals, qualify enquiries and surface follow-ups using context that is already attached to the work.</p>
          <div className="editorial-ai-actions" aria-label="Example AI-assisted actions">
            <span>Draft proposal</span>
            <span>Summarise brief</span>
            <span>Find next action</span>
          </div>
        </section>

        <PricingDecision />

        <section className="concept-final-cta">
          <h2>Move the next client forward with less admin.</h2>
          <Button asChild size="lg" className="concept-button-primary">
            <Link to="/signup">
              Start free
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </main>
      <ConceptFooter />
    </div>
  );
}

function SystemMap() {
  const mapRef = useRef<HTMLElement>(null);
  const [isSequenced, setIsSequenced] = useState(false);
  const stages = [
    { label: "Enquiry", title: "New enquiry", state: "Complete", icon: Inbox },
    { label: "Qualification", title: "Qualified lead", state: "Complete", icon: ShieldCheck },
    { label: "Proposal", title: "Proposal sent", state: "Active", icon: FileCheck2 },
    { label: "Contract", title: "Agreement next", state: "Upcoming", icon: FileSignature },
    { label: "Payment", title: "Deposit follows", state: "Upcoming", icon: CreditCard },
    { label: "Onboarding", title: "Client setup", state: "Upcoming", icon: LayoutDashboard },
    { label: "Ongoing Work", title: "Project active", state: "Upcoming", icon: BriefcaseBusiness },
  ] as const;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsSequenced(true);
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setIsSequenced(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsSequenced(true);
        observer.disconnect();
      },
      { threshold: 0.18 },
    );

    observer.observe(map);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={mapRef}
      id="workflow"
      className={`system-map${isSequenced ? " is-sequenced" : ""}`}
      aria-labelledby="system-map-title"
    >
      <header>
        <h2 id="system-map-title">BrightStone website redesign</h2>
        <p>From first enquiry to ongoing work, every client step stays connected.</p>
      </header>
      <div className="system-map-body">
        <ol aria-label="Client workflow stages" tabIndex={0}>
          {stages.map((stage) => {
            const Icon = stage.icon;
            const active = stage.state === "Active";
            const complete = stage.state === "Complete";
            return (
              <li
                key={stage.label}
                className={active ? "is-active" : complete ? "is-complete" : "is-upcoming"}
                aria-current={active ? "step" : undefined}
              >
                <span className="system-stage-marker">
                  <Icon aria-hidden="true" />
                </span>
                <div className="system-stage-copy">
                  <span>{active ? "Active stage" : stage.state}</span>
                  <strong>{stage.label}</strong>
                  <small>{stage.title}</small>
                </div>
              </li>
            );
          })}
        </ol>
        <section
          id="system-active-stage"
          className="system-stage-preview"
          aria-labelledby="system-active-stage-title"
        >
          <div className="system-stage-preview-head">
            <span>Active stage · Proposal</span>
            <div>
              <h3 id="system-active-stage-title">Proposal sent</h3>
              <p>Website redesign proposal sent to BrightStone.</p>
            </div>
          </div>
          <dl>
            <div>
              <dt>Value</dt>
              <dd>£2,500</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>Darnell</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Awaiting decision</dd>
            </div>
          </dl>
          <div className="system-next-action">
            <span>Next action</span>
            <strong>Follow up with BrightStone</strong>
            <ArrowRight aria-hidden="true" />
          </div>
        </section>
      </div>
      <section className="system-map-ai" aria-labelledby="system-map-ai-title">
        <div className="system-map-ai-copy">
          <Sparkles aria-hidden="true" />
          <div>
            <h3 id="system-map-ai-title">Responsible AI, inside the workflow.</h3>
            <p>
              AI can draft, summarise and flag what needs attention. You stay in control, with important actions
              reviewable before they move forward.
            </p>
          </div>
        </div>
        <div className="system-map-ai-sequence" aria-label="AI assistance sequence">
          <span>Brief received</span>
          <ArrowRight aria-hidden="true" />
          <span>Draft prepared</span>
          <ArrowRight aria-hidden="true" />
          <span>Human review</span>
        </div>
      </section>
      <footer>
        <span>Illustrative product data</span>
        <span>Completed stages remain attached to the client record.</span>
      </footer>
    </section>
  );
}

export function WorkflowSystemLanding({
  onStartFree,
}: {
  onStartFree?: (location: LandingCtaLocation) => void;
}) {
  return (
    <div className="landing-shell landing-concept concept-system" data-design-provenance="refero-default-mobbin-intercom-stripe-2026-08-25">
      <ConceptHeader showPrimaryAction={false} />
      <main id="landing-main" tabIndex={-1}>
        <section className="system-hero">
          <div className="system-hero-intro">
            <div className="system-hero-heading">
              <h1>From first enquiry to signed, paid and ready to start.</h1>
            </div>
            <div className="system-hero-copy">
              <p>
                CloseSync AI is the close-to-kickoff workspace for freelancers, consultants and small agencies.
                Keep the brief, proposal, agreement, payment and onboarding linked to one client record.
              </p>
              <ConceptActions showSecondary={false} onStartFree={() => onStartFree?.("hero")} />
              <p className="system-trust-line">Create a Free account without entering card details.</p>
            </div>
          </div>
          <SystemMap />
        </section>

        <section className="system-assurances" aria-labelledby="system-assurances-title">
          <div className="system-assurances-copy">
            <h2 id="system-assurances-title">Built for the handoff after “yes”.</h2>
            <p>A proposal is only one step. Keep the agreement, payment and start of work in view.</p>
          </div>
          <dl className="system-assurance-list">
            <div>
              <dt>UK-first</dt>
              <dd>Designed first for UK freelancers, consultants and small agencies.</dd>
            </div>
            <div>
              <dt>Payments and signatures</dt>
              <dd>Paddle handles checkout. Unique signing links keep each timestamped electronic signature attached to its contract.</dd>
            </div>
            <div>
              <dt>Human review</dt>
              <dd>AI helps prepare drafts and summaries. You decide what to send.</dd>
            </div>
            <div>
              <dt>Clear pricing</dt>
              <dd>Free is £0. Pro is £29 per month.</dd>
            </div>
          </dl>
        </section>

        <section className="system-problem" aria-labelledby="system-problem-title">
          <div className="system-problem-inner">
            <div className="system-problem-copy">
              <h2 id="system-problem-title">The gap between “interested” and “ready to start” creates avoidable work.</h2>
              <p>
                Lead details live in one place, approvals in another, and onboarding starts without the decisions that
                came before. Every handoff creates another chance to lose context or miss the next action.
              </p>
            </div>
            <ul className="system-friction-list">
              {systemFriction.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </section>

        <section id="product" className="system-capabilities" aria-labelledby="system-capabilities-title">
          <div className="system-section-intro">
            <h2 id="system-capabilities-title">One client record from enquiry to kickoff.</h2>
            <p>
              CloseSync keeps the client record intact while you understand the opportunity, reach agreement and
              begin delivery.
            </p>
          </div>
          <div className="system-capability-list">
            {systemCapabilities.map((capability) => {
              const Icon = capability.icon;
              return (
                <article key={capability.title}>
                  <Icon aria-hidden="true" />
                  <h3>{capability.title}</h3>
                  <p>{capability.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <PricingDecision onStartFree={onStartFree} />
      </main>
      <ConceptFooter includeLegal onStartFree={() => onStartFree?.("footer")} />
    </div>
  );
}

function StudioConcept() {
  return (
    <div className="landing-concept concept-studio" data-design-provenance="refero-programa-mobbin-airtable-2026-08-25">
      <ConceptHeader />
      <main id="landing-main" tabIndex={-1}>
        <section className="studio-hero">
          <div className="studio-hero-copy">
            <h1>A calmer way to close clients.</h1>
            <p>CloseSync keeps the close organised, from the first brief to a paid and prepared client.</p>
            <ConceptActions />
          </div>
          <figure className="studio-hero-image">
            <img
              src={consultantProposalImage}
              alt="Consultant reviewing a client proposal beside a laptop in a quiet studio"
              width="1536"
              height="1024"
            />
          </figure>
        </section>

        <section className="studio-statement">
          <h2>Good client work should not begin with a scavenger hunt.</h2>
          <p>Keep the brief, proposal, agreement, payment and onboarding response together, ready when the work begins.</p>
        </section>

        <section id="product" className="studio-record-section">
          <div className="studio-record-copy">
            <h2>A client record that carries the relationship forward.</h2>
            <p>Each handoff adds context instead of creating another place to search.</p>
            <JourneyRail />
          </div>
          <RecordPanel />
        </section>

        <section id="workflow" className="studio-chapters">
          {closingChapters.map((chapter) => {
            const Icon = chapter.icon;
            return (
              <article key={chapter.title}>
                <Icon aria-hidden="true" />
                <h3>{chapter.title}</h3>
                <p>{chapter.description}</p>
              </article>
            );
          })}
        </section>

        <section className="studio-ai">
          <div>
            <Sparkles aria-hidden="true" />
            <h2>Use AI to prepare the work, with you in control.</h2>
          </div>
          <p>Draft from the real brief, review every important action and keep the result attached to the client.</p>
        </section>

        <PricingDecision quiet />

        <section className="concept-final-cta studio-final-cta">
          <h2>Give the next client a more considered experience.</h2>
          <ConceptActions />
        </section>
      </main>
      <ConceptFooter />
    </div>
  );
}

export default function LandingConcepts() {
  const { concept: conceptParam } = useParams();
  const concept: ConceptKey = isConceptKey(conceptParam) ? conceptParam : "editorial";
  const Concept = concept === "system" ? WorkflowSystemLanding : concept === "studio" ? StudioConcept : EditorialConcept;

  return (
    <>
      <PageMeta
        title={`${conceptLabels[concept]} | CloseSync landing concepts`}
        description="Private CloseSync landing page design concepts for local review."
        path={`/landing-concepts/${concept}`}
        noIndex
      />
      <ConceptToolbar active={concept} />
      <Concept />
    </>
  );
}
