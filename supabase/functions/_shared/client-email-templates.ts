// Deno-side port of src/lib/email-templates-defaults.ts.
// Keep the CLIENT_TEMPLATES content byte-identical to the source; only the
// environment (Deno + supabase client) differs. Adds `renderClientEmail`
// which loads per-user override + branding and returns rendered subject/html/text.

export type ClientTemplateKey =
  | "proposal_sent"
  | "contract_sent"
  | "contract_reminder"
  | "payment_request"
  | "payment_reminder"
  | "booking_confirmation"
  | "onboarding_welcome"
  | "onboarding_reminder"
  | "retainer_renewal"
  | "payment_failed_followup"
  | "client_followup";

export interface ClientTemplate {
  key: ClientTemplateKey;
  label: string;
  description: string;
  subject: string;
  body: string;
  cta_text: string;
  cta_url_var: string;
  sign_off: string;
  variables: string[];
}

const SIGN_OFF = "Talk soon,\n{{sender_name}}\n{{business_name}}";

export const CLIENT_TEMPLATES: ClientTemplate[] = [
  {
    key: "proposal_sent",
    label: "Proposal sent",
    description: "Sent when you share a new proposal with a client.",
    subject: "Your proposal from {{business_name}}",
    body:
      "Hi {{client_name}},\n\n" +
      "Thanks for the conversation — I've put together a proposal based on what we discussed.\n\n" +
      "It covers the scope, timeline, and investment ({{invoice_amount}}). Take a look whenever you have a few minutes and let me know if anything needs adjusting.\n\n" +
      "Happy to jump on a quick call if that's easier.",
    cta_text: "View proposal",
    cta_url_var: "proposal_link",
    sign_off: SIGN_OFF,
    variables: ["client_name", "business_name", "proposal_link", "invoice_amount", "sender_name"],
  },
  {
    key: "contract_sent",
    label: "Contract sent",
    description: "Sent when a contract is ready for the client to sign.",
    subject: "Contract ready to sign — {{business_name}}",
    body:
      "Hi {{client_name}},\n\n" +
      "Great news — your contract is ready. It's a quick e-signature, no printing required.\n\n" +
      "Once it's signed we can lock in your start date and get moving.",
    cta_text: "Review & sign",
    cta_url_var: "contract_link",
    sign_off: SIGN_OFF,
    variables: ["client_name", "business_name", "contract_link", "signature_link", "sender_name"],
  },
  {
    key: "contract_reminder",
    label: "Contract reminder",
    description: "Friendly nudge when a contract is still unsigned.",
    subject: "Quick reminder: your contract is waiting",
    body:
      "Hi {{client_name}},\n\n" +
      "Just a gentle reminder that your contract is still waiting for a signature. It only takes a minute.\n\n" +
      "Let me know if anything in it needs a tweak — happy to update it.",
    cta_text: "Sign contract",
    cta_url_var: "contract_link",
    sign_off: SIGN_OFF,
    variables: ["client_name", "business_name", "contract_link", "signature_link", "sender_name"],
  },
  {
    key: "payment_request",
    label: "Payment request",
    description: "Sent when an invoice or payment link is ready.",
    subject: "Invoice from {{business_name}} — {{invoice_amount}}",
    body:
      "Hi {{client_name}},\n\n" +
      "Your invoice for {{invoice_amount}} is ready. You can pay securely using the link below — it accepts all major cards.\n\n" +
      "Due {{due_date}}. Let me know if you need anything changed.",
    cta_text: "Pay invoice",
    cta_url_var: "payment_link",
    sign_off: SIGN_OFF,
    variables: ["client_name", "business_name", "payment_link", "invoice_amount", "due_date", "sender_name"],
  },
  {
    key: "payment_reminder",
    label: "Payment reminder",
    description: "Polite reminder for an outstanding invoice.",
    subject: "Friendly reminder: invoice {{invoice_amount}}",
    body:
      "Hi {{client_name}},\n\n" +
      "Just a quick nudge — your invoice for {{invoice_amount}} is still outstanding.\n\n" +
      "If it's already on the way, no worries. Otherwise the link below will sort it in seconds.",
    cta_text: "Settle invoice",
    cta_url_var: "payment_link",
    sign_off: SIGN_OFF,
    variables: ["client_name", "business_name", "payment_link", "invoice_amount", "due_date", "sender_name"],
  },
  {
    key: "booking_confirmation",
    label: "Booking confirmation",
    description: "Sent after a client books a meeting.",
    subject: "You're booked — see you soon",
    body:
      "Hi {{client_name}},\n\n" +
      "Confirmed — looking forward to our chat. Details are in the calendar invite, and you can join using the link below when the time comes.\n\n" +
      "If anything changes, you can reschedule at any time.",
    cta_text: "View booking",
    cta_url_var: "booking_link",
    sign_off: SIGN_OFF,
    variables: ["client_name", "business_name", "booking_link", "sender_name"],
  },
  {
    key: "onboarding_welcome",
    label: "Onboarding welcome",
    description: "First message after a client comes on board.",
    subject: "Welcome aboard — let's get started",
    body:
      "Hi {{client_name}},\n\n" +
      "Excited to be working together! To kick things off I just need a few details from you. The form below should take less than 5 minutes.\n\n" +
      "Once it's in I'll get the project rolling.",
    cta_text: "Start onboarding",
    cta_url_var: "onboarding_link",
    sign_off: SIGN_OFF,
    variables: ["client_name", "business_name", "onboarding_link", "sender_name"],
  },
  {
    key: "onboarding_reminder",
    label: "Onboarding reminder",
    description: "Reminder if the client hasn't completed onboarding.",
    subject: "Quick reminder: finish your onboarding",
    body:
      "Hi {{client_name}},\n\n" +
      "Just a nudge — there are still a few onboarding details I need to get your project moving. It only takes a few minutes.\n\n" +
      "Reply to this email if you've hit a snag and I'll help.",
    cta_text: "Finish onboarding",
    cta_url_var: "onboarding_link",
    sign_off: SIGN_OFF,
    variables: ["client_name", "business_name", "onboarding_link", "sender_name"],
  },
  {
    key: "retainer_renewal",
    label: "Retainer renewal",
    description: "Heads-up before a retainer renews.",
    subject: "Your {{business_name}} retainer renews soon",
    body:
      "Hi {{client_name}},\n\n" +
      "A quick heads-up — your retainer ({{retainer_amount}}) is set to renew on {{due_date}}. No action needed if you're happy to continue.\n\n" +
      "If you'd like to adjust the scope or pause, just hit reply.",
    cta_text: "Manage retainer",
    cta_url_var: "payment_link",
    sign_off: SIGN_OFF,
    variables: ["client_name", "business_name", "retainer_amount", "due_date", "payment_link", "sender_name"],
  },
  {
    key: "payment_failed_followup",
    label: "Failed payment follow-up",
    description: "Sent when a recurring or invoice payment fails.",
    subject: "We couldn't process your last payment",
    body:
      "Hi {{client_name}},\n\n" +
      "Heads up — your last payment of {{invoice_amount}} didn't go through. It usually means the card needs updating.\n\n" +
      "Use the secure link below to retry or update your card and we're back on track.",
    cta_text: "Update payment",
    cta_url_var: "payment_link",
    sign_off: SIGN_OFF,
    variables: ["client_name", "business_name", "payment_link", "invoice_amount", "sender_name"],
  },
  {
    key: "client_followup",
    label: "General client follow-up",
    description: "Use for any general client follow-up.",
    subject: "Following up — {{business_name}}",
    body:
      "Hi {{client_name}},\n\n" +
      "Just circling back on this. Let me know if there's anything I can clarify or any blockers I can help unblock.\n\n" +
      "Happy to jump on a quick call if that's easier.",
    cta_text: "Get in touch",
    cta_url_var: "booking_link",
    sign_off: SIGN_OFF,
    variables: ["client_name", "business_name", "booking_link", "sender_name"],
  },
];

