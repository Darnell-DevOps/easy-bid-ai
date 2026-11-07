import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight first-party landing analytics.
 * - Fire-and-forget INSERT into public.landing_events
 * - Records event counts and CTA positions without visitor identifiers or URLs
 */

export type LandingEvent =
  | "landing_view"
  | "cta_click"
  | "demo_start"
  | "demo_complete"
  | "sample_view"
  | "signup_view"
  | "signup_submit_success";

const EVENT_PATHS: Record<LandingEvent, string> = {
  landing_view: "/", cta_click: "/", demo_start: "/", demo_complete: "/", sample_view: "/sample",
  signup_view: "/signup", signup_submit_success: "/signup",
};

const CTA_LOCATIONS = new Set(["hero", "pricing_free", "pricing_starter", "pricing_pro", "footer"]);

export function landingEventPayload(event: LandingEvent, meta: Record<string, unknown> = {}) {
  if (!Object.prototype.hasOwnProperty.call(EVENT_PATHS, event)) return null;
  const location = meta.location;
  if (event === "cta_click" && (typeof location !== "string" || !CTA_LOCATIONS.has(location))) return null;
  return { event, path: EVENT_PATHS[event], meta: event === "cta_click" ? { location } : {} };
}

export function track(event: LandingEvent, meta: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    const payload = landingEventPayload(event, meta);
    if (!payload) return;
    void (supabase.from("landing_events" as any) as any)
      .insert(payload)
      .then(
        () => {},
        () => {},
      );
  } catch {
    // swallow — analytics must never break the UI
  }
}
