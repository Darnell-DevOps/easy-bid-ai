import { describe, expect, it } from "vitest";
import { readSource } from "./read-source";


describe("landing page accessibility", () => {
  const app = readSource("src/App.tsx");
  const landing = readSource("src/pages/Index.tsx");
  const styles = readSource("src/index.css");

  it("provides a first-position skip link and focusable main target", () => {
    expect(app).toContain("function RouteSkipLink()");
    expect(app.indexOf("<RouteSkipLink />")).toBeLessThan(app.indexOf("<PaymentTestModeBanner />"));
    expect(landing).toContain('<main id="landing-main" tabIndex={-1}>');
  });

  it("uses one interactive element for each styled call to action", () => {
    expect(landing.match(/<Button\b/g)).toHaveLength(4);
    expect(landing.match(/\basChild\b/g)).toHaveLength(4);
  });

  it("does not reintroduce the audited low-contrast text colours", () => {
    for (const colour of ["#707b8f", "#748094", "#6c7789", "#8992a1"]) {
      expect(landing).not.toContain(colour);
    }
  });

  it("keeps a strong keyboard focus indicator and visible skip-link state", () => {
    expect(styles).toContain(".landing-shell :is(a, button):focus-visible");
    expect(styles).toContain("outline: 3px solid var(--cs-primary)");
    expect(styles).toContain(".landing-skip-link:focus");
    expect(styles).toContain("transform: translateY(0)");
  });

  it("allows client workflow details to wrap at 400 percent reflow widths", () => {
    expect(landing).not.toContain("block truncate text-xs");
    expect(landing).toContain(
      'block break-words text-xs leading-5 text-[color:var(--cs-text-secondary)] sm:truncate',
    );
  });

  it("exposes the client preview as a labelled workflow with a current step", () => {
    expect(landing).toContain('aria-labelledby="landing-client-record-label landing-client-record-name"');
    expect(landing).toContain('<ol aria-label="Client workflow"');
    expect(landing).toContain('aria-current={isCurrent ? "step" : undefined}');
    expect(landing).toContain('aria-label="Commercial summary"');
  });
});
