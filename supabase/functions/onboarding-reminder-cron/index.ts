// Hourly cron: sends T+2 day and T+5 day reminders to clients for
// onboarding forms that were sent but not yet completed. Idempotent via
// send-email's email_send_log and whatsapp_send_log idempotency keys.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWhatsAppFromCron } from "../_shared/whatsapp.ts";
import { recordReminderAudit } from "../_shared/reminder-audit.ts";
import { resolvePublicUrl } from "../_shared/customDomain.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const APP_URL = "https://app.closesync.io";

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 86_400_000;
}

type Stage = "t2" | "t5";

function stageFor(days: number): Stage | null {
  if (days >= 2 && days < 3) return "t2";
  if (days >= 5 && days < 6) return "t5";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  try {
    const now = new Date();
    const { data: forms, error } = await supabase
      .from("onboarding_forms")
      .select("id, user_id, client_id, client_name, client_email, service_type, access_token, status, sent_at, completed_at")
      .in("status", ["pending", "in_progress", "sent"])
      .is("completed_at", null)
      .not("sent_at", "is", null);
    if (error) throw error;

    // Gate on automation toggle: batch-fetch preferences for all involved users.
    // Default for onboarding_remind_client is ON (see automation_enabled default);
    // a missing preferences row => enabled, matching the settings-page default-merge.
    const userIds = Array.from(new Set((forms || []).map((f: any) => f.user_id).filter(Boolean)));
    const enabledUserIds = new Set<string>(userIds);
    if (userIds.length > 0) {
      const { data: prefs } = await supabase
        .from("automation_preferences")
        .select("user_id, preferences")
        .in("user_id", userIds);
      for (const row of prefs || []) {
        const val = (row as any).preferences?.onboarding_remind_client;
        // Only explicit `false` disables; missing key or `true` = enabled (default-on).
        if (val === false) enabledUserIds.delete((row as any).user_id);
      }
    }

    let evaluated = 0;
    let emailed = 0;
    let waSent = 0;
    let skipped = 0;

    for (const f of forms || []) {
      evaluated++;
      if (!enabledUserIds.has(f.user_id as string)) { skipped++; continue; }
      const stage = stageFor(daysSince(f.sent_at as string, now));
      if (!stage) { skipped++; continue; }

      const formUrl = await resolvePublicUrl(supabase, f.user_id, `/onboard/${f.access_token}`, "forms");
      const idemBase = `onboarding-remind-${f.id}-${stage}`;

      if (f.client_email) {
        await recordReminderAudit(supabase, {
          userId: f.user_id, kind: "onboarding_remind", stage, channel: "email",
          status: "attempted", relatedId: f.id, recipient: f.client_email,
          idempotencyKey: idemBase,
        });
        try {
          const { error: sendErr, data: sendData } = await supabase.functions.invoke("send-email", {
            body: {
              templateName: "onboarding-reminder",
              recipientEmail: f.client_email,
              userId: f.user_id,
              idempotencyKey: idemBase,
              data: {
                client_name: f.client_name || "there",
                onboarding_link: formUrl,
              },

            },
          });
          const ok = (sendData as any)?.ok === true;
          if (!ok) {
            const errMsg = (sendData as any)?.suppressed ? "suppressed" : ((sendData as any)?.error || "send_failed");
            console.error("onboarding reminder email failed:", errMsg);
            await recordReminderAudit(supabase, {
              userId: f.user_id, kind: "onboarding_remind", stage, channel: "email",
              status: "failed", relatedId: f.id, recipient: f.client_email,
              idempotencyKey: idemBase, error: errMsg,
            });
          } else {
            emailed++;
            const deduped = !!(sendData as any)?.deduped;
            await recordReminderAudit(supabase, {
              userId: f.user_id, kind: "onboarding_remind", stage, channel: "email",
              status: deduped ? "deduped" : "sent",
              relatedId: f.id, recipient: f.client_email, idempotencyKey: idemBase,
            });
          }
        } catch (e: any) {
          console.error("send-email threw:", e?.message || e);
          await recordReminderAudit(supabase, {
            userId: f.user_id, kind: "onboarding_remind", stage, channel: "email",
            status: "failed", relatedId: f.id, recipient: f.client_email,
            idempotencyKey: idemBase, error: e?.message || String(e),
          });
        }
      } else {
        await recordReminderAudit(supabase, {
          userId: f.user_id, kind: "onboarding_remind", stage, channel: "email",
          status: "skipped", relatedId: f.id, recipient: null,
          idempotencyKey: idemBase, error: "no_client_email",
        });
      }

      let phone: string | null = null;
      if (f.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("phone")
          .eq("id", f.client_id)
          .maybeSingle();
        phone = ((client as any)?.phone as string) || null;
      }
      const waKey = `wa-${idemBase}`;
      if (phone) {
        const waBody = stage === "t2"
          ? `Hi ${f.client_name || "there"}, a quick reminder to complete your onboarding so we can get started:\n${formUrl}`
          : `Hi ${f.client_name || "there"}, we're still waiting on your onboarding details. You can finish it here:\n${formUrl}`;
        await recordReminderAudit(supabase, {
          userId: f.user_id, kind: "onboarding_remind", stage, channel: "whatsapp",
          status: "attempted", relatedId: f.id, recipient: phone,
          idempotencyKey: waKey,
        });
        const res = await sendWhatsAppFromCron({
          supabase,
          userId: f.user_id,
          to: phone,
          body: waBody,
          autoKey: "auto_onboarding_reminders",
          context: `onboarding_remind_${stage}`,
          relatedId: f.id,
          idempotencyKey: waKey,
        });
        if (res.sent) {
          waSent++;
          await recordReminderAudit(supabase, {
            userId: f.user_id, kind: "onboarding_remind", stage, channel: "whatsapp",
            status: "sent", relatedId: f.id, recipient: phone, idempotencyKey: waKey,
          });
        } else if (res.skipped === "deduped") {
          await recordReminderAudit(supabase, {
            userId: f.user_id, kind: "onboarding_remind", stage, channel: "whatsapp",
            status: "deduped", relatedId: f.id, recipient: phone, idempotencyKey: waKey,
          });
        } else if (res.error) {
          console.error("onboarding WA failed:", res.error);
          await recordReminderAudit(supabase, {
            userId: f.user_id, kind: "onboarding_remind", stage, channel: "whatsapp",
            status: "failed", relatedId: f.id, recipient: phone,
            idempotencyKey: waKey, error: res.error,
          });
        } else {
          await recordReminderAudit(supabase, {
            userId: f.user_id, kind: "onboarding_remind", stage, channel: "whatsapp",
            status: "skipped", relatedId: f.id, recipient: phone,
            idempotencyKey: waKey, error: res.skipped || null,
          });
        }
      } else {
        await recordReminderAudit(supabase, {
          userId: f.user_id, kind: "onboarding_remind", stage, channel: "whatsapp",
          status: "skipped", relatedId: f.id, recipient: null,
          idempotencyKey: waKey, error: "no_client_phone",
        });
      }

      // Stamp reminded_at on first reminder for visibility
      if (stage === "t2") {
        await supabase
          .from("onboarding_forms")
          .update({ reminded_at: now.toISOString() })
          .eq("id", f.id)
          .is("reminded_at", null);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, evaluated, emailed, waSent, skipped }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("onboarding-reminder-cron error:", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
