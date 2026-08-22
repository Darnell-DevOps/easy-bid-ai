import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useAIInsight: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/hooks/use-ai-insight", () => ({
  useAIInsight: mocks.useAIInsight,
}));

import DealScoreBadge from "@/components/ai/DealScoreBadge";

const dealInsight = {
  score: 82,
  summary: "The client has engaged with the proposal repeatedly.",
  recommended_action: "Follow up while interest is high.",
};

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

describe("deal-score accessibility", () => {
  beforeEach(() => {
    mocks.useAIInsight.mockReset();
    mocks.refresh.mockReset();
    mocks.refresh.mockResolvedValue(undefined);
  });

  it("announces deal scoring as a busy status", () => {
    mocks.useAIInsight.mockReturnValue(hookResult({ loading: true }));
    render(<DealScoreBadge proposalId="proposal-1" />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Scoring");
    expect(status).toHaveAttribute("aria-busy", "true");
  });

  it("makes score details keyboard-focusable with a complete accessible name", async () => {
    mocks.useAIInsight.mockReturnValue(hookResult({ insight: dealInsight }));
    render(<DealScoreBadge proposalId="proposal-1" />);

    const scoreButton = screen.getByRole("button", {
      name: "Deal score 82 out of 100, Hot. Show score details",
    });
    act(() => scoreButton.focus());

    expect(scoreButton).toHaveFocus();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("The client has engaged with the proposal repeatedly.");
    expect(tooltip).toHaveTextContent("Follow up while interest is high.");
  });

  it("announces an initial failure and offers a visible retry", () => {
    mocks.useAIInsight.mockReturnValue(hookResult({ error: "Scoring service unavailable" }));
    render(<DealScoreBadge proposalId="proposal-1" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Deal score unavailable. Scoring service unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry score" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("preserves a cached score and provides retry after a refresh failure", () => {
    mocks.useAIInsight.mockReturnValue(hookResult({
      insight: dealInsight,
      error: "Refresh timed out",
    }));
    render(<DealScoreBadge proposalId="proposal-1" />);

    expect(screen.getByRole("button", {
      name: "Deal score 82 out of 100, Hot. Show score details",
    })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not refresh deal score. Refresh timed out");

    fireEvent.click(screen.getByRole("button", { name: "Retry deal score" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
