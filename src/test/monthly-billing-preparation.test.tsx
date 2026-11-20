import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RetainerBillingReview from "@/components/retainers/RetainerBillingReview";
import { currentBillingMonth, type MonthlyFee } from "@/lib/retainer-billing";

const api = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: api }));

const month = currentBillingMonth();
const fee = (overrides: Partial<MonthlyFee> = {}): MonthlyFee => ({
  retainer_id: "monthly-1", client_name: "Maple Studio", title: "Monthly search",
  billing_due_date: `${month}-28`, amount_cents: 150000, currency: "GBP",
  preparation_state: "needs_preparation", ...overrides,
});
const show = () => render(<MemoryRouter><RetainerBillingReview retainers={[]} /></MemoryRouter>);

beforeEach(() => {
  api.rpc.mockReset();
  api.from.mockReset();
  const query = { select: vi.fn(), or: vi.fn(), order: vi.fn(), then: vi.fn() };
  query.select.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.then.mockImplementation((resolve) => Promise.resolve({ data: [], error: null }).then(resolve));
  api.from.mockReturnValue(query);
  api.rpc.mockResolvedValue({ data: [fee()], error: null });
});
afterEach(cleanup);

describe("monthly billing preparation", () => {
  it("previews each currency and explains excluded fees before preparing anything", async () => {
    api.rpc.mockResolvedValue({ data: [fee(), fee({ retainer_id: "monthly-2", client_name: "Dollar Studio", amount_cents: 10050, currency: "USD" }),
      fee({ retainer_id: "monthly-3", client_name: "Ended Studio", preparation_state: "ends_before_due_date" })], error: null });
    show();
    expect(await screen.findByText("2 monthly fees are due for preparation.")).toBeVisible();
    expect(screen.getByText("£1,500.00")).toBeVisible();
    expect(screen.getByText(/\$100\.50/)).toBeVisible();
    fireEvent.click(screen.getByText("1 fee excluded"));
    expect(screen.getByText(/The agreement ends before its billing day/)).toBeVisible();
    expect(screen.getByText(/does not send invoices or collect payments/)).toBeVisible();
    expect(api.rpc).not.toHaveBeenCalledWith("prepare_retainer_billing_month", expect.anything());
  });

  it("prepares all due fees once and disables submission while the request is pending", async () => {
    let finish!: (result: object) => void;
    let prepared = false;
    api.rpc.mockImplementation((name) => name === "prepare_retainer_billing_month"
      ? new Promise((resolve) => { finish = (result) => { prepared = true; resolve(result); }; })
      : Promise.resolve({ data: [fee({ preparation_state: prepared ? "prepared" : "needs_preparation" })], error: null }));
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Prepare monthly fees" }));
    expect(screen.getByRole("button", { name: "Preparing fees…" })).toBeDisabled();
    expect(screen.getByLabelText("Billing month")).toBeDisabled();
    finish({ data: { prepared: 1, unchanged: 0, excluded: 0 }, error: null });
    expect(await screen.findByText("1 monthly fee prepared. Review the lines before invoicing.")).toBeVisible();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Prepare monthly fees" })).not.toBeInTheDocument());
    expect(api.rpc.mock.calls.filter(([name]) => name === "prepare_retainer_billing_month")).toEqual([
      ["prepare_retainer_billing_month", { _month: `${month}-01` }],
    ]);
  });

  it("refreshes after an uncertain response and allows a safe retry without claiming success", async () => {
    api.rpc.mockImplementation((name) => Promise.resolve(name === "prepare_retainer_billing_month"
      ? { data: null, error: { message: "connection lost" } }
      : { data: [fee()], error: null }));
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Prepare monthly fees" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not confirm monthly fee preparation");
    await waitFor(() => expect(screen.getByRole("button", { name: "Prepare monthly fees" })).toBeEnabled());
    expect(screen.queryByText(/fee prepared\./)).not.toBeInTheDocument();
  });

  it("blocks preparation when the fee preview cannot be loaded and recovers on refresh", async () => {
    api.rpc.mockResolvedValueOnce({ data: null, error: { message: "unavailable" } });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this review");
    expect(screen.queryByRole("button", { name: "Prepare monthly fees" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("button", { name: "Prepare monthly fees" })).toBeEnabled();
  });

  it("does not offer to prepare a month whose fee is already paid", async () => {
    api.rpc.mockResolvedValue({ data: [fee({ preparation_state: "already_paid" })], error: null });
    show();
    expect(await screen.findByText("No monthly fees need preparation for this month.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Prepare monthly fees" })).not.toBeInTheDocument();
  });
});
