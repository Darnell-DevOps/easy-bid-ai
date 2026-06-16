// Hourly cron: sends T+2 day and T+5 day signing reminders to clients for
// contracts that were sent but not yet signed. Idempotent via send-email's
// email_send_log unique idempotency_key and whatsapp_send_log idempotency_key.
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
        try {
          const { error: sendErr } = await supabase.functions.invoke("send-email", {
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
          if (!sendErr) emailed++;
          else console.error("contract reminder email failed:", sendErr.message);
        } catch (e: any) {
          console.error("send-email threw:", e?.message || e);
        }
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
      if (phone) {
        const waBody = stage === "t2"
          ? `Hi ${c.client_name || "there"}, just a quick reminder to review and sign your contract "${c.title}":\n${signingUrl}`
          : `Hi ${c.client_name || "there"}, your contract "${c.title}" is still waiting on your signature. You can sign it here:\n${signingUrl}`;
        const res = await sendWhatsAppFromCron({
          supabase,
          userId: c.user_id,
          to: phone,
          body: waBody,
          autoKey: "auto_contract_reminders",
          context: `contract_remind_${stage}`,
          relatedId: c.id,
          idempotencyKey: `wa-${idemBase}`,
        });
        if (res.sent) waSent++;
        else if (res.error) console.error("contract WA failed:", res.error);
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
