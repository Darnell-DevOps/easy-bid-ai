import { createClient } from "npm:@supabase/supabase-js@2";

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

  try {
    const body = await req.json();
    const allowedSources = new Set(["react_boundary", "window_error", "unhandled_rejection"]);
    if (!allowedSources.has(body?.source) || typeof body?.message !== "string") {
      return json({ error: "Invalid error report" }, 400);
    }

    const metadataJson = JSON.stringify(body.metadata || {});
    if (metadataJson.length > 20_000) return json({ error: "Metadata is too large" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

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
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { count } = await admin
      .from("app_error_reports")
      .select("id", { count: "exact", head: true })
      .eq("request_fingerprint", requestFingerprint)
      .gte("occurred_at", since);
    if ((count || 0) >= 20) return json({ accepted: false, rateLimited: true }, 202);

    const { data: inserted, error } = await admin
      .from("app_error_reports")
      .insert({
        source: body.source,
        severity: body.source === "react_boundary" ? "fatal" : "error",
        message: body.message.slice(0, 1_000),
        stack: typeof body.stack === "string" ? body.stack.slice(0, 8_000) : null,
        path: typeof body.path === "string" ? body.path.slice(0, 500) : null,
        user_id: userId,
        user_agent: (req.headers.get("user-agent") || "").slice(0, 1_000),
        metadata: body.metadata || {},
        request_fingerprint: requestFingerprint,
      })
      .select("id")
      .single();
    if (error) throw error;
    return json({ accepted: true, incidentId: inserted.id }, 202);
  } catch (error) {
    console.error("report-client-error failed", error);
    return json({ error: "Could not record error" }, 500);
  }
});
