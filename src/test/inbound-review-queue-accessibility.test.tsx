import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  rpc: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query = {
        select: () => query,
        in: () => query,
        order: () => query,
        limit: mocks.limit,
      };
      return query;
    },
    rpc: mocks.rpc,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

import InboundReviewQueue from "@/components/leads/InboundReviewQueue";

const reviewMessage = {
  id: "message-1",
  from_email: "lead@example.com",
  from_name: "Potential Client",
  subject: "Project enquiry",
  body_text: "Could you send me a proposal?",
  received_at: "2026-08-19T12:00:00.000Z",
  classification: "needs_review",
  classification_reason: "Possible sales enquiry",
  client_id: null,
};

const ignoredMessage = {
  ...reviewMessage,
  id: "message-2",
  classification: "ignored",
  classification_reason: "Automated notification",
};

function renderQueue() {
  return render(
    <MemoryRouter>
      <InboundReviewQueue />
    </MemoryRouter>,
  );
}

describe("inbound review queue accessibility", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("announces the initial queue loading state", async () => {
    let finishLoading: ((value: unknown) => void) | undefined;
    mocks.limit.mockReturnValue(new Promise((resolve) => {
      finishLoading = resolve;
    }));
    renderQueue();

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading inbound queue");
    expect(status.closest("div[aria-busy='true']")).not.toBeNull();

    await act(async () => finishLoading?.({ data: [], error: null }));
    await waitFor(() => expect(screen.queryByText("Loading inbound queue…")).not.toBeInTheDocument());
  });

  it("focuses a load failure and provides a working retry", async () => {
    mocks.limit
      .mockResolvedValueOnce({ data: null, error: { message: "Database unavailable" } })
      .mockResolvedValueOnce({ data: [], error: null });
    renderQueue();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load the inbound review queue. Database unavailable");
    await waitFor(() => expect(alert).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Retry loading queue" }));

    await waitFor(() => expect(mocks.limit).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("exposes the ignored-message disclosure state and controlled region", async () => {
    mocks.limit.mockResolvedValue({ data: [ignoredMessage], error: null });
    renderQueue();

    const toggle = await screen.findByRole("button", { name: "Ignored (1)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "inbound-ignored-list");
    expect(document.getElementById("inbound-ignored-list")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("inbound-ignored-list")).toBeInTheDocument();
  });

  it("focuses action failures while keeping the queue operable", async () => {
    mocks.limit.mockResolvedValue({ data: [reviewMessage], error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Permission denied" } });
    renderQueue();

    fireEvent.click(await screen.findByRole("button", { name: "Convert to lead" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not convert this message. Permission denied");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByRole("button", { name: "Convert to lead" })).toBeEnabled();
  });

  it("announces a successful ignore action", async () => {
    mocks.limit.mockResolvedValue({ data: [reviewMessage], error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    renderQueue();

    fireEvent.click(await screen.findByRole("button", { name: "Ignore" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Message ignored."));
  });
});
