import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useAIInsight: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/hooks/use-ai-insight", () => ({
  useAIInsight: mocks.useAIInsight,
}));

import WeeklyBriefingCard from "@/components/dashboard/WeeklyBriefingCard";

const briefing = {
  summary: "Strong week overall.",
  details: {
    headline: "Momentum is improving.",
    wins: ["Two proposals accepted"],
    worries: ["One renewal is overdue"],
    one_thing: "Call the overdue renewal client.",
  },
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

describe("weekly-briefing accessibility", () => {
  beforeEach(() => {
    mocks.useAIInsight.mockReset();
    mocks.refresh.mockReset();
    mocks.refresh.mockResolvedValue(undefined);
  });

  it("announces loading and completion and exposes a semantic heading structure", () => {
    mocks.useAIInsight.mockReturnValue(hookResult({ loading: true }));
    const { rerender } = render(<WeeklyBriefingCard />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading weekly briefing");
    expect(screen.getByRole("status").closest("[aria-busy='true']")).toBeInTheDocument();

    mocks.useAIInsight.mockReturnValue(hookResult({ insight: briefing }));
    act(() => rerender(<WeeklyBriefingCard />));

    expect(screen.getByRole("status")).toHaveTextContent("Weekly briefing ready.");
    expect(screen.getByRole("heading", { level: 2, name: "Weekly Briefing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Wins" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Watch" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "The one thing this week" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Wins" })).toHaveTextContent("Two proposals accepted");
    expect(screen.getByRole("list", { name: "Watch" })).toHaveTextContent("One renewal is overdue");
  });

  it("keeps an initial failure visible, focuses it, and offers retry", () => {
    mocks.useAIInsight.mockReturnValue(hookResult({ error: "Briefing service unavailable" }));
    render(<WeeklyBriefingCard />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Could not load the weekly briefing. Briefing service unavailable",
    );
    expect(alert).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Retry weekly briefing" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("preserves cached content when a refresh fails and offers retry", () => {
    mocks.useAIInsight.mockReturnValue(hookResult({
      insight: briefing,
      error: "Refresh timed out",
    }));
    render(<WeeklyBriefingCard />);

    expect(screen.getByText("Momentum is improving.")).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Could not refresh the weekly briefing. Refresh timed out",
    );
    expect(alert).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Retry weekly briefing" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
