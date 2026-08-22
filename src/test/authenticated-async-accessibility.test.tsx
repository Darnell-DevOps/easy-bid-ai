import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AccessibleLoadingState } from "@/components/ui/accessible-loading-state";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("authenticated asynchronous accessibility", () => {
  it("announces the shared loading state and hides its decorative spinner", () => {
    const { container } = render(<AccessibleLoadingState label="Loading contracts" />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Loading contracts")).toHaveClass("sr-only");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses announced loading states across core authenticated routes", () => {
    const expectedLabels: Record<string, string> = {
      "src/components/AuthGuard.tsx": "Checking your session",
      "src/pages/Clients.tsx": "Loading clients",
      "src/pages/ClientDetail.tsx": "Loading client details",
      "src/pages/ProposalsDashboard.tsx": "Loading proposals",
      "src/pages/ContractsPage.tsx": "Loading contracts",
      "src/pages/ContractDetail.tsx": "Loading contract details",
      "src/pages/EmailsDashboard.tsx": "Loading email activity",
      "src/pages/LeadInbox.tsx": "Loading lead inbox",
      "src/pages/OnboardingDashboard.tsx": "Loading client onboarding",
      "src/pages/LeadFormsDashboard.tsx": "Loading lead forms",
      "src/pages/LeadFormEditor.tsx": "Loading lead form editor",
      "src/pages/OnboardingResponseDetail.tsx": "Loading onboarding response",
      "src/pages/ProposalView.tsx": "Loading proposal details",
      "src/pages/Trash.tsx": "Loading deleted clients",
      "src/pages/TimeSavedDashboard.tsx": "Loading time-saved data",
      "src/pages/Templates.tsx": "Loading templates",
    };

    for (const [path, label] of Object.entries(expectedLabels)) {
      const page = source(path);
      expect(page, path).toContain("<AccessibleLoadingState");
      expect(page, path).toContain(`label="${label}"`);
    }
  });

  it("marks core long-running action buttons as busy", () => {
    const expectations: Record<string, string[]> = {
      "src/pages/ContractsPage.tsx": ["aria-busy={creating}"],
      "src/pages/ContractDetail.tsx": ["aria-busy={downloading}", "aria-busy={sending}", "aria-busy={markingSent}"],
      "src/pages/EmailsDashboard.tsx": ["aria-busy={sending}"],
      "src/pages/LeadInbox.tsx": ["aria-busy={requalifying}"],
      "src/pages/OnboardingDashboard.tsx": ["aria-busy={remindingId === f.id}"],
      "src/pages/LeadFormsDashboard.tsx": ["aria-busy={creating}"],
      "src/pages/LeadFormEditor.tsx": ["aria-busy={saving}"],
    };

    for (const [path, attributes] of Object.entries(expectations)) {
      const page = source(path);
      for (const attribute of attributes) expect(page, path).toContain(attribute);
    }
  });
});
