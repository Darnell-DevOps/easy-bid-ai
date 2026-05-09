// Generic transactional email sender. Renders a template, checks suppression,
// records to email_send_log, sends via Resend gateway. Idempotent on
// `idempotency_key` (unique constraint on email_send_log).
import { createClient } from "npm:@supabase/supabase-js@2";
import { renderTemplate, type EmailData } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_DEFAULT = "CloseSync AI <notify@closesync.io>";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface Attachment {
  filename: string;
  content: string; // base64
  content_type?: string;
}
interface Body {
  templateName: string;
  recipientEmail: string;
  data?: EmailData;
  idempotencyKey?: string;
  userId?: string;
  from?: string;
  replyTo?: string;
  attachments?: Attachment[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { templateName, recipientEmail, data = {}, idempotencyKey, userId, from, replyTo, attachments } = body;
  if (!templateName || !recipientEmail) {
    return json({ error: "missing_fields" }, 400);
  }

  // Idempotency: if a row with this key already exists and was sent, no-op.
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from("email_send_log")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing && existing.status === "sent") {
      return json({ ok: true, deduped: true, id: existing.id });
    }
  }

  // Suppression check
  const { data: suppressed } = await supabase
    .from("email_suppressions")
    .select("email")
    .eq("email", recipientEmail.toLowerCase())
    .maybeSingle();
  if (suppressed) {
    await logSend({ ...body, status: "suppressed" });
    return json({ ok: false, suppressed: true });
  }

  let rendered;
  try {
    rendered = renderTemplate(templateName, data);
  } catch (e: any) {
    return json({ error: "render_failed", message: e?.message }, 400);
  }

  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!RESEND_KEY || !LOVABLE_KEY) {
    return json({ error: "missing_credentials" }, 500);
  }

  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_KEY}`,
        "X-Connection-Api-Key": RESEND_KEY,
      },
      body: JSON.stringify({
        from: from || FROM_DEFAULT,
        to: [recipientEmail],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments && attachments.length ? { attachments } : {}),
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      await logSend({
        ...body,
        status: "failed",
        subject: rendered.subject,
        error: `[${res.status}] ${JSON.stringify(payload)}`,
      });
      return json({ ok: false, error: "send_failed", details: payload }, 502);
    }
    const id = await logSend({
      ...body,
      status: "sent",
      subject: rendered.subject,
      provider_id: payload?.id,
    });
    return json({ ok: true, id, provider_id: payload?.id });
  } catch (e: any) {
    await logSend({ ...body, status: "failed", subject: rendered.subject, error: e?.message });
    return json({ error: "exception", message: e?.message }, 500);
  }
});

async function logSend(args: {
  templateName: string;
  recipientEmail: string;
  status: string;
  subject?: string;
  provider_id?: string;
  error?: string;
  idempotencyKey?: string;
  userId?: string;
}): Promise<string | null> {
  const row: any = {
    user_id: args.userId || null,
    template: args.templateName,
    recipient: args.recipientEmail,
    subject: args.subject || null,
    status: args.status,
    provider_id: args.provider_id || null,
    error: args.error || null,
    idempotency_key: args.idempotencyKey || null,
  };
  // Upsert on idempotency_key when present so retries update existing row.
  const q = args.idempotencyKey
    ? supabase.from("email_send_log").upsert(row, { onConflict: "idempotency_key" }).select("id").maybeSingle()
    : supabase.from("email_send_log").insert(row).select("id").maybeSingle();
  const { data, error } = await q;
  if (error) console.error("email_send_log error:", error.message);
  return data?.id ?? null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
