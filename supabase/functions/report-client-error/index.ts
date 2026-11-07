import { createClient } from "npm:@supabase/supabase-js@2";
import { logSecurityEvent } from "../_shared/security-telemetry.ts";
import { enforcePublicRateLimit } from "../_shared/abuse-rate-limit.ts";
import { safeErrorReport } from "../_shared/telemetry-privacy.ts";
import { readBoundedJson } from "../_shared/bounded-json.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const limited = await enforcePublicRateLimit(req, {
    source: "report-client-error",
    ipLimit: { maxRequests: 20, windowSeconds: 5 * 60 },
  });
  if (limited) return limited;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const report = safeErrorReport(await readBoundedJson(req, 32_768).catch(() => null));
    if (!report) {
      await logSecurityEvent(admin, req, {
        eventType: "invalid_request",
        source: "report-client-error",
        statusCode: 400,
        metadata: { reason: "invalid_error_report" },
      });
      return json({ error: "Invalid error report" }, 400);
    }

    let userId: string | null = null;
    const authorization = req.headers.get("Authorization");
    if (authorization) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
      });
      const { data } = await userClient.auth.getUser();
      userId = data.user?.id || null;
    }

    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const salt = Deno.env.get("ERROR_HASH_SALT") || serviceKey.slice(-16);
    const requestFingerprint = await sha256(`${salt}:${forwarded}`);

    const { data: inserted, error } = await admin
      .from("app_error_reports")
      .insert({
        ...report,
        user_id: userId,
        request_fingerprint: requestFingerprint,
      })
      .select("id")
      .single();
    if (error) throw error;
    return json({ accepted: true, incidentId: inserted.id }, 202);
  } catch {
    console.error("report-client-error failed");
    return json({ error: "Could not record error" }, 500);
  }
});
