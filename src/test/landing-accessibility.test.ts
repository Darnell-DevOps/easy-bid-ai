import { describe, expect, it } from "vitest";
import { readSource } from "./read-source";


describe("landing page accessibility", () => {
  const app = readSource("src/App.tsx");
  const landing = readSource("src/pages/Index.tsx");
  const workflow = readSource("src/pages/LandingConcepts.tsx");
  const styles = readSource("src/index.css");
  const workflowStyles = readSource("src/styles/landing-concepts.css");

  it("provides a first-position skip link and focusable main target", () => {
    expect(app).toContain("function RouteSkipLink()");
    expect(app.indexOf("<RouteSkipLink />")).toBeLessThan(app.indexOf("<PaymentTestModeBanner />"));
    expect(landing).toContain("<WorkflowSystemLanding");
    expect(workflow).toContain('<main id="landing-main" tabIndex={-1}>');
  });

  it("uses one interactive element for each styled call to action", () => {
    expect(workflow).toContain('<Button asChild size="lg" className="concept-button-primary">');
    expect(workflow).toContain('<Link to="/signup" onClick={onStartFree}>');
    expect(workflow).not.toMatch(/<button[^>]*>\s*<Link/);
  });

  it("does not reintroduce the audited low-contrast text colours", () => {
    for (const colour of ["#707b8f", "#748094", "#6c7789", "#8992a1"]) {
      expect(landing).not.toContain(colour);
      expect(workflow).not.toContain(colour);
      expect(workflowStyles).not.toContain(colour);
    }
  });

  it("keeps a strong keyboard focus indicator and visible skip-link state", () => {
    expect(styles).toContain(".landing-shell :is(a, button):focus-visible");
    expect(styles).toContain("outline: 3px solid var(--cs-primary)");
    expect(styles).toContain(".landing-skip-link:focus");
    expect(styles).toContain("transform: translateY(0)");
  });

  it("allows client workflow details to wrap at 400 percent reflow widths", () => {
    expect(workflowStyles).toContain(".system-stage-copy");
    expect(workflowStyles).toContain("min-width: 0;");
    expect(workflowStyles).toContain("overflow-wrap: anywhere;");
    expect(workflowStyles).toContain("@media (max-width: 420px)");
  });

  it("exposes the client preview as a labelled workflow with a current step", () => {
    expect(workflow).toContain('aria-labelledby="system-map-title"');
    expect(workflow).toContain('<ol aria-label="Client workflow stages">');
    expect(workflow).toContain('aria-current={active ? "step" : undefined}');
    expect(workflow).toContain('aria-labelledby="system-active-stage-title"');
  });
});
