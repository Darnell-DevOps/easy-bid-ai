import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, type Plan, type PlanId, type PlanFeatures, hasFeature as hasFeatureFn } from "@/lib/plans";
import { initializePaddle, isPaymentsConfigured, isTestMode } from "@/lib/paddle";

// Plan state is backed by the `subscriptions` table (one row per user, auto-provisioned
// with plan='free' on signup). `plan` is no longer client-writable — it's only ever
// changed server-side by the payments-webhook, after a real Paddle payment
// (create-plan-checkout) or cancellation (cancel-plan-subscription). The soft-warn
// "warned once" flags stay in localStorage — they're just a UI nicety, not an
// entitlement check.
const SOFT_WARN_KEY_PREFIX = "plan:warned:";

function emitPlanChange() {
  window.dispatchEvent(new CustomEvent("plan:changed"));
}

export function usePlan() {
  const [planId, setPlanId] = useState<PlanId>("free");

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();
    const value = data?.plan;
    const next: PlanId = !error && (value === "free" || value === "starter" || value === "pro")
      ? value
      : "free";
    setPlanId(next);
  }, []);

  useEffect(() => {
    refresh();
    const sync = () => refresh();
    window.addEventListener("plan:changed", sync as EventListener);
    return () => window.removeEventListener("plan:changed", sync as EventListener);
  }, [refresh]);

  // Waits briefly for payments-webhook to land after a successful checkout —
  // the DB update happens asynchronously once Paddle confirms the payment.
  const waitForPlan = useCallback(async (target: PlanId): Promise<boolean> => {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("subscriptions")
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.plan === target) {
        setPlanId(target);
        emitPlanChange();
        return true;
      }
    }
    // Webhook may still be catching up — refresh once more so the UI at
    // least reflects the latest known state instead of the stale target.
    await refresh();
    return false;
  }, [refresh]);

  const upgradePlan = useCallback(async (target: Exclude<PlanId, "free">): Promise<boolean> => {
    if (!isPaymentsConfigured()) return false;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data, error } = await supabase.functions.invoke("create-plan-checkout", {
      body: { targetPlan: target },
    });
    if (error) return false;
    const clientEnvironment = isTestMode() ? "sandbox" : "live";
    if (data?.environment !== clientEnvironment) return false;

    if (data?.mode === "updated" || data?.mode === "unchanged") {
      void waitForPlan(target);
      return true;
    }
    if (data?.mode !== "checkout" || !data?.transactionId) return false;

    let resolveCheckout: (completed: boolean) => void = () => undefined;
    const checkoutResult = new Promise<boolean>((resolve) => {
      resolveCheckout = resolve;
    });
    let completed = false;
    await initializePaddle((event) => {
      if (event.name === "checkout.completed") {
        completed = true;
        void waitForPlan(target);
        resolveCheckout(true);
      } else if (event.name === "checkout.closed" && !completed) {
        resolveCheckout(false);
      }
    });

    try {
      window.Paddle.Checkout.open({
        transactionId: data.transactionId,
        customer: session.user.email ? { email: session.user.email } : undefined,
        settings: {
          displayMode: "overlay",
          variant: "one-page",
          allowLogout: false,
          theme: "dark",
        },
      });
    } catch {
      return false;
    }
    return checkoutResult;
  }, [waitForPlan]);

  const cancelToFree = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke("cancel-plan-subscription", { body: {} });
    if (error || !data?.ok) return false;
    setPlanId("free");
    emitPlanChange();
    return true;
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
    upgradePlan,
    cancelToFree,
    hasFeature,
    checkSoftGate,
    resetSoftGate,
    isFree: planId === "free",
    isStarter: planId === "starter",
    isPro: planId === "pro",
  };
}
