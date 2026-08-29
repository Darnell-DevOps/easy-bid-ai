import { describe, expect, it } from "vitest";
import { readSource } from "./read-source";

describe("landing page design concepts", () => {
  const app = readSource("src/App.tsx");
  const page = readSource("src/pages/LandingConcepts.tsx");
  const styles = readSource("src/styles/landing-concepts.css");
  const routes = readSource("src/components/RouteAccessibility.tsx");

  it("keeps the concepts isolated from the current landing page", () => {
    expect(app).toContain('<Route path="/" element={<Index />} />');
    expect(app).toContain('<Route path="/landing-concepts" element={<LandingConcepts />} />');
    expect(app).toContain('<Route path="/landing-concepts/:concept" element={<LandingConcepts />} />');
  });

  it("provides three traceable and visibly distinct directions", () => {
    expect(page.match(/data-design-provenance=/g)).toHaveLength(3);
    expect(page).toContain("refero-attio-mobbin-tines-2026-08-25");
    expect(page).toContain("refero-default-mobbin-intercom-stripe-2026-08-25");
    expect(page).toContain("refero-programa-mobbin-airtable-2026-08-25");
    expect(page).toContain("concept-editorial");
    expect(page).toContain("concept-system");
    expect(page).toContain("concept-studio");
  });

  it("keeps preview content honest, private, and keyboard reachable", () => {
    expect(page).toContain("Example client record");
    expect(page).toContain("Illustrative product data");
    expect(page).toContain("noIndex");
    expect(page).toContain('<main id="landing-main" tabIndex={-1}>');
    expect(page).toContain('aria-label="Choose a landing page concept"');
    expect(page).toContain('aria-current={active === key ? "page" : undefined}');
  });

  it("retains real public actions and route titles", () => {
    expect(page).toContain('<Link to="/signup">Start free</Link>');
    expect(page).toContain('<Link className="concept-sign-in" to="/login">Sign in</Link>');
    expect(page).toContain('<Link to="/sample">');
    expect(page).toContain("<ConceptActions showSecondary={false} />");
    expect(page).toContain("<ConceptHeader showPrimaryAction={false} />");
    expect(page).toContain('className="system-hero-intro"');
    expect(page).not.toContain("View a sample workflow");
    expect(page).toContain("Create a Free account without entering card details.");
    expect(routes).toContain('{ path: "/landing-concepts", title: "Landing page concepts | CloseSync AI" }');
    expect(routes).toContain('{ path: "/landing-concepts/:concept", title: "Landing page concept | CloseSync AI" }');
  });

  it("uses the CloseSync token layer without arbitrary colours", () => {
    expect(page).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(styles).toContain("var(--cs-primary)");
    expect(styles).toContain("var(--cs-bg-page)");
    expect(styles).toContain("var(--cs-font-sans)");
  });

  it("uses the existing CloseSync mark without replacing the accessible wordmark", () => {
    expect(page).toContain('<img src="/closesync-mark.png" alt="" width="512" height="512" />');
    expect(page).toContain('className="concept-brand-mark" aria-hidden="true"');
    expect(page).toContain('aria-label="CloseSync AI"');
    expect(styles).toContain(".concept-brand-mark img");
  });

  it("guards motion and mobile reflow", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(styles).toContain("@media (max-width: 767px)");
    expect(styles).toContain("min-height: 48px");
    expect(styles).toContain("overflow-x: visible");
    expect(page).toContain("consultantProposalImage");
  });

  it("models the selected hero as one continuous seven-stage workflow", () => {
    expect(page).toContain('id="workflow"');
    expect(page).toContain('className={`system-map${isSequenced ? " is-sequenced" : ""}`}');
    expect(page).toContain('aria-label="Client workflow stages"');
    expect(page).toContain('{ label: "Ongoing Work", title: "Project active"');
    expect(page).toContain('aria-current={active ? "step" : undefined}');
    expect(page).toContain("Website redesign proposal sent to BrightStone.");
    expect(page).toContain("Follow up with BrightStone");
    expect(page).toContain('className="system-map-body"');
    expect(page).toContain('className="system-stage-preview"');
    expect(styles).toContain("grid-template-columns: minmax(180px, 0.42fr) minmax(0, 1.58fr)");
    expect(styles).toContain("scroll-snap-type: x proximity");
    expect(styles).toContain("@media (max-width: 420px)");
  });

  it("animates the workflow as one bounded, reduced-motion-safe sequence", () => {
    expect(page).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(page).toContain("IntersectionObserver");
    expect(page).toContain("is-sequenced");
    expect(styles).toContain("system-stage-confirm");
    expect(styles).toContain("system-preview-arrive");
    expect(styles).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(styles).not.toContain("system-connector-progress");
    expect(styles).not.toContain("system-current-step");
  });

  it("gives the selected concept a deliberate proof-to-conversion reading order", () => {
    expect(page).toMatch(
      /className="system-hero"[\s\S]*className="system-assurances"[\s\S]*className="system-problem"[\s\S]*className="system-capabilities"[\s\S]*className="system-ai"[\s\S]*<PricingDecision \/>/,
    );
    expect(page).toContain("Designed first for UK freelancers, consultants and small agencies.");
    expect(page).toContain("Paddle handles checkout.");
    expect(page).toContain("You review important actions before they move forward.");
    expect(page).toContain("Free is £0. Pro is £29 per month.");
    expect(page).toContain("Two proposals each month");
    expect(page).not.toContain("Start 7-day trial");
    expect(page).toContain("Disconnected tools turn simple handoffs into avoidable work.");
    expect(page).toContain("Three moments. One connected workflow.");
    expect(page).toContain("Responsible AI, inside the workflow.");
    expect(page).not.toContain("system-record-proof");
    expect(page).not.toContain("system-final-cta");
    expect(page).not.toContain("system-outcomes");
    expect(styles).not.toContain(".system-record-proof");
    expect(styles).not.toContain(".system-final-cta");
    expect(styles).not.toContain(".system-outcomes");
    expect(styles).toContain("grid-template-columns: minmax(0, 1.15fr) repeat(2, minmax(260px, 0.85fr));");
    expect(styles).not.toContain(".concept-system .concept-pricing");
    expect(styles).not.toContain(".concept-system .concept-plan");
  });
});
