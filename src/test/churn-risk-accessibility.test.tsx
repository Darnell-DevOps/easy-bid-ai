import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useAIInsight: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/hooks/use-ai-insight", () => ({
  useAIInsight: mocks.useAIInsight,
}));

import ChurnRiskCard from "@/components/ai/ChurnRiskCard";

const highRiskInsight = {
  score: 78,
  summary: "Engagement has fallen during the last month.",
  recommended_action: "Schedule a check-in this week.",
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

describe("churn-risk accessibility", () => {
  beforeEach(() => {
    mocks.useAIInsight.mockReset();
    mocks.refresh.mockReset();
    mocks.refresh.mockResolvedValue(undefined);
  });

  it("announces initial loading and the completed risk using text rather than colour alone", async () => {
    mocks.useAIInsight.mockReturnValue(hookResult({ loading: true }));
    const view = render(<ChurnRiskCard retainerId="retainer-1" />);

    const loadingStatus = screen.getByRole("status");
    expect(loadingStatus).toHaveTextContent("Loading churn risk");
    expect(loadingStatus.closest("[aria-busy='true']")).not.toBeNull();

    mocks.useAIInsight.mockReturnValue(hookResult({ insight: highRiskInsight }));
    view.rerender(<ChurnRiskCard retainerId="retainer-1" />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(
      "Churn risk ready. High risk, 78 out of 100.",
    ));
    expect(screen.getByText("High risk")).toBeInTheDocument();
    expect(screen.getByText("78/100")).toBeInTheDocument();
  });

  it("announces refresh progress and preserves the score after a focused failure", async () => {
    mocks.useAIInsight.mockReturnValue(hookResult({ insight: highRiskInsight }));
    const view = render(<ChurnRiskCard retainerId="retainer-1" />);

    mocks.useAIInsight.mockReturnValue(hookResult({ insight: highRiskInsight, generating: true }));
    view.rerender(<ChurnRiskCard retainerId="retainer-1" />);
    expect(await screen.findByRole("status")).toHaveTextContent("Refreshing churn risk.");
    expect(screen.getByText("Churn Risk").closest("[aria-busy='true']")).not.toBeNull();

    mocks.useAIInsight.mockReturnValue(hookResult({
      insight: highRiskInsight,
      error: "Risk service timed out",
    }));
    view.rerender(<ChurnRiskCard retainerId="retainer-1" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not refresh churn risk. Risk service timed out");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByText("78/100")).toBeInTheDocument();
  });

  it("focuses an initial failure and provides a retry control", async () => {
    mocks.useAIInsight.mockReturnValue(hookResult({ error: "Risk service unavailable" }));
    render(<ChurnRiskCard retainerId="retainer-1" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not check churn risk. Risk service unavailable");
    await waitFor(() => expect(alert).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Retry risk check" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
