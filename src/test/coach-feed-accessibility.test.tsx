import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useAIInsight: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/hooks/use-ai-insight", () => ({
  useAIInsight: mocks.useAIInsight,
}));

import CoachFeedWidget from "@/components/dashboard/CoachFeedWidget";

const firstAction = {
  title: "Follow up with Acme",
  reasoning: "The proposal has been open for three days.",
  recommended_action: "Send a short check-in today.",
  severity: "critical",
  category: "follow_up",
};

const secondAction = {
  title: "Review renewal",
  reasoning: "The renewal date is approaching.",
  recommended_action: "Schedule a renewal call.",
  severity: "warning",
  category: "retainer",
};

function insightWith(actions: unknown[]) {
  return { details: { actions } };
}

function hookResult(overrides: Record<string, unknown> = {}) {
  return {
    insight: null,
    loading: false,
    generating: false,
    error: null,
    refresh: mocks.refresh,
    ...overrides,
  };
}

describe("AI Sales Coach accessibility", () => {
  beforeEach(() => {
    mocks.useAIInsight.mockReset();
    mocks.refresh.mockReset();
    mocks.refresh.mockResolvedValue(undefined);
  });

  it("announces initial loading and exposes recommendations as a prioritised list", async () => {
    mocks.useAIInsight.mockReturnValue(hookResult({ loading: true }));
    const view = render(<CoachFeedWidget />);

    const loadingStatus = screen.getByRole("status");
    expect(loadingStatus).toHaveTextContent("Loading AI Sales Coach recommendations.");
    expect(loadingStatus.closest("[aria-busy='true']")).not.toBeNull();
    expect(document.querySelector(".animate-pulse")?.parentElement).toHaveAttribute("aria-hidden", "true");

    mocks.useAIInsight.mockReturnValue(hookResult({ insight: insightWith([firstAction]) }));
    view.rerender(<CoachFeedWidget />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(
      "AI Sales Coach recommendations ready. 1 recommendation.",
    ));
    const list = screen.getByRole("list", { name: "AI Sales Coach recommendations" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("Priority: critical.")).toBeInTheDocument();
  });

  it("announces refresh progress and the updated recommendation count", async () => {
    mocks.useAIInsight.mockReturnValue(hookResult({ insight: insightWith([firstAction]) }));
    const view = render(<CoachFeedWidget />);

    mocks.useAIInsight.mockReturnValue(hookResult({
      insight: insightWith([firstAction]),
      generating: true,
    }));
    view.rerender(<CoachFeedWidget />);

    expect(await screen.findByRole("status")).toHaveTextContent("Refreshing AI Sales Coach recommendations.");
    const refreshButton = screen.getByRole("button", { name: "Refresh" });
    expect(refreshButton).toBeDisabled();
    expect(refreshButton).toHaveAttribute("aria-busy", "true");

    mocks.useAIInsight.mockReturnValue(hookResult({
      insight: insightWith([firstAction, secondAction]),
    }));
    view.rerender(<CoachFeedWidget />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(
      "AI Sales Coach recommendations ready. 2 recommendations.",
    ));
  });

  it("focuses a persistent refresh failure while preserving existing recommendations", async () => {
    mocks.useAIInsight.mockReturnValue(hookResult({
      insight: insightWith([firstAction]),
      error: "The coach service timed out",
    }));
    render(<CoachFeedWidget />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not update the AI Sales Coach. The coach service timed out");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByText("Follow up with Acme")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
