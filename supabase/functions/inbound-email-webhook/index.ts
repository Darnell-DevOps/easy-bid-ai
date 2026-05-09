// Inbound email webhook — provider-agnostic.
// Accepts a parsed email payload from any inbound-email service (SendGrid Inbound Parse,
// Postmark Inbound, Cloudflare Worker, Mailgun, etc.) and:
//   1. Resolves recipient address (leads-{slug}@...) to a user_id
//   2. Optionally validates a per-user shared secret (stronger than open ingest)
//   3. Calls the AI lead-response model to extract qualification + draft a reply
//   4. Creates a `clients` row marked unread + saves the draft reply
//
// POST /inbound-email-webhook
// Body shape (any of these field names accepted):
//   {
//     "to":      "leads-abc123@notify.closesync.io" | string[],
//     "from":    "Jane <jane@example.com>",
//     "subject": "Quick question about pricing",
//     "text":    "Plain text body...",
//     "html":    "<p>Optional HTML body</p>",
//     "secret":  "optional per-user shared secret"
//   }
//
// Auth: public endpoint (verify_jwt = false). Security comes from:
//   - The slug being unguessable (12 hex chars)
//   - Optional `secret` parameter or `X-Inbound-Secret` header that must match alias.inbound_secret
//
// Returns: { ok: true, client_id: string, draft: { subject, body } }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-inbound-secret",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickRecipient(to: unknown): string | null {
  if (!to) return null;
  const arr = Array.isArray(to) ? to : [to];
  for (const item of arr) {
    if (typeof item !== "string") continue;
    const match = item.match(/[\w.+\-]+@[\w.\-]+\.[a-zA-Z]{2,}/);
    if (match) return match[0].toLowerCase();
  }
  return null;
}

function extractSlug(address: string): string | null {
  // leads-{slug}@host  OR  leads+{slug}@host  OR  {slug}@leads.host
  const local = address.split("@")[0] || "";
  const dashMatch = local.match(/^leads[-+](.+)$/i);
  if (dashMatch) return dashMatch[1].toLowerCase();
  // Accept bare slug at the leads. subdomain
  const host = address.split("@")[1] || "";
  if (/^leads\./i.test(host)) return local.toLowerCase();
  return null;
}

function parseFromName(from: string): { name: string; email: string | null } {
  if (!from) return { name: "Unknown", email: null };
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || m[2].split("@")[0], email: m[2].trim().toLowerCase() };
  const emailMatch = from.match(/[\w.+\-]+@[\w.\-]+/);
  if (emailMatch) return { name: emailMatch[0].split("@")[0], email: emailMatch[0].toLowerCase() };
  return { name: from.trim() || "Unknown", email: null };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

async function callLeadAI(opts: { name: string; email: string | null; message: string }) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

  const system = `You are an elite sales assistant. Draft a reply to an inbound lead and extract qualification info.
Rules:
- Reply: warm, professional, conversion-focused, under 180 words. Reference what they said. Ask 1–2 sharp qualification questions if missing. End with a clear next step (call or proposal). Sign off as "Best,".
- Quality: "High", "Medium", "Low" based on clarity, budget, urgency, and fit.
- Recommendation: "High" -> "Recommend generating proposal"; "Medium" -> "Recommend asking more questions"; "Low" -> "May not be worth pursuing".
Return ONLY by calling the tool.`;

  const user = `Lead name: ${opts.name}
Lead email: ${opts.email || "(unknown)"}

Their message:
"""
${opts.message}
"""`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      tools: [{
        type: "function",
        function: {
          name: "draft_lead_reply",
          description: "Draft a reply and extract qualification details",
          parameters: {
            type: "object",
            properties: {
              reply: { type: "string" },
              reply_subject: { type: "string", description: "Short Re: style subject" },
              service_requested: { type: "string" },
              budget: { type: "string" },
              timeline: { type: "string" },
              goals: { type: "string" },
              notes: { type: "string" },
              lead_quality: { type: "string", enum: ["High", "Medium", "Low"] },
              quality_reason: { type: "string" },
              ai_recommendation: { type: "string" },
            },
            required: ["reply", "reply_subject", "service_requested", "budget", "timeline", "goals", "notes", "lead_quality", "quality_reason", "ai_recommendation"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "draft_lead_reply" } },
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    console.error("AI gateway error", r.status, t);
    return null;
  }
  const data = await r.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try { return JSON.parse(args); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

  const recipient = pickRecipient(body.to ?? body.recipient ?? body.envelope?.to);
  if (!recipient) return jsonResponse({ error: "Missing recipient (to)" }, 400);

  const slug = extractSlug(recipient);
  if (!slug) return jsonResponse({ error: "Recipient address does not match an inbound alias" }, 400);

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: alias, error: aliasErr } = await svc
    .from("user_inbound_aliases")
    .select("user_id, inbound_secret")
    .eq("slug", slug)
    .maybeSingle();
  if (aliasErr || !alias) {
    console.warn("No alias for slug", slug);
    return jsonResponse({ error: "Unknown inbound alias" }, 404);
  }

  // Optional shared-secret enforcement
  const providedSecret = body.secret || req.headers.get("x-inbound-secret");
  if (providedSecret && providedSecret !== alias.inbound_secret) {
    return jsonResponse({ error: "Invalid secret" }, 401);
  }

  const fromRaw = String(body.from ?? body.sender ?? body.envelope?.from ?? "");
  const { name, email: fromEmail } = parseFromName(fromRaw);
  const subject = String(body.subject ?? "(No subject)").trim().slice(0, 300);
  const textBody = String(body.text ?? "").trim();
  const htmlBody = String(body.html ?? "").trim();
  const message = textBody || (htmlBody ? stripHtml(htmlBody) : "");

  if (!message || message.length < 3) {
    return jsonResponse({ error: "Empty email body" }, 400);
  }

  // Run AI (best-effort — never block ingest)
  let ai: any = null;
  try {
    ai = await callLeadAI({ name, email: fromEmail, message });
  } catch (e) {
    console.error("AI failed, ingesting without draft:", e);
  }

  const insertPayload: Record<string, unknown> = {
    user_id: alias.user_id,
    name,
    email: fromEmail,
    status: "New",
    is_active: true,
    lead_source: "Email",
    original_lead_message: message.slice(0, 8000),
    lead_inbound_subject: subject,
    lead_inbound_from_email: fromEmail,
    unread_at: new Date().toISOString(),
  };
  if (ai) {
    insertPayload.service_requested = ai.service_requested || null;
    insertPayload.budget = ai.budget || null;
    insertPayload.timeline = ai.timeline || null;
    insertPayload.goals = ai.goals || null;
    insertPayload.lead_quality = ai.lead_quality || null;
    insertPayload.ai_recommendation = ai.ai_recommendation || null;
    insertPayload.lead_draft_reply = ai.reply || null;
    insertPayload.lead_draft_subject = ai.reply_subject || `Re: ${subject}`;
  }

  const { data: client, error: insertErr } = await svc
    .from("clients")
    .insert(insertPayload)
    .select("id")
    .single();
  if (insertErr) {
    console.error("Insert client failed", insertErr);
    return jsonResponse({ error: "Could not save lead" }, 500);
  }

  await svc
    .from("user_inbound_aliases")
    .update({ last_inbound_at: new Date().toISOString() })
    .eq("user_id", alias.user_id);

  return jsonResponse({
    ok: true,
    client_id: client.id,
    draft: ai ? { subject: insertPayload.lead_draft_subject, body: insertPayload.lead_draft_reply } : null,
  });
});
