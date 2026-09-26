import { describe, expect, it } from "vitest";
import { canSendFollowUp } from "@/lib/follow-up";

describe("manual proposal follow-up eligibility", () => {
  it("does not offer a follow-up before a proposal is sent or after it is closed", () => {
    for (const status of ["draft", "rejected", "paid", null]) {
      expect(canSendFollowUp({ status })).toBe(false);
    }
    expect(canSendFollowUp({ status: "accepted", client_paid: true })).toBe(false);
  });

  it("allows a manual follow-up while a sent proposal awaits action", () => {
    for (const status of ["sent", "viewed", "accepted"]) {
      expect(canSendFollowUp({ status, client_paid: false })).toBe(true);
    }
  });
});
