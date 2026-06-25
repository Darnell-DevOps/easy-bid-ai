// Sends the AI-drafted lead reply via the existing send-email function.
// Review-first: only fires when the user clicks "Send reply" in the UI.
import { createClient } from "npm:@supabase/supabase-js@2";
import { logLeadActivity } from "../_shared/lead-activity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const renderHtml = (body: string, signature: string | null) => {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px 0;line-height:1.6;color:#111">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const sig = signature
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;color:#444;font-size:13px;white-space:pre-wrap">${escapeHtml(signature)}</div>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:32px 24px;color:#111">${paragraphs}${sig}</div>
  </body></html>`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const userId = userData.user.id;

  let body: { client_id?: string; subject?: string; body?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const clientId = (body.client_id || "").trim();
  const subject = (body.subject || "").trim();
  const messageBody = (body.body || "").trim();
  if (!clientId || !subject || !messageBody) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (subject.length > 300 || messageBody.length > 20000) {
    return new Response(JSON.stringify({ error: "too_long" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const svc = createClient(supabaseUrl, serviceKey);
  const { data: client, error: clientErr } = await svc
    .from("clients")
    .select("id, user_id, name, email, status, lead_reply_sent_at")
    .eq("id", clientId)
    .maybeSingle();
  if (clientErr || !client) {
    return new Response(JSON.stringify({ error: "client_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (client.user_id !== userId) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!client.email) {
    return new Response(JSON.stringify({ error: "client_has_no_email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const [{ data: prefs }, { data: branding }] = await Promise.all([
    svc.from("ai_preferences").select("email_signature").eq("user_id", userId).maybeSingle(),
    svc.from("business_branding").select("business_name, email_signature").eq("user_id", userId).maybeSingle(),
  ]);
  const signature =
    ((prefs as any)?.email_signature && String((prefs as any).email_signature).trim()) ||
    ((branding as any)?.email_signature && String((branding as any).email_signature).trim()) ||
    null;

  // If the user has already pasted/edited the signature into the body, don't double it.
  const bodyHasSignature = signature ? messageBody.includes(signature) : false;
  const html = renderHtml(messageBody, bodyHasSignature ? null : signature);
  const idempotencyKey = `lead-reply:${clientId}:${Date.now()}`;

  const { data: sent, error: sendErr } = await svc.functions.invoke("send-email", {
    body: {
      templateName: "lead-reply",
      recipientEmail: client.email,
      idempotencyKey,
      userId,
      prerendered: { subject, html, text: messageBody },
      meta: { client_id: clientId, kind: "lead_reply" },
    },
  });
  if (sendErr || (sent as any)?.error) {
    return new Response(
      JSON.stringify({ error: "send_failed", detail: sendErr?.message || (sent as any)?.error }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const updates: Record<string, unknown> = {
    lead_reply_sent_at: new Date().toISOString(),
    lead_draft_reply: messageBody,
    lead_draft_subject: subject,
  };
  if (client.status === "New") updates.status = "Contacted";
  await svc.from("clients").update(updates).eq("id", clientId);

  await logLeadActivity(svc, {
    user_id: userId,
    type: "reply_sent",
    title: `Reply sent to ${client.name || client.email}`,
    summary: subject.slice(0, 200),
    client_id: clientId,
    metadata: { to: client.email },
  });

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
