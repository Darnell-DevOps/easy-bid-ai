// Per-user WhatsApp send. Uses BYOK Twilio credentials stored on the caller's
// whatsapp_settings row. Authenticates the caller, dedupes via
// whatsapp_send_log.idempotency_key, and logs every attempt.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { normalizeToWhatsApp, twilioSendWhatsApp } from "../_shared/whatsapp.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SendRequest {
  to: string;
  body: string;
  context?: string;
  relatedId?: string;
  idempotencyKey?: string;
}

function normalizeFrom(from: string): string {
  const trimmed = from.trim();
  if (trimmed.startsWith("whatsapp:")) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, "");
  return `whatsapp:+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as SendRequest;
    if (!payload?.to || !payload?.body) {
      return new Response(JSON.stringify({ error: "to and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: settings } = await admin
      .from("whatsapp_settings")
      .select("whatsapp_from, enabled, twilio_account_sid, twilio_auth_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!settings?.enabled) {
      return new Response(
        JSON.stringify({ error: "WhatsApp sending is disabled. Enable it in Settings → Integrations." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!settings.whatsapp_from || !settings.twilio_account_sid || !settings.twilio_auth_token) {
      return new Response(
        JSON.stringify({
          error:
            "WhatsApp not configured. Add your Twilio Account SID, Auth Token and WhatsApp sender in Settings → Integrations.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const to = normalizeToWhatsApp(payload.to);
    if (!to) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const from = normalizeFrom(settings.whatsapp_from);
    const bucket = Math.floor(Date.now() / (5 * 60_000));
    const idempotencyKey =
      payload.idempotencyKey ??
      `wa-${user.id}-${payload.relatedId || "adhoc"}-${payload.context || "manual"}-${bucket}`;

    // Idempotency: short-circuit if a recent send with this key exists
    const { data: existing } = await admin
      .from("whatsapp_send_log")
      .select("id, twilio_sid, sent_at")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ ok: true, deduped: true, sid: existing.twilio_sid, sentAt: existing.sent_at }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { ok, status, data: twilioData } = await twilioSendWhatsApp(
      { accountSid: settings.twilio_account_sid, authToken: settings.twilio_auth_token },
      to,
      from,
      payload.body,
    );

    if (!ok) {
      await admin.from("whatsapp_send_log").insert({
        user_id: user.id,
        recipient: to,
        body: payload.body,
        context: payload.context || null,
        related_id: payload.relatedId || null,
        status: "failed",
        error: JSON.stringify(twilioData).slice(0, 1000),
        idempotency_key: idempotencyKey,
      });
      return new Response(
        JSON.stringify({ error: twilioData?.message || `Twilio send failed (${status})`, details: twilioData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await admin.from("whatsapp_send_log").insert({
      user_id: user.id,
      recipient: to,
      body: payload.body,
      context: payload.context || null,
      related_id: payload.relatedId || null,
      twilio_sid: twilioData?.sid || null,
      status: twilioData?.status || "queued",
      idempotency_key: idempotencyKey,
    });

    return new Response(
      JSON.stringify({ ok: true, sid: twilioData?.sid, status: twilioData?.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
