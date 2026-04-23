import { useCallback, useEffect, useState } from "react";
import { PLANS, type Plan, type PlanId, type PlanFeatures, hasFeature as hasFeatureFn } from "@/lib/plans";

// LocalStorage-backed plan state. Replace with a Supabase `subscriptions`
// query when Lovable Cloud payments are wired up — keep this hook's API
// identical so callers don't change.
const PLAN_STORAGE_KEY = "plan:current";
const SOFT_WARN_KEY_PREFIX = "plan:warned:"; // per-feature "first allow" flag

function readPlan(): PlanId {
  if (typeof window === "undefined") return "free";
  const v = localStorage.getItem(PLAN_STORAGE_KEY);
  if (v === "starter" || v === "pro" || v === "free") return v;
  return "free";
}

function emitPlanChange() {
  // Notify same-tab listeners (storage event only fires across tabs).
  window.dispatchEvent(new CustomEvent("plan:changed"));
}

export function usePlan() {
  const [planId, setPlanId] = useState<PlanId>(() => readPlan());

  useEffect(() => {
    const sync = () => setPlanId(readPlan());
    window.addEventListener("storage", sync);
    window.addEventListener("plan:changed", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("plan:changed", sync as EventListener);
    };
  }, []);

  const setPlan = useCallback((next: PlanId) => {
    localStorage.setItem(PLAN_STORAGE_KEY, next);
    setPlanId(next);
    emitPlanChange();
  }, []);

  const plan: Plan = PLANS[planId];

  const hasFeature = useCallback(
    (feature: keyof PlanFeatures) => hasFeatureFn(planId, feature),
    [planId],
  );

  /**
   * Soft-warn gate. First call returns { allowed: true, warned: true } and
   * persists a "warned" flag so the second call returns { allowed: false }.
   * Use for "allow once, then block" UX (e.g. Pro features used by a Free user).
   * If the plan already meets the requirement, returns { allowed: true }.
   */
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
