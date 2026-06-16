// Shared helper for sending WhatsApp messages from edge functions via Twilio.
// Loads the sender's settings, respects per-user enable + auto toggles,
// dedupes against whatsapp_send_log.idempotency_key, and writes a row on success.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export type WhatsAppAutoKey =
  | "auto_proposal_reminders"
  | "auto_payment_reminders"
  | "auto_contract_reminders"
  | "auto_onboarding_reminders";

export interface WhatsAppSettings {
  whatsapp_from: string | null;
  enabled: boolean;
  auto_proposal_reminders: boolean;
  auto_payment_reminders: boolean;
  auto_contract_reminders: boolean;
  auto_onboarding_reminders: boolean;
}

export function normalizeToWhatsApp(to: string): string | null {
  const digits = (to || "").replace(/[^\d]/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `whatsapp:+${digits}`;
}

function normalizeFrom(from: string): string {
  const trimmed = (from || "").trim();
  if (trimmed.startsWith("whatsapp:")) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, "");
  return `whatsapp:+${digits}`;
}

const settingsCache = new Map<string, WhatsAppSettings | null>();

export async function getWhatsAppSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<WhatsAppSettings | null> {
  if (settingsCache.has(userId)) return settingsCache.get(userId)!;
  const { data } = await supabase
    .from("whatsapp_settings")
    .select(
      "whatsapp_from, enabled, auto_proposal_reminders, auto_payment_reminders, auto_contract_reminders, auto_onboarding_reminders",
    )
    .eq("user_id", userId)
    .maybeSingle();
  const s = (data as WhatsAppSettings | null) ?? null;
  settingsCache.set(userId, s);
  return s;
}

export interface CronSendArgs {
  supabase: SupabaseClient;
  userId: string;
  to: string;
  body: string;
  autoKey: WhatsAppAutoKey;
  context: string;
  relatedId?: string;
  idempotencyKey: string;
}

export interface CronSendResult {
  sent: boolean;
  skipped?: "twilio_unconfigured" | "no_settings" | "disabled" | "auto_off" | "no_sender" | "bad_phone" | "deduped";
  sid?: string;
  error?: string;
}

/**
 * Send a WhatsApp message from a cron context.
 * Skips silently (no exception) when Twilio isn't ready or the user opted out.
 */
export async function sendWhatsAppFromCron(args: CronSendArgs): Promise<CronSendResult> {
  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) return { sent: false, skipped: "twilio_unconfigured" };

  const settings = await getWhatsAppSettings(args.supabase, args.userId);
  if (!settings) return { sent: false, skipped: "no_settings" };
  if (!settings.enabled) return { sent: false, skipped: "disabled" };
  if (!settings[args.autoKey]) return { sent: false, skipped: "auto_off" };
  if (!settings.whatsapp_from) return { sent: false, skipped: "no_sender" };

  const to = normalizeToWhatsApp(args.to);
  if (!to) return { sent: false, skipped: "bad_phone" };

  // Idempotency check.
  const { data: existing } = await args.supabase
    .from("whatsapp_send_log")
    .select("id, twilio_sid")
    .eq("idempotency_key", args.idempotencyKey)
    .maybeSingle();
  if (existing) return { sent: false, skipped: "deduped", sid: (existing as any).twilio_sid };

  const from = normalizeFrom(settings.whatsapp_from);

  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: args.body }),
  });
  const data = await res.json();
  if (!res.ok) {
    await args.supabase.from("whatsapp_send_log").insert({
      user_id: args.userId,
      recipient: to,
      body: args.body,
      context: args.context,
      related_id: args.relatedId ?? null,
      status: "failed",
      error: JSON.stringify(data).slice(0, 1000),
      idempotency_key: args.idempotencyKey,
    });
    return { sent: false, error: data?.message || `Twilio ${res.status}` };
  }

  await args.supabase.from("whatsapp_send_log").insert({
    user_id: args.userId,
    recipient: to,
    body: args.body,
    context: args.context,
    related_id: args.relatedId ?? null,
    twilio_sid: data?.sid ?? null,
    status: data?.status || "queued",
    idempotency_key: args.idempotencyKey,
  });
  return { sent: true, sid: data?.sid };
}
