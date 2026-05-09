import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight first-party landing analytics.
 * - Fire-and-forget INSERT into public.landing_events
 * - Never blocks the UI, never throws, never logs PII
 * - Per-tab session id stored in sessionStorage
 */

const SESSION_KEY = "landing_session_id";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export type LandingEvent =
  | "landing_view"
  | "cta_click"
  | "demo_start"
  | "demo_complete"
  | "sample_view"
  | "signup_view"
  | "signup_submit_success";

export function track(event: LandingEvent, meta: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    void supabase
      .from("landing_events")
      .insert({
        event,
        path: window.location.pathname + window.location.search,
        referrer: document.referrer || null,
        session_id: getSessionId(),
        meta,
      })
      .then(
        () => {},
        () => {},
      );
  } catch {
    // swallow — analytics must never break the UI
  }
}
