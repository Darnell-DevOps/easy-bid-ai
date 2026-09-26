import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import OnboardingProgressTracker from "@/components/onboarding/OnboardingProgressTracker";
import ProjectProgressTracker from "@/components/portal/ProjectProgressTracker";
import DealProgressTracker from "@/components/proposal/DealProgressTracker";
import { Progress } from "@/components/ui/progress";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("progress accessibility", () => {
  it("exposes a named numeric progress value", () => {
    render(<Progress value={42} aria-label="Upload progress" aria-valuetext="42 of 100 files" />);

    const progress = screen.getByRole("progressbar", { name: "Upload progress" });
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "100");
    expect(progress).toHaveAttribute("aria-valuenow", "42");
    expect(progress).toHaveAttribute("aria-valuetext", "42 of 100 files");
  });

  it("identifies deal stages and the current step without relying on colour", () => {
    render(<DealProgressTracker currentStage="accepted" />);

    const list = screen.getByRole("list", { name: "Deal progress" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(list.querySelector('[aria-current="step"]')).toHaveTextContent("Accepted — Current step");
    expect(within(list).getByText(/Sent/).closest("li")).toHaveTextContent("Complete");
    expect(within(list).getByText(/Paid/).closest("li")).toHaveTextContent("Pending");
  });

  it("keeps compact project stages named and exposes the current step", () => {
    render(<OnboardingProgressTracker currentStage="onboarding" compact />);

    const list = screen.getByRole("list", { name: "Project progress" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(6);
    expect(list.querySelector('[aria-current="step"]')).toHaveTextContent("Onboarding — Current step");
    expect(within(list).getByText(/Proposal/).closest("li")).toHaveTextContent("Complete");
    expect(within(list).getByText(/Project Ready/).closest("li")).toHaveTextContent("Pending");
  });

  it("marks the active detailed project stage as the current step", () => {
    render(<ProjectProgressTracker currentStage="payment" />);

    const list = screen.getByRole("list", { name: "Project progress" });
    expect(list.querySelector('[aria-current="step"]')).toHaveTextContent("Payment");
    expect(list.querySelector('[aria-current="step"]')).toHaveTextContent("In progress");
  });

  it("keeps application progress bars named and decorative landing indicators hidden", () => {
    const namedProgressSources = [
      "src/pages/Billing.tsx",
      "src/pages/NewProposal.tsx",
      "src/pages/OnboardingDashboard.tsx",
      "src/pages/OnboardingResponseDetail.tsx",
      "src/pages/OnboardingFormPage.tsx",
      "src/components/portal/ProjectOverview.tsx",
    ].map(source).join("\n");

    const progressBlocks = namedProgressSources.match(/<(?:Progress|div)\b[^>]*(?:role="progressbar"|aria-label="[^"]*(?:progress|usage|completion)[^"]*")[^>]*>/gi) ?? [];
    expect(progressBlocks.length).toBeGreaterThanOrEqual(6);
    for (const block of progressBlocks) {
      expect(block).toMatch(/aria-label=|aria-labelledby=/);
    }

    expect(source("src/components/landing/ClientPortalShowcase.tsx")).toContain(
      '<div aria-hidden="true" className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">',
    );
    expect(source("src/components/landing/AiRetainersScroller.tsx")).toContain('aria-hidden="true"');
    expect(source("src/pages/ProposalView.tsx")).toContain('aria-current={isActive ? "step" : undefined}');
    expect(source("src/pages/ProposalView.tsx")).toContain('aria-label={`${stage.label}: ${stageStatus}`}');
  });
});
