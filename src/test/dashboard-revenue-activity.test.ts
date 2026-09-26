import { describe, expect, it } from "vitest";
import { monthlyPaidProposals } from "@/components/dashboard/RevenueActivity";

describe("dashboard revenue presentation", () => {
  const today = new Date(2026, 1, 15, 12);
  it("groups recorded paid proposals into six calendar months across a year boundary", () => {
    const result = monthlyPaidProposals([
      { budget: "£1,250", client_paid: true, paid_at: "2025-12-10T12:00:00Z" },
      { budget: "750", client_paid: true, paid_at: "2025-12-20T12:00:00Z" },
      { budget: "200", client_paid: true, paid_at: "2026-02-01T12:00:00Z" },
    ], today);
    expect(result.map(({ label }) => label)).toEqual(["September 2025", "October 2025", "November 2025", "December 2025", "January 2026", "February 2026"]);
    expect(result.map(({ amount }) => amount)).toEqual([0, 0, 0, 2000, 0, 200]);
  });
  it("does not invent dates or include unpaid, invalid, future or older values", () => {
    const result = monthlyPaidProposals([
      { budget: "100", client_paid: false, paid_at: "2026-02-01T12:00:00Z" },
      { budget: "100", client_paid: true },
      { budget: "100", client_paid: true, paid_at: "invalid" },
      { budget: "100", client_paid: true, paid_at: "2026-02-20T12:00:00Z" },
      { budget: "100", client_paid: true, paid_at: "2025-08-31T12:00:00Z" },
      { budget: "TBC", client_paid: true, paid_at: "2026-02-01T12:00:00Z" },
    ], today);
    expect(result.every(({ amount }) => amount === 0)).toBe(true);
  });
});
