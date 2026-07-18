import { supabase } from "@/integrations/supabase/client";

export type OnboardingStep =
  | "welcome"
  | "client"
  | "proposal"
  | "value"
  | "completed"
  | "skipped";

export type OnboardingProgress = {
  onboarding_step: OnboardingStep;
  onboarding_completed_at: string | null;
  onboarding_skipped_at: string | null;
  onboarding_client_id: string | null;
  onboarding_proposal_id: string | null;
};

const LEGACY_KEY_PREFIX = "ss_onboarding_done_";

export function getLegacyOnboardingKey(userId: string): string {
  return `${LEGACY_KEY_PREFIX}${userId}`;
}

export async function loadOnboardingProgress(
  userId: string,
): Promise<OnboardingProgress | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "onboarding_step, onboarding_completed_at, onboarding_skipped_at, onboarding_client_id, onboarding_proposal_id",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as OnboardingProgress | null;
}

export async function saveOnboardingProgress(
  userId: string,
  patch: Partial<OnboardingProgress>,
): Promise<void> {
  const { error } = await supabase.from("user_profiles").upsert(
    { user_id: userId, ...patch },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function migrateLegacyOnboarding(
  userId: string,
  progress: OnboardingProgress | null,
): Promise<OnboardingProgress | null> {
  if (progress?.onboarding_completed_at) return progress;
  if (localStorage.getItem(getLegacyOnboardingKey(userId)) !== "1") return progress;

  const completedAt = new Date().toISOString();
  await saveOnboardingProgress(userId, {
    onboarding_step: "completed",
    onboarding_completed_at: completedAt,
  });
  localStorage.removeItem(getLegacyOnboardingKey(userId));
  return {
    onboarding_step: "completed",
    onboarding_completed_at: completedAt,
    onboarding_skipped_at: progress?.onboarding_skipped_at ?? null,
    onboarding_client_id: progress?.onboarding_client_id ?? null,
    onboarding_proposal_id: progress?.onboarding_proposal_id ?? null,
  };
}
