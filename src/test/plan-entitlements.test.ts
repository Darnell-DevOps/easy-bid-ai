import { describe, expect, it, vi } from "vitest";
import {
  getUserPlan,
  normalizePlan,
  planHasFeature,
  planUpgradeRequired,
} from "../../supabase/functions/_shared/plan-entitlements";

function subscriptionClient(plan: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: plan === undefined ? null : { plan },
    error,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from }, from, eq };
}

describe("server plan entitlements", () => {
  it("fails closed for missing and unrecognized subscription plans", () => {
    expect(normalizePlan(undefined)).toBe("free");
    expect(normalizePlan("legacy-pro")).toBe("free");
  });

  it("only grants Pro features to Pro", () => {
    expect(planHasFeature("free", "payments")).toBe(false);
    expect(planHasFeature("starter", "aiLeadResponse")).toBe(false);
    expect(planHasFeature("pro", "payments")).toBe(true);
    expect(planHasFeature("pro", "policies")).toBe(true);
  });

  it("loads the user plan and defaults a missing row to Free", async () => {
    const existing = subscriptionClient("starter");
    await expect(getUserPlan(existing.client, "user-1")).resolves.toBe("starter");
    expect(existing.from).toHaveBeenCalledWith("subscriptions");
    expect(existing.eq).toHaveBeenCalledWith("user_id", "user-1");

    const missing = subscriptionClient(undefined);
    await expect(getUserPlan(missing.client, "user-2")).resolves.toBe("free");
  });

  it("returns a stable upgrade response for clients", () => {
    expect(planUpgradeRequired("free", "payments")).toEqual({
      error: "This feature requires the pro plan.",
      code: "plan_upgrade_required",
      currentPlan: "free",
      requiredPlan: "pro",
    });
  });
});