export const TEMPLATE_BY_KEY: Record<ClientTemplateKey, ClientTemplate> =
  CLIENT_TEMPLATES.reduce((acc, t) => ({ ...acc, [t.key]: t }), {} as any);

export const LEGACY_NAME_TO_KEY: Record<string, ClientTemplateKey> = {
  "proposal-sent": "proposal_sent",
  "contract-signature-reminder": "contract_reminder",
  "contract-sent": "contract_sent",
  "payment-request": "payment_request",
  "payment-reminder": "payment_reminder",
  "renewal-reminder": "retainer_renewal",
  "retainer-notification": "retainer_renewal",
  "booking-confirmation": "booking_confirmation",
  "onboarding-welcome": "onboarding_welcome",
  "onboarding-reminder": "onboarding_reminder",
  "follow-up-reminder": "client_followup",
  "payment-failed": "payment_failed_followup",
};

export interface RenderContext {
  vars: Record<string, string | number | undefined | null>;
  branding: {
    business_name?: string | null;
    logo_url?: string | null;
    brand_color?: string | null;
    sender_name?: string | null;
    sign_off?: string | null;
    reply_to_email?: string | null;
  };
}

function interpolate(input: string, ctx: RenderContext): string {
  const all: Record<string, string> = {
    business_name: String(ctx.branding.business_name || "your team"),
    sender_name: String(ctx.branding.sender_name || ctx.branding.business_name || "the team"),
    ...Object.fromEntries(
      Object.entries(ctx.vars).map(([k, v]) => [k, v == null ? "" : String(v)]),
    ),
  };
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => all[k] ?? `{{${k}}}`);
}

