import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, type Plan, type PlanId, type PlanFeatures, hasFeature as hasFeatureFn } from "@/lib/plans";

// Plan state is backed by the `subscriptions` table (one row per user, auto-provisioned
// with plan='pro' on signup). Users may update their own row's `plan` column via RLS,
// which powers the self-service switcher on Billing.tsx. The soft-warn "warned once"
// flags stay in localStorage — they're just a UI nicety, not an entitlement check.
const SOFT_WARN_KEY_PREFIX = "plan:warned:";

function emitPlanChange() {
  window.dispatchEvent(new CustomEvent("plan:changed"));
}

export function usePlan() {
  const [planId, setPlanId] = useState<PlanId>("pro");

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();
    const next = (data?.plan as PlanId | undefined) ?? "pro";
    setPlanId(next);
  }, []);

  useEffect(() => {
    refresh();
    const sync = () => refresh();
    window.addEventListener("plan:changed", sync as EventListener);
    return () => window.removeEventListener("plan:changed", sync as EventListener);
  }, [refresh]);

  const setPlan = useCallback(async (next: PlanId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Row is auto-provisioned by trigger, but upsert defends against races.
    await supabase
      .from("subscriptions")
      .upsert({ user_id: user.id, plan: next }, { onConflict: "user_id" });
    setPlanId(next);
    emitPlanChange();
  }, []);

  const plan: Plan = PLANS[planId];

  const hasFeature = useCallback(
    (feature: keyof PlanFeatures) => hasFeatureFn(planId, feature),
    [planId],
  );

  const checkSoftGate = useCallback(
    (feature: keyof PlanFeatures): { allowed: boolean; warned: boolean; firstUse: boolean } => {
      if (hasFeatureFn(planId, feature)) {
        return { allowed: true, warned: false, firstUse: false };
      }
      const key = `${SOFT_WARN_KEY_PREFIX}${feature}`;
      const alreadyWarned = localStorage.getItem(key) === "1";
      if (alreadyWarned) {
        return { allowed: false, warned: true, firstUse: false };
      }
      localStorage.setItem(key, "1");
      return { allowed: true, warned: true, firstUse: true };
    },
    [planId],
  );

  const resetSoftGate = useCallback((feature: keyof PlanFeatures) => {
    localStorage.removeItem(`${SOFT_WARN_KEY_PREFIX}${feature}`);
  }, []);

  return {
    planId,
    plan,
    setPlan,
    hasFeature,
    checkSoftGate,
    resetSoftGate,
    isFree: planId === "free",
    isStarter: planId === "starter",
    isPro: planId === "pro",
  };
}
