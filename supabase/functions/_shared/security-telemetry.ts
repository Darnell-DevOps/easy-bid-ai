import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type SecurityEventSeverity = "info" | "warning" | "error" | "critical";
type SecurityEventOutcome = "observed" | "blocked" | "failed";

type SecurityEvent = {
  eventType: string;
  source: string;
  severity?: SecurityEventSeverity;
  outcome?: SecurityEventOutcome;
  statusCode?: number;
  userId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

function getRequestAddress(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    null;
}

async function requestFingerprint(req: Request): Promise<string | null> {
  const address = getRequestAddress(req);
  if (!address) return null;

  const salt = Deno.env.get("ERROR_HASH_SALT") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(-32);
  if (!salt) return null;

  const input = new TextEncoder().encode(`${salt}:${address}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function logSecurityEvent(
  client: SupabaseClient,
  req: Request,
  event: SecurityEvent,
): Promise<void> {
  const payload = {
    event_type: event.eventType.slice(0, 100),
    source: event.source.slice(0, 100),
    severity: event.severity || "warning",
    outcome: event.outcome || "blocked",
    status_code: event.statusCode ?? null,
    user_id: event.userId || null,
    request_fingerprint: await requestFingerprint(req),
    metadata: event.metadata || {},
  };

  // Lovable Cloud captures console output, while the table enables safe
  // aggregation and alerting. Do not add raw request data to this object.
  console.warn("security_event", JSON.stringify({
    event_type: payload.event_type,
    source: payload.source,
    severity: payload.severity,
    outcome: payload.outcome,
    status_code: payload.status_code,
  }));

  try {
    const { error } = await client.from("security_events").insert(payload);
    if (error) console.error("security_event_insert_failed", error.message);
  } catch (error) {
    console.error(
      "security_event_insert_failed",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}
