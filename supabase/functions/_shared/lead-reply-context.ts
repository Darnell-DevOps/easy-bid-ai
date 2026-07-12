// Shared helper for building the "business context" block used by every AI
// prompt that drafts a reply to a lead. Extracted so inbound-email-webhook and
// lead-reply-regenerate stay in lockstep and can't drift.
//
// IMPORTANT: the string this produces is part of a live system prompt. Do not
// re-order lines, add whitespace, or rename labels — that would silently change
// the prompt sent to the model for existing users.

export type LeadPrefs = {
  business_name?: string | null;
  business_services?: string | null;
  business_ideal_client?: string | null;
  business_target_audience?: string | null;
  booking_link?: string | null;
  lead_reply_tone?: string | null;
  lead_reply_style?: string | null;
  lead_reply_length?: string | null;
  email_signature?: string | null;
  lead_auto_send_enabled?: boolean | null;
  lead_auto_send_min_confidence?: string | null;
  lead_auto_send_only_new_leads?: boolean | null;
  lead_auto_send_block_keywords?: string[] | null;
  custom_instructions?: string | null;
};

export const LENGTH_LIMIT: Record<string, string> = {
  short: "≤80 words",
  standard: "≤180 words",
  detailed: "≤300 words",
};

export interface BizContext {
  tone: string;
  style: string;
  length: string;
  bizName: string;
  services: string;
  idealClient: string;
  targetAudience: string;
  booking: string;
  customRules: string;
  bizBlock: string;
}

export function buildBizContext(prefs: LeadPrefs | null): BizContext {
  const p = prefs || {};
  const tone = p.lead_reply_tone || "friendly";
  const style = p.lead_reply_style || "consultative";
  const length = LENGTH_LIMIT[p.lead_reply_length || "standard"] || "≤180 words";
  const bizName = (p.business_name || "").trim();
  const services = (p.business_services || "").trim();
  const idealClient = (p.business_ideal_client || "").trim();
  const targetAudience = (p.business_target_audience || "").trim();
  const booking = (p.booking_link || "").trim();
  const customRules = (p.custom_instructions || "").trim();

  const bizBlock = [
    bizName ? `Business name: ${bizName}` : "",
    services ? `Services offered: ${services}` : "",
    idealClient ? `Ideal client (who this business wants more of): ${idealClient}` : "",
    targetAudience ? `Target audience / who this ISN'T for: ${targetAudience}` : "",
    booking ? `Booking link (use as call-to-action when suggesting a call): ${booking}` : "",
    customRules ? `Additional rules from the user: ${customRules}` : "",
  ].filter(Boolean).join("\n");

  return {
    tone,
    style,
    length,
    bizName,
    services,
    idealClient,
    targetAudience,
    booking,
    customRules,
    bizBlock,
  };
}
