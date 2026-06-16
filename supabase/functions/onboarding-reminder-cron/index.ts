// Hourly cron: sends T+2 day and T+5 day reminders to clients for
// onboarding forms that were sent but not yet completed. Idempotent via
// send-email's email_send_log and whatsapp_send_log idempotency keys.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWhatsAppFromCron } from "../_shared/whatsapp.ts";

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

    let evaluated = 0;
    let emailed = 0;
    let waSent = 0;
    let skipped = 0;

    for (const f of forms || []) {
      evaluated++;
      const stage = stageFor(daysSince(f.sent_at as string, now));
      if (!stage) { skipped++; continue; }

      const formUrl = `${APP_URL}/onboarding/${f.access_token}`;
      const idemBase = `onboarding-remind-${f.id}-${stage}`;

      if (f.client_email) {
        try {
          const { error: sendErr } = await supabase.functions.invoke("send-email", {
            body: {
              templateName: "onboarding-reminder",
              recipientEmail: f.client_email,
              userId: f.user_id,
              idempotencyKey: idemBase,
              data: {
                client_name: f.client_name || "there",
                service_type: f.service_type || "",
                url: formUrl,
                stage,
              },
            },
          });
          if (!sendErr) emailed++;
          else console.error("onboarding reminder email failed:", sendErr.message);
        } catch (e: any) {
          console.error("send-email threw:", e?.message || e);
        }
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
      if (phone) {
        const waBody = stage === "t2"
          ? `Hi ${f.client_name || "there"}, a quick reminder to complete your onboarding so we can get started:\n${formUrl}`
          : `Hi ${f.client_name || "there"}, we're still waiting on your onboarding details. You can finish it here:\n${formUrl}`;
        const res = await sendWhatsAppFromCron({
          supabase,
          userId: f.user_id,
          to: phone,
          body: waBody,
          autoKey: "auto_onboarding_reminders",
          context: `onboarding_remind_${stage}`,
          relatedId: f.id,
          idempotencyKey: `wa-${idemBase}`,
        });
        if (res.sent) waSent++;
        else if (res.error) console.error("onboarding WA failed:", res.error);
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
