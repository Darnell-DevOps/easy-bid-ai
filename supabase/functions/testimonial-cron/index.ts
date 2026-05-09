// Processes pending review requests: sends initial emails and follow-up reminders.
// Runs on cron (every 30 min). Idempotent per request via status + reminder_count.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://app.closesync.io";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function sendEmail(args: {
  templateName: string;
  recipientEmail: string;
  data: Record<string, unknown>;
  idempotencyKey: string;
  userId: string;
}) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify(args),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const now = new Date();
  let processed = 0, reminded = 0, expired = 0;

  // 1. Send pending requests
  const { data: pending } = await supabase
    .from("review_requests")
    .select("id, user_id, client_name, client_email, token, status, reminder_count")
    .eq("status", "pending")
    .not("client_email", "is", null)
    .limit(100);

  for (const r of pending ?? []) {
    const { data: settings } = await supabase
      .from("testimonial_settings").select("*").eq("user_id", r.user_id).maybeSingle();
    const ok = await sendEmail({
      templateName: "review-request",
      recipientEmail: r.client_email!,
      userId: r.user_id,
      idempotencyKey: `review-request:${r.id}`,
      data: {
        client_name: r.client_name,
        from_name: settings?.from_name || "",
        custom_message: settings?.custom_message || "",
        google_review_url: settings?.google_review_url || "",
        url: `${APP_URL}/testimonial/${r.token}`,
      },
    });
    if (ok) {
      await supabase.from("review_requests")
        .update({ status: "sent", sent_at: now.toISOString() })
        .eq("id", r.id);
      processed++;
    }
  }

  // 2. Send follow-up reminders for sent (uncompleted) requests past follow_up_days since last action
  const { data: sentReqs } = await supabase
    .from("review_requests")
    .select("id, user_id, client_name, client_email, token, sent_at, last_reminder_at, reminder_count")
    .eq("status", "sent")
    .limit(200);

  for (const r of sentReqs ?? []) {
    const { data: settings } = await supabase
      .from("testimonial_settings").select("*").eq("user_id", r.user_id).maybeSingle();
    const followUpDays = settings?.follow_up_days ?? 4;
    const maxReminders = settings?.max_reminders ?? 2;

    const lastAction = r.last_reminder_at ?? r.sent_at;
    if (!lastAction) continue;
    const ageDays = (now.getTime() - new Date(lastAction).getTime()) / 86400000;
    if (ageDays < followUpDays) continue;

    if (r.reminder_count >= maxReminders) {
      await supabase.from("review_requests")
        .update({ status: "expired" }).eq("id", r.id);
      expired++;
      continue;
    }

    const ok = await sendEmail({
      templateName: "review-reminder",
      recipientEmail: r.client_email!,
      userId: r.user_id,
      idempotencyKey: `review-reminder:${r.id}:${r.reminder_count + 1}`,
      data: {
        client_name: r.client_name,
        from_name: settings?.from_name || "",
        google_review_url: settings?.google_review_url || "",
        url: `${APP_URL}/testimonial/${r.token}`,
      },
    });
    if (ok) {
      await supabase.from("review_requests")
        .update({
          last_reminder_at: now.toISOString(),
          reminder_count: r.reminder_count + 1,
        })
        .eq("id", r.id);
      reminded++;
    }
  }

  return new Response(JSON.stringify({ ok: true, processed, reminded, expired }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
