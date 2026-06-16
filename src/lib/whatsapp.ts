/**
 * WhatsApp helpers — click-to-chat (wa.me) links and message templates.
 * No external SDK; works on web + mobile WhatsApp installs.
 */

export type WaContext =
  | "lead"
  | "client"
  | "proposal"
  | "contract"
  | "onboarding"
  | "retainer";

export interface WaTemplateVars {
  clientName?: string | null;
  senderName?: string | null;
  businessName?: string | null;
  link?: string | null;
  amount?: string | null;
  dueDate?: string | null;
  serviceType?: string | null;
}

/** Strip everything except digits. Returns null if too short to be a phone number. */
export function toE164Digits(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

/** Build a wa.me link with an optional pre-filled message. Returns null if phone is invalid. */
export function waLink(phone?: string | null, message?: string | null): string | null {
  const digits = toE164Digits(phone);
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

/** Default message templates per surface. Keep concise & friendly. */
export function buildWaMessage(context: WaContext, vars: WaTemplateVars = {}): string {
  const name = vars.clientName?.trim() || "there";
  const sender = vars.senderName?.trim() || vars.businessName?.trim() || "";
  const signoff = sender ? `\n\n– ${sender}` : "";

  switch (context) {
    case "lead":
      return `Hi ${name}, thanks for reaching out! I'd love to learn more about your project and see how I can help.${signoff}`;
    case "client":
      return `Hi ${name}, just checking in — let me know if there's anything you need from me.${signoff}`;
    case "proposal":
      return `Hi ${name}, your proposal${vars.serviceType ? ` for ${vars.serviceType}` : ""} is ready. You can review it here:\n${vars.link || ""}${signoff}`;
    case "contract":
      return `Hi ${name}, here's your contract to review and sign:\n${vars.link || ""}${signoff}`;
    case "onboarding":
      return `Hi ${name}, welcome aboard! Please complete your onboarding form here:\n${vars.link || ""}${signoff}`;
    case "retainer":
      return `Hi ${name}, a friendly reminder about your ${vars.amount ? `${vars.amount} ` : ""}payment${vars.dueDate ? ` due ${vars.dueDate}` : ""}. You can settle it here:\n${vars.link || ""}${signoff}`;
    default:
      return `Hi ${name}!${signoff}`;
  }
}

export function hasValidPhone(phone?: string | null): boolean {
  return toE164Digits(phone) !== null;
}
