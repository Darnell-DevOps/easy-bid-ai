// Generic transactional email sender. Renders a template, checks suppression,
// records to email_send_log, sends via Resend gateway. Idempotent on
// `idempotency_key` (unique constraint on email_send_log).
import { createClient } from "npm:@supabase/supabase-js@2";
import { renderTemplate, type EmailData } from "../_shared/email-templates.ts";
import { renderClientEmail } from "../_shared/client-email-templates.ts";


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
  // Pre-rendered passthrough — when present, skip the system template registry.
  // Used by the in-app SendEmailDialog after rendering with the user's saved
  // template + branding.
  prerendered?: { subject: string; html: string; text?: string };
  meta?: Record<string, unknown>;
}

// ---- Limits ----
const MAX_RECIPIENT_LEN = 320;
const MAX_SUBJECT_LEN = 500;
const MAX_HTML_LEN = 500_000;
const MAX_TEXT_LEN = 200_000;
const MAX_ATTACHMENTS = 5;
const MAX_FILENAME_LEN = 200;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function extractAddress(from: string): string | null {
  const m = from.match(/<([^>]+)>/);
  const addr = (m ? m[1] : from).trim();
  return EMAIL_RE.test(addr) ? addr.toLowerCase() : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // ---- Auth: trusted-internal vs authenticated-user ----
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const isInternal = bearer && bearer === serviceRoleKey;

  let authedUserId: string | null = null;
  if (!isInternal) {
    if (!bearer) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${bearer}` } } },
    );
    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u?.user) return json({ error: "unauthorized" }, 401);
    authedUserId = u.user.id;
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { templateName, recipientEmail, data = {}, idempotencyKey, replyTo, attachments, prerendered } = body;
  let { userId, from } = body;
  if (!templateName || !recipientEmail) {
    return json({ error: "missing_fields" }, 400);
  }

  // ---- Recipient shape/length ----
  if (typeof recipientEmail !== "string" || recipientEmail.length > MAX_RECIPIENT_LEN || !EMAIL_RE.test(recipientEmail)) {
    return json({ error: "invalid_recipient" }, 400);
  }

  // ---- Enforce tenant boundary for authenticated user path ----
  if (!isInternal) {
    if (userId && userId !== authedUserId) {
      return json({ error: "user_mismatch" }, 403);
    }
    userId = authedUserId!;

    if (from) {
      if (typeof from !== "string" || from.length > 320) {
        return json({ error: "invalid_from" }, 400);
      }
      const fromAddr = extractAddress(from);
      const defaultAddr = extractAddress(FROM_DEFAULT);
      if (!fromAddr) return json({ error: "invalid_from" }, 400);
      let allowed = fromAddr === defaultAddr;
      if (!allowed) {
        const atIdx = fromAddr.indexOf("@");
        const local = fromAddr.slice(0, atIdx);
        const domain = fromAddr.slice(atIdx + 1);
        const { data: dom } = await supabase
          .from("sending_domains")
          .select("domain, default_from_local")
          .eq("user_id", userId)
          .eq("status", "verified")
          .eq("domain", domain)
          .maybeSingle();
        if (dom && (!dom.default_from_local || dom.default_from_local === local || local === "hello")) {
          allowed = true;
        }
      }
      if (!allowed) return json({ error: "from_not_authorized" }, 403);
    }
  }

  // ---- Content limits ----
  if (prerendered) {
    if (typeof prerendered.subject !== "string" || prerendered.subject.length > MAX_SUBJECT_LEN) {
      return json({ error: "prerendered_subject_too_long" }, 400);
    }
    if (typeof prerendered.html !== "string" || prerendered.html.length > MAX_HTML_LEN) {
      return json({ error: "prerendered_html_too_long" }, 400);
    }
    if (prerendered.text != null && (typeof prerendered.text !== "string" || prerendered.text.length > MAX_TEXT_LEN)) {
      return json({ error: "prerendered_text_too_long" }, 400);
    }
  }

  // ---- Attachment validation ----
  if (attachments && attachments.length) {
    if (attachments.length > MAX_ATTACHMENTS) {
      return json({ error: "too_many_attachments" }, 400);
    }
    let totalBytes = 0;
    for (const a of attachments) {
      if (!a || typeof a.filename !== "string" || typeof a.content !== "string") {
        return json({ error: "invalid_attachment" }, 400);
      }
      if (a.filename.length > MAX_FILENAME_LEN || /[\/\\\x00-\x1f]/.test(a.filename)) {
        return json({ error: "invalid_attachment_filename" }, 400);
      }
      if (a.content_type && !ALLOWED_ATTACHMENT_TYPES.has(a.content_type)) {
        return json({ error: "attachment_type_not_allowed", content_type: a.content_type }, 400);
      }
      const clean = a.content.replace(/\s+/g, "");
      if (!clean || !BASE64_RE.test(clean)) {
        return json({ error: "invalid_attachment_base64" }, 400);
      }
      const bytes = Math.floor(clean.length * 0.75);
      if (bytes > MAX_ATTACHMENT_BYTES) {
        return json({ error: "attachment_too_large", filename: a.filename }, 400);
      }
      totalBytes += bytes;
    }
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      return json({ error: "attachments_total_too_large" }, 400);
    }
  }

  // Reflect resolved values back onto body so downstream `...body` spreads (logSend) see them.
  body.userId = userId;
  body.from = from;



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

  let rendered: { subject: string; html: string; text?: string };
  if (prerendered && prerendered.subject && prerendered.html) {
    // Pre-rendered by the in-app dialog using the user's template + branding.
    rendered = { subject: prerendered.subject, html: prerendered.html, text: prerendered.text };
  } else if (templateName === "onboarding-welcome" || templateName === "onboarding-reminder") {
    // These templates live in the customizable client-template system, not the
    // static registry. Route through renderClientEmail so per-user overrides
    // and branding apply.
    try {
      const client = await renderClientEmail(supabase, userId, templateName, data as any);
      if (!client) {
        return json({ error: "render_failed", message: `Unknown template: ${templateName}` }, 400);
      }
      rendered = client;
    } catch (e: any) {
      return json({ error: "render_failed", message: e?.message }, 400);
    }
  } else {
    try {
      rendered = renderTemplate(templateName, data);
    } catch (e: any) {
      return json({ error: "render_failed", message: e?.message }, 400);
    }
  }


  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!RESEND_KEY || !LOVABLE_KEY) {
    return json({ error: "missing_credentials" }, 500);
  }

  // If user has a verified custom sending domain, use it as the From address.
  // Caller-supplied `from` always wins (e.g. SendEmailDialog already chose one).
  let resolvedFrom = from || FROM_DEFAULT;
  if (!from && userId) {
    const { data: dom } = await supabase
      .from("sending_domains")
      .select("domain, default_from_local, is_default, verified_at")
      .eq("user_id", userId)
      .eq("status", "verified")
      .order("is_default", { ascending: false })
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dom?.domain) {
      const { data: brand } = await supabase
        .from("business_branding")
        .select("default_sender_name, business_name")
        .eq("user_id", userId)
        .maybeSingle();
      const name = brand?.default_sender_name || brand?.business_name || "CloseSync AI";
      const local = (dom as any).default_from_local || "hello";
      resolvedFrom = `${name} <${local}@${dom.domain}>`;
    }
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
        from: resolvedFrom,
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
