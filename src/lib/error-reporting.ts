import { supabase } from "@/integrations/supabase/client";

export type ClientErrorSource =
  | "react_boundary"
  | "window_error"
  | "unhandled_rejection";

const sentFingerprints = new Set<string>();

export function toErrorDetails(value: unknown): { message: string; stack: string | null } {
  if (value instanceof Error) {
    return { message: value.message || value.name, stack: value.stack || null };
  }
  if (typeof value === "string") return { message: value, stack: null };
  try {
    return { message: JSON.stringify(value), stack: null };
  } catch {
    return { message: "Unknown client error", stack: null };
  }
}

export function reportClientError(
  value: unknown,
  source: ClientErrorSource,
  metadata: Record<string, unknown> = {},
): void {
  const details = toErrorDetails(value);
  const path = typeof window === "undefined" ? null : window.location.pathname;
  const fingerprint = `${source}:${path}:${details.message}:${details.stack || ""}`.slice(0, 4_000);
  if (sentFingerprints.has(fingerprint)) return;
  sentFingerprints.add(fingerprint);

  void supabase.functions
    .invoke("report-client-error", {
      body: {
        source,
        message: details.message,
        stack: details.stack,
        path,
        metadata,
      },
    })
    .catch(() => {
      // Reporting must never become a second user-facing failure.
    });
}

export function installGlobalErrorReporting(): () => void {
  const onError = (event: ErrorEvent) => {
    reportClientError(event.error || event.message, "window_error", {
      filename: event.filename || null,
      line: event.lineno || null,
      column: event.colno || null,
    });
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
