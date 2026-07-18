export type PlanId = "free" | "starter" | "pro";

export type PaidFeature =
  | "aiLeadResponse"
  | "policies"
  | "payments"
  | "templates"
  | "analytics"
  | "autoAttachPolicies";

const PLAN_RANK: Record<PlanId, number> = { free: 0, starter: 1, pro: 2 };

export const FEATURE_REQUIREMENTS: Record<PaidFeature, PlanId> = {
  aiLeadResponse: "pro",
  policies: "pro",
  payments: "pro",
  templates: "starter",
  analytics: "pro",
  autoAttachPolicies: "pro",
};

export function normalizePlan(value: unknown): PlanId {
  return value === "starter" || value === "pro" ? value : "free";
}

export function planMeets(current: PlanId, required: PlanId): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

export function planHasFeature(plan: PlanId, feature: PaidFeature): boolean {
  return planMeets(plan, FEATURE_REQUIREMENTS[feature]);
}

export async function getUserPlan(client: any, userId: string): Promise<PlanId> {
  const { data, error } = await client
    .from("subscriptions")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Could not verify subscription: ${error.message}`);
  return normalizePlan(data?.plan);
}

export function planUpgradeRequired(
  currentPlan: PlanId,
  feature: PaidFeature,
): Record<string, string> {
  return {
    error: `This feature requires the ${FEATURE_REQUIREMENTS[feature]} plan.`,
    code: "plan_upgrade_required",
    currentPlan,
    requiredPlan: FEATURE_REQUIREMENTS[feature],
  };
}
