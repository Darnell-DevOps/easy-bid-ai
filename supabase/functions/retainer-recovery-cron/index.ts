// Hourly cron: queues renewal reminders (T-30/T-14/T-7) for active retainers
// with end_date approaching, and ensures payment_failed reminders exist for
// retainers currently in dunning. Idempotent via UNIQUE(retainer_id, kind).
// Also fires real emails to the retainer owner via send-email.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWhatsAppFromCron } from "../_shared/whatsapp.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

async function ownerEmail(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

async function sendEmail(args: {
  templateName: string;
  recipientEmail: string;
  data: Record<string, unknown>;
  idempotencyKey: string;
  userId?: string;
}) {
  try {
    const { error } = await supabase.functions.invoke("send-email", { body: args });
    if (error) console.error("send-email invoke error:", error.message);
  } catch (e: any) {
    console.error("send-email exception:", e?.message || e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  try {
    const now = new Date();

    // 1) Renewal reminders
    const { data: retainers } = await supabase
      .from("retainers")
      .select("id, user_id, client_name, end_date, status")
      .eq("status", "active");

    let queued = 0;
    let emailed = 0;

    for (const r of retainers || []) {
      if (!r.end_date) continue;
      const days = daysBetween(now, new Date(r.end_date));
      const windows: { kind: string; lo: number; hi: number }[] = [
        { kind: "renewal_t30", lo: 28, hi: 31 },
        { kind: "renewal_t14", lo: 13, hi: 15 },
        { kind: "renewal_t7", lo: 6, hi: 8 },
      ];
      for (const w of windows) {
        if (days >= w.lo && days <= w.hi) {
          const { error } = await supabase.from("retainer_reminders").upsert(
            {
              user_id: r.user_id,
              retainer_id: r.id,
              kind: w.kind,
              scheduled_for: now.toISOString(),
              status: "pending",
              channel: "in_app",
            },
            { onConflict: "retainer_id,kind", ignoreDuplicates: true },
          );
          if (!error) {
            queued++;
            const to = await ownerEmail(r.user_id);
            if (to) {
              await sendEmail({
                templateName: "renewal-reminder",
                recipientEmail: to,
                userId: r.user_id,
                idempotencyKey: `renewal-${r.id}-${w.kind}`,
                data: {
                  client_name: r.client_name,
                  end_date: r.end_date,
                  days_until: days,
                  url: `https://app.closesync.io/retainers/${r.id}`,
                },
              });
              emailed++;
            }
          }
        }
      }
    }

    // 2) Payment failure reminders
    const { data: failed } = await supabase
      .from("retainers")
      .select("id, user_id, client_name, client_id, payment_retry_count, failed_payment_reason")
      .eq("has_failed_payment", true);

    for (const r of failed || []) {
      const isFinal = (r.payment_retry_count || 0) >= 3;
      const kind = isFinal ? "payment_final" : "payment_failed";
      await supabase.from("retainer_reminders").upsert(
        {
          user_id: r.user_id,
          retainer_id: r.id,
          kind,
          scheduled_for: now.toISOString(),
          status: "pending",
          channel: "in_app",
        },
        { onConflict: "retainer_id,kind", ignoreDuplicates: true },
      );
      const to = await ownerEmail(r.user_id);
      if (to) {
        await sendEmail({
          templateName: "payment-failed",
          recipientEmail: to,
          userId: r.user_id,
          idempotencyKey: `payfail-${r.id}-${r.payment_retry_count || 0}`,
          data: {
            client_name: r.client_name,
            reason: r.failed_payment_reason || "",
            severity: isFinal ? "final" : "warning",
            url: `https://app.closesync.io/recovery`,
          },
        });
        emailed++;
      }

      // WhatsApp to the client (no-op when toggle off / no phone).
      if ((r as any).client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("phone")
          .eq("id", (r as any).client_id)
          .maybeSingle();
        const phone = (client as any)?.phone as string | undefined;
        if (phone) {
          const waBody = isFinal
            ? `Hi ${r.client_name}, this is a final reminder that your ${r.client_name ? "" : ""}retainer payment didn't go through. Please update your details here: https://app.closesync.io/recovery`
            : `Hi ${r.client_name}, we had trouble processing your retainer payment. You can update your details here: https://app.closesync.io/recovery`;
          await sendWhatsAppFromCron({
            supabase,
            userId: r.user_id,
            to: phone,
            body: waBody,
            autoKey: "auto_payment_reminders",
            context: kind,
            relatedId: r.id,
            idempotencyKey: `wa-payfail-${r.id}-${r.payment_retry_count || 0}`,
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, queued, emailed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("retainer-recovery-cron error:", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
