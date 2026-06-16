// Shared audit-log helper for reminder crons.
// Records every reminder attempt with status (attempted/sent/deduped/skipped/failed)
// and an idempotency key so retries don't duplicate rows.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type AuditStatus = "attempted" | "sent" | "deduped" | "skipped" | "failed";
export type AuditChannel = "email" | "whatsapp";

export interface AuditEntry {
  userId: string;
  kind: string;      // e.g. "contract_remind" | "onboarding_remind"
  stage: string;     // e.g. "t2" | "t5"
  channel: AuditChannel;
  status: AuditStatus;
  relatedId?: string;
  recipient?: string | null;
  idempotencyKey: string;
  error?: string | null;
}

/**
 * Insert a reminder audit row. Silently ignores unique-key collisions so
 * repeated cron runs don't fail when re-recording the same (key,status) pair.
 */
export async function recordReminderAudit(
  supabase: SupabaseClient,
  e: AuditEntry,
): Promise<void> {
  try {
    const { error } = await supabase.from("reminder_audit_log").insert({
      user_id: e.userId,
      kind: e.kind,
      stage: e.stage,
      channel: e.channel,
      status: e.status,
      related_id: e.relatedId ?? null,
      recipient: e.recipient ?? null,
      idempotency_key: e.idempotencyKey,
      error: e.error ? String(e.error).slice(0, 1000) : null,
    });
    // Unique violation on (idempotency_key, status) — fine, drop it.
    if (error && !/duplicate key|unique/i.test(error.message)) {
      console.error("reminder_audit insert failed:", error.message);
    }
  } catch (err: any) {
    console.error("reminder_audit threw:", err?.message || err);
  }
}