export function renderClientTemplate(
  template: ClientTemplate,
  ctx: RenderContext,
  override?: { subject?: string; body?: string; cta_text?: string; sign_off?: string },
): { subject: string; html: string; text: string } {
  const subject = interpolate(override?.subject ?? template.subject, ctx);
  const body = interpolate(override?.body ?? template.body, ctx);
  const ctaText = interpolate(override?.cta_text ?? template.cta_text, ctx);
  const signOff = interpolate(override?.sign_off ?? template.sign_off, ctx);
  const ctaHref = String(ctx.vars[template.cta_url_var] ?? "");
  const brand = ctx.branding.brand_color || "#3b82f6";
  const logo = ctx.branding.logo_url
    ? `<img src="${escapeAttr(ctx.branding.logo_url)}" alt="" style="max-height:36px;margin-bottom:18px;">`
    : "";
  const bodyHtml = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.65;color:#1f2937;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const ctaBlock = ctaHref
    ? `<p style="margin:24px 0;"><a href="${escapeAttr(ctaHref)}" style="background:${brand};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600;font-family:-apple-system,Segoe UI,Inter,sans-serif;">${escapeHtml(ctaText)}</a></p>`
    : "";
  const signOffHtml = `<p style="margin:24px 0 0;line-height:1.6;color:#374151;white-space:pre-line;">${escapeHtml(signOff)}</p>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:-apple-system,Segoe UI,Inter,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;padding:32px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
      <tr><td>${logo}${bodyHtml}${ctaBlock}${signOffHtml}</td></tr>
    </table>
  </td></tr>
</table></body></html>`;

  const text = [body, ctaHref ? `\n${ctaText}: ${ctaHref}` : "", `\n${signOff}`].join("\n");
  return { subject, html, text };
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}
export function escapeAttr(s: string) {
  return s.replace(/"/g, "&quot;");
}

export async function renderClientEmail(
  supabase: any,
  userId: string | null | undefined,
  legacyTemplateName: string,
  vars: Record<string, string | number | undefined | null>,
): Promise<{ subject: string; html: string; text: string } | null> {
  const key = LEGACY_NAME_TO_KEY[legacyTemplateName];
  if (!key) return null;
  const template = TEMPLATE_BY_KEY[key];
  if (!template) return null;

  let override: { subject?: string; body?: string; cta_text?: string; sign_off?: string } | undefined;
  let branding: RenderContext["branding"] = {};
  if (userId) {
    const [{ data: custom }, { data: brand }] = await Promise.all([
      supabase.from("email_templates").select("subject, body, cta_text, sign_off, sender_display_name")
        .eq("user_id", userId).eq("template_key", key).eq("is_active", true).maybeSingle(),
      supabase.from("business_branding").select("business_name, logo_url, brand_color").eq("user_id", userId).maybeSingle(),
    ]);
    if (custom) override = {
      subject: custom.subject || undefined,
      body: custom.body || undefined,
      cta_text: custom.cta_text || undefined,
      sign_off: custom.sign_off || undefined,
    };
    branding = {
      business_name: brand?.business_name ?? null,
      logo_url: brand?.logo_url ?? null,
      brand_color: brand?.brand_color ?? null,
      sender_name: (custom as any)?.sender_display_name ?? null,
    };
  }
  return renderClientTemplate(template, { vars, branding }, override);
}
