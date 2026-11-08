import { Webhook } from "npm:svix@2.9.1";

const LEAD_DOMAIN = "leads.closesync.io";
const EMAIL_ID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const EMAIL_ADDRESS = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

export interface ResendDelivery {
  emailId: string;
  alias: string;
  fromEmail: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function leadAlias(recipients: unknown): string | null {
  if (!Array.isArray(recipients)) return null;
  const aliases = new Set<string>();
  for (const recipient of recipients) {
    if (typeof recipient !== "string") continue;
    const parts = recipient.trim().toLowerCase().split("@");
    const [local, domain] = parts;
    if (parts.length === 2 && domain === LEAD_DOMAIN && /^leads-[\da-f]{12}$/.test(local)) {
      aliases.add(local.slice("leads-".length));
    }
  }
  return aliases.size === 1 ? aliases.values().next().value! : null;
}

function emailAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  return address.length <= 254 && EMAIL_ADDRESS.test(address) && !/[\u0000-\u001f\u007f]/.test(address)
    ? address : null;
}

export function verifyResendDelivery(raw: string, headers: Headers, secret: string): unknown {
  return new Webhook(secret).verify(raw, {
    "svix-id": headers.get("svix-id") ?? "",
    "svix-timestamp": headers.get("svix-timestamp") ?? "",
    "svix-signature": headers.get("svix-signature") ?? "",
  });
}

export function resendDelivery(event: unknown): ResendDelivery | null {
  const envelope = record(event);
  if (envelope?.type !== "email.received") return null;
  const delivery = record(envelope.data);
  const emailId = delivery?.email_id;
  const alias = leadAlias(delivery?.to);
  const fromEmail = emailAddress(delivery?.from);
  if (typeof emailId !== "string" || !EMAIL_ID.test(emailId) || !alias || !fromEmail) return null;
  return { emailId: emailId.toLowerCase(), alias, fromEmail };
}

function cleanText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit).replace(/[\u0000\uD800-\uDFFF]/gu, "") : "";
}

export function resendMessage(value: unknown, delivery: ResendDelivery) {
  const email = record(value);
  if (email?.object !== "email" || email.id !== delivery.emailId || leadAlias(email.to) !== delivery.alias
    || emailAddress(email.from) !== delivery.fromEmail) return null;

  const plain = cleanText(email.text, 16_000);
  const html = plain ? "" : cleanText(email.html, 64_000);
  const body = plain || cleanText(html
    .replace(/<(script|style)\b[^<>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, " ")
    .replace(/<[^<>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " "), 16_000);
  return {
    fromEmail: delivery.fromEmail,
    subject: cleanText(email.subject, 300).replace(/[\r\n]+/g, " ") || "(No subject)",
    body,
  };
}
