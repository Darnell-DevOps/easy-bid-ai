// Hourly cron: queues renewal reminders (T-30/T-14/T-7) for active retainers
// with end_date approaching, and ensures payment_failed reminders exist for
// retainers currently in dunning. Idempotent via UNIQUE(retainer_id, kind).
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok");
  }
  try {
    const now = new Date();

    // 1) Renewal reminders: scan active retainers with end_date set
    const { data: retainers } = await supabase
      .from("retainers")
      .select(
        "id, user_id, end_date, has_failed_payment, payment_retry_count, status, auto_renew",
      )
      .eq("status", "active");

    let queued = 0;

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
          if (!error) queued++;
        }
      }
    }

    // 2) Ensure payment_failed reminders exist for any retainer in dunning
    const { data: failed } = await supabase
      .from("retainers")
      .select("id, user_id, payment_retry_count")
      .eq("has_failed_payment", true);

    for (const r of failed || []) {
      const kind = (r.payment_retry_count || 0) >= 3
        ? "payment_final"
        : "payment_failed";
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
    }

    return new Response(JSON.stringify({ ok: true, queued }), {
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
