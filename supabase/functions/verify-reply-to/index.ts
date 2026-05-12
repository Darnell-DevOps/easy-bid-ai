// Reply-to email verification.
// POST { action: "request", email } (auth required) -> sends verification email.
// GET  ?token=xxx -> marks address verified, returns small HTML page.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const FN_URL = `${SUPABASE_URL}/functions/v1/verify-reply-to`;

function htmlPage(title: string, body: string, ok = true) {
  const color = ok ? "#16a34a" : "#dc2626";
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0d12;color:#e6e8ee;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#11141b;border:1px solid #1f2430;border-radius:14px;padding:32px;max-width:420px;text-align:center}
h1{margin:0 0 8px;font-size:20px}
.dot{width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;margin-right:8px;vertical-align:middle}
p{color:#9aa3b2;margin:8px 0 0;font-size:14px;line-height:1.5}</style>
<div class="card"><h1><span class="dot"></span>${title}</h1><p>${body}</p></div>`,
    { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 200 },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // GET — confirm via link from email
  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return htmlPage("Missing token", "This verification link is invalid.", false);

    const { data: row } = await admin
      .from("business_branding")
      .select("user_id, reply_to_pending_email, reply_to_token_expires_at")
      .eq("reply_to_verification_token", token)
      .maybeSingle();

    if (!row) return htmlPage("Link not found", "This verification link is invalid or already used.", false);
    if (row.reply_to_token_expires_at && new Date(row.reply_to_token_expires_at) < new Date()) {
      return htmlPage("Link expired", "Please request a new verification email.", false);
    }

    await admin
      .from("business_branding")
      .update({
        reply_to_email: row.reply_to_pending_email,
        reply_to_verified_email: row.reply_to_pending_email,
        reply_to_verified_at: new Date().toISOString(),
        reply_to_pending_email: null,
        reply_to_verification_token: null,
        reply_to_token_expires_at: null,
      })
      .eq("user_id", row.user_id);

    return htmlPage(
      "Email verified",
      `${row.reply_to_pending_email} is now your verified reply-to address. You can close this tab and return to CloseSync.`,
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST — request verification (must be authenticated)
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { action?: string; email?: string };
  try { body = await req.json(); } catch { body = {}; }

  if (body.action !== "request" || !body.email) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "invalid_email" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await admin
    .from("business_branding")
    .upsert({
      user_id: u.user.id,
      reply_to_pending_email: email,
      reply_to_verification_token: token,
      reply_to_token_expires_at: expires,
    }, { onConflict: "user_id" });

  const verifyLink = `${FN_URL}?token=${token}`;
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6fa;padding:32px">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
<h2 style="margin:0 0 12px;color:#111">Confirm your reply-to email</h2>
<p style="color:#444;line-height:1.55;font-size:15px">Click the button below to verify <strong>${email}</strong> so CloseSync can use it as the reply-to address on emails sent to your clients.</p>
<p style="margin:24px 0"><a href="${verifyLink}" style="background:#3b82f6;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Verify email</a></p>
<p style="color:#888;font-size:12px;line-height:1.5">If you didn't request this, ignore this email. The link expires in 24 hours.</p>
</div></body></html>`;

  // Send via Resend gateway directly (bypassing template registry).
  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!RESEND_KEY || !LOVABLE_KEY) {
    return new Response(JSON.stringify({ error: "missing_credentials" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_KEY}`,
      "X-Connection-Api-Key": RESEND_KEY,
    },
    body: JSON.stringify({
      from: "CloseSync AI <notify@closesync.io>",
      to: [email],
      subject: "Confirm your reply-to email",
      html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return new Response(JSON.stringify({ error: "send_failed", details: txt }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
