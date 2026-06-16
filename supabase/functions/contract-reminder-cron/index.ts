// Hourly cron: sends T+2 day and T+5 day signing reminders to clients for
// contracts that were sent but not yet signed. Idempotent via send-email's
// email_send_log unique idempotency_key and whatsapp_send_log idempotency_key.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWhatsAppFromCron } from "../_shared/whatsapp.ts";
import { recordReminderAudit } from "../_shared/reminder-audit.ts";

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
    const { data: contracts, error } = await supabase
      .from("contracts")
      .select("id, user_id, client_id, client_name, client_email, title, signing_token, status, sent_at, signed_at")
      .in("status", ["sent", "viewed"])
      .is("signed_at", null)
      .not("sent_at", "is", null);
    if (error) throw error;

    let evaluated = 0;
    let emailed = 0;
    let waSent = 0;
    let skipped = 0;

    for (const c of contracts || []) {
      evaluated++;
      const stage = stageFor(daysSince(c.sent_at as string, now));
      if (!stage) { skipped++; continue; }

      const signingUrl = `${APP_URL}/sign/${c.signing_token}`;
      const idemBase = `contract-remind-${c.id}-${stage}`;

      // 1) Email reminder to client
      if (c.client_email) {
        await recordReminderAudit(supabase, {
          userId: c.user_id, kind: "contract_remind", stage, channel: "email",
          status: "attempted", relatedId: c.id, recipient: c.client_email,
          idempotencyKey: idemBase,
        });
        try {
          const { error: sendErr, data: sendData } = await supabase.functions.invoke("send-email", {
            body: {
              templateName: "contract-signature-reminder",
              recipientEmail: c.client_email,
              userId: c.user_id,
              idempotencyKey: idemBase,
              data: {
                client_name: c.client_name || "there",
                title: c.title,
                url: signingUrl,
                stage,
              },
            },
          });
          if (sendErr) {
            console.error("contract reminder email failed:", sendErr.message);
            await recordReminderAudit(supabase, {
              userId: c.user_id, kind: "contract_remind", stage, channel: "email",
              status: "failed", relatedId: c.id, recipient: c.client_email,
              idempotencyKey: idemBase, error: sendErr.message,
            });
          } else {
            emailed++;
            const deduped = !!(sendData as any)?.deduped;
            await recordReminderAudit(supabase, {
              userId: c.user_id, kind: "contract_remind", stage, channel: "email",
              status: deduped ? "deduped" : "sent",
              relatedId: c.id, recipient: c.client_email,
              idempotencyKey: idemBase,
            });
          }
        } catch (e: any) {
          console.error("send-email threw:", e?.message || e);
          await recordReminderAudit(supabase, {
            userId: c.user_id, kind: "contract_remind", stage, channel: "email",
            status: "failed", relatedId: c.id, recipient: c.client_email,
            idempotencyKey: idemBase, error: e?.message || String(e),
          });
        }
      } else {
        await recordReminderAudit(supabase, {
          userId: c.user_id, kind: "contract_remind", stage, channel: "email",
          status: "skipped", relatedId: c.id, recipient: null,
          idempotencyKey: idemBase, error: "no_client_email",
        });
      }

      // 2) WhatsApp reminder (no-op without phone, auto toggle off, or sender not set)
      let phone: string | null = null;
      if (c.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("phone")
          .eq("id", c.client_id)
          .maybeSingle();
        phone = ((client as any)?.phone as string) || null;
      }
      const waKey = `wa-${idemBase}`;
      if (phone) {
        const waBody = stage === "t2"
          ? `Hi ${c.client_name || "there"}, just a quick reminder to review and sign your contract "${c.title}":\n${signingUrl}`
          : `Hi ${c.client_name || "there"}, your contract "${c.title}" is still waiting on your signature. You can sign it here:\n${signingUrl}`;
        await recordReminderAudit(supabase, {
          userId: c.user_id, kind: "contract_remind", stage, channel: "whatsapp",
          status: "attempted", relatedId: c.id, recipient: phone,
          idempotencyKey: waKey,
        });
        const res = await sendWhatsAppFromCron({
          supabase,
          userId: c.user_id,
          to: phone,
          body: waBody,
          autoKey: "auto_contract_reminders",
          context: `contract_remind_${stage}`,
          relatedId: c.id,
          idempotencyKey: waKey,
        });
        if (res.sent) {
          waSent++;
          await recordReminderAudit(supabase, {
            userId: c.user_id, kind: "contract_remind", stage, channel: "whatsapp",
            status: "sent", relatedId: c.id, recipient: phone, idempotencyKey: waKey,
          });
        } else if (res.skipped === "deduped") {
          await recordReminderAudit(supabase, {
            userId: c.user_id, kind: "contract_remind", stage, channel: "whatsapp",
            status: "deduped", relatedId: c.id, recipient: phone, idempotencyKey: waKey,
          });
        } else if (res.error) {
          console.error("contract WA failed:", res.error);
          await recordReminderAudit(supabase, {
            userId: c.user_id, kind: "contract_remind", stage, channel: "whatsapp",
            status: "failed", relatedId: c.id, recipient: phone,
            idempotencyKey: waKey, error: res.error,
          });
        } else {
          await recordReminderAudit(supabase, {
            userId: c.user_id, kind: "contract_remind", stage, channel: "whatsapp",
            status: "skipped", relatedId: c.id, recipient: phone,
            idempotencyKey: waKey, error: res.skipped || null,
          });
        }
      } else {
        await recordReminderAudit(supabase, {
          userId: c.user_id, kind: "contract_remind", stage, channel: "whatsapp",
          status: "skipped", relatedId: c.id, recipient: null,
          idempotencyKey: waKey, error: "no_client_phone",
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, evaluated, emailed, waSent, skipped }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("contract-reminder-cron error:", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
