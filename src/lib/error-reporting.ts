import { supabase } from "@/integrations/supabase/client";
import { telemetryErrorCode, telemetryRoute } from "../../supabase/functions/_shared/telemetry-privacy";

export type ClientErrorSource =
  | "react_boundary"
  | "window_error"
  | "unhandled_rejection";

const sentFingerprints = new Map<string, number>();

export function reportClientError(
  value: unknown,
  source: ClientErrorSource,
): void {
  const code = telemetryErrorCode(value instanceof Error || value instanceof DOMException ? value.name : null);
  const path = telemetryRoute(typeof window === "undefined" ? null : window.location.pathname);
  const fingerprint = `${source}:${path}:${code}`;
  const now = Date.now();
  const previous = sentFingerprints.get(fingerprint);
  if (previous !== undefined && now - previous < 60_000) return;
  sentFingerprints.delete(fingerprint);
  if (sentFingerprints.size >= 128) sentFingerprints.delete(sentFingerprints.keys().next().value!);
  sentFingerprints.set(fingerprint, now);

  void supabase.functions
    .invoke("report-client-error", {
      body: { source, path, code },
    })
    .catch(() => {
      // Reporting must never become a second user-facing failure.
    });
}

export function installGlobalErrorReporting(): () => void {
  const onError = (event: ErrorEvent) => {
    reportClientError(event.error, "window_error");
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    reportClientError(event.reason, "unhandled_rejection");
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}
