import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

import ClientBriefCard from "@/components/ai/ClientBriefCard";

const brief = {
  relationship: "Long-term client",
  lifetime_value: "£12,500",
  last_touch: "Proposal sent yesterday",
  risk: "Low",
  next_move: "Follow up on Friday",
};

describe("AI client brief accessibility", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.toast.mockReset();
  });

  it("announces generation progress and completion", async () => {
    let finishGeneration: ((value: unknown) => void) | undefined;
    mocks.invoke.mockReturnValue(new Promise((resolve) => {
      finishGeneration = resolve;
    }));
    render(<ClientBriefCard clientId="client-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Generate brief" }));

    const loadingStatus = screen.getByRole("status");
    expect(loadingStatus).toHaveTextContent("Reading the relationship");
    expect(loadingStatus.closest("[aria-busy='true']")).not.toBeNull();

    await act(async () => finishGeneration?.({ data: brief, error: null }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("AI client brief ready."));
    expect(screen.getByText("Long-term client")).toBeInTheDocument();
  });

  it("focuses a persistent generation error and leaves retry available", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { message: "AI service unavailable" } });
    render(<ClientBriefCard clientId="client-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Generate brief" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not generate the client brief. AI service unavailable");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByRole("button", { name: "Generate brief" })).toBeEnabled();
    expect(mocks.toast).toHaveBeenCalled();
  });

  it("keeps the existing brief visible after a focused refresh error", async () => {
    mocks.invoke
      .mockResolvedValueOnce({ data: brief, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Refresh timed out" } });
    render(<ClientBriefCard clientId="client-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Generate brief" }));
    const refreshButton = await screen.findByRole("button", { name: "Refresh" });
    fireEvent.click(refreshButton);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not generate the client brief. Refresh timed out");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByText("Long-term client")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });
});
