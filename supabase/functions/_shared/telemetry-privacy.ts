const STATIC_ROUTES = new Set([
  "/", "/login", "/signup", "/terms", "/privacy", "/forgot-password", "/reset-password",
  "/sample", "/landing-concepts", "/.lovable/oauth/consent", "/onboarding", "/admin",
  "/dashboard", "/dashboard/recovery", "/dashboard/trash", "/dashboard/kickoff", "/dashboard/onboarding",
  "/dashboard/calendar", "/dashboard/contracts", "/dashboard/retainers", "/dashboard/retainers/new",
  "/dashboard/new", "/dashboard/billing", "/dashboard/settings", "/dashboard/templates", "/dashboard/emails",
  "/dashboard/revenue", "/dashboard/client-portal", "/dashboard/proposals", "/dashboard/clients",
  "/dashboard/clients/new", "/dashboard/time-saved", "/dashboard/leads", "/dashboard/policies",
  "/dashboard/policies/new", "/dashboard/testimonials", "/dashboard/lead-forms", "/dashboard/lead-inbox",
]);

const PARAMETER_ROUTES = [
  "/landing-concepts/:concept", "/proposal/view/:id", "/book/:slug", "/reschedule/:token",
  "/sign/:token", "/onboard/:token", "/retainer/:token", "/r/recover/:token",
  "/testimonial/:token", "/wall/:slug", "/f/:slug", "/dashboard/onboarding/:id",
  "/dashboard/contracts/:id", "/dashboard/retainers/:id", "/dashboard/proposal/:id",
  "/dashboard/clients/:id", "/dashboard/policies/:id", "/dashboard/lead-forms/:id",
] as const;

/** Return only a known route template, never an input-derived identifier or URL. */
export function telemetryRoute(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  const path = value.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  if (STATIC_ROUTES.has(path)) return path;
  const slash = path.lastIndexOf("/");
  if (slash < 1 || slash === path.length - 1) return null;
  const base = path.slice(0, slash + 1);
  return PARAMETER_ROUTES.find((route) => route.startsWith(`${base}:`)) ?? null;
}

const ERROR_LABELS = {
  TypeError: "Type error",
  ReferenceError: "Reference error",
  SyntaxError: "Syntax error",
  RangeError: "Range error",
  AbortError: "Operation aborted",
  Error: "Application error",
  Unknown: "Unknown client error",
} as const;

export function telemetryErrorCode(value: unknown): keyof typeof ERROR_LABELS {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ERROR_LABELS, value)
    ? value as keyof typeof ERROR_LABELS : "Unknown";
}

export function safeErrorReport(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const { source, path, code } = input as Record<string, unknown>;
  if (source !== "react_boundary" && source !== "window_error" && source !== "unhandled_rejection") return null;
  return {
    source,
    severity: source === "react_boundary" ? "fatal" : "error",
    message: ERROR_LABELS[telemetryErrorCode(code)],
    path: telemetryRoute(path),
    stack: null,
    user_agent: null,
    metadata: {},
  };
}

/** Read a bounded request before JSON parsing; do not trust Content-Length alone. */
export async function readTelemetryJson(request: Request, maxBytes = 32_768): Promise<unknown> {
  if (!request.body || Number(request.headers.get("content-length")) > maxBytes) {
    throw new Error("Invalid telemetry body");
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let json = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Telemetry body too large");
      json += decoder.decode(value, { stream: true });
    }
    return JSON.parse(json + decoder.decode());
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
