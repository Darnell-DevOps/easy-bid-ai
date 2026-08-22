import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import RouteAccessibility, { getRouteTitle } from "@/components/RouteAccessibility";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("route accessibility", () => {
  it("provides meaningful titles for public, dashboard, dynamic, and unknown routes", () => {
    expect(getRouteTitle("/")).toBe("CloseSync - Client operations, in one place");
    expect(getRouteTitle("/login")).toBe("Sign in | CloseSync AI");
    expect(getRouteTitle("/dashboard/clients/123")).toBe("Client details | CloseSync AI");
    expect(getRouteTitle("/dashboard/policies/new")).toBe("New policy | CloseSync AI");
    expect(getRouteTitle("/missing-page")).toBe("Page not found | CloseSync AI");
  });

  it("keeps every concrete application route covered by the title registry", () => {
    const app = source("src/App.tsx");
    const routePatterns = [...app.matchAll(/<Route path="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((path) => !path.includes("*"));

    for (const routePattern of routePatterns) {
      const concretePath = routePattern.replace(/:[^/]+/g, "example");
      expect(getRouteTitle(concretePath), routePattern).not.toBe("Page not found | CloseSync AI");
    }
  });

  it("updates the title and focuses the destination heading after SPA navigation", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <RouteAccessibility />
        <Routes>
          <Route path="/login" element={<main><h1>Sign in</h1><Link to="/dashboard">Continue</Link></main>} />
          <Route path="/dashboard" element={<main><h1>Dashboard</h1></main>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(document.title).toBe("Sign in | CloseSync AI");
    fireEvent.click(screen.getByRole("link", { name: "Continue" }));

    const heading = await screen.findByRole("heading", { level: 1, name: "Dashboard" });
    await waitFor(() => {
      expect(document.title).toBe("Dashboard | CloseSync AI");
      expect(heading).toHaveFocus();
    });
  });

  it("keeps the shared handler mounted and provides dashboard bypass navigation", () => {
    const app = source("src/App.tsx");
    const layout = source("src/components/DashboardLayout.tsx");
    const notFound = source("src/pages/NotFound.tsx");

    expect(app).toContain("<RouteAccessibility />");
    expect(app).toContain('pathname.startsWith("/dashboard")');
    expect(app).toContain('<a href={`#${targetId}`} className="landing-skip-link">');
    expect(app.indexOf("<RouteSkipLink />")).toBeLessThan(app.indexOf("<PaymentTestModeBanner />"));
    expect(layout).not.toContain('href="#dashboard-main"');
    expect(layout).toContain('id="dashboard-main" tabIndex={-1}');
    expect(notFound).toContain('id={location.pathname.startsWith("/dashboard") ? "dashboard-main" : undefined}');
  });

  it("keeps authenticated detail routes anchored by page-level headings", () => {
    const proposal = source("src/pages/ProposalView.tsx");
    const proposalDocumentHeader = source("src/components/proposal/ProposalHeader.tsx");
    const onboardingResponse = source("src/pages/OnboardingResponseDetail.tsx");

    expect(proposal).toContain('<h1 className="sr-only">Proposal details</h1>');
    expect(proposal).toContain('<span className="sr-only">Proposal details for </span>');
    expect(proposal).toContain('<h1 className="text-2xl font-bold text-foreground">Proposal not found</h1>');
    expect(proposalDocumentHeader).toContain('<h2 className="text-3xl lg:text-5xl');
    expect(proposalDocumentHeader).not.toContain("<h1");

    expect(onboardingResponse).toContain('<h1 className="sr-only">Onboarding response</h1>');
    expect(onboardingResponse).toContain('<span className="sr-only">Onboarding response for </span>');
    expect(onboardingResponse).toContain(
      '<h1 className="text-base font-semibold text-foreground">Onboarding form not found</h1>',
    );
    expect(onboardingResponse).toContain(
      '<h2 className="text-base font-semibold leading-6 tracking-[-0.01em] text-foreground">{g.group}</h2>',
    );
  });
});
