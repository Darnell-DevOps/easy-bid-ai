// Sends 24-hour reminder emails for upcoming confirmed bookings.
// Runs every 30 min via pg_cron. Idempotent via email_send_log.idempotency_key.
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolvePublicUrl } from "../_shared/customDomain.ts";
import { cronUnauthorized, isCronAuthorized } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function send(args: {
  templateName: string;
  recipientEmail: string;
  data: Record<string, unknown>;
  idempotencyKey: string;
  userId?: string;
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
  if (!isCronAuthorized(req)) return cronUnauthorized();

  // Bookings starting in 23-25 hours from now (gives 30-min cron window slack)
  const now = new Date();
  const min = new Date(now.getTime() + 23 * 3600 * 1000).toISOString();
  const max = new Date(now.getTime() + 25 * 3600 * 1000).toISOString();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, user_id, client_email, client_name, meeting_name, scheduled_at, location_type, location_details, status, reschedule_token")
    .eq("status", "confirmed")
    .gte("scheduled_at", min)
    .lte("scheduled_at", max)
    .limit(200);

  

  let sent = 0;
  const hostEmailCache = new Map<string, string | null>();
  const getHostEmail = async (uid: string): Promise<string | null> => {
    if (hostEmailCache.has(uid)) return hostEmailCache.get(uid) ?? null;
    const { data } = await supabase.auth.admin.getUserById(uid);
    const email = data?.user?.email ?? null;
    hostEmailCache.set(uid, email);
    return email;
  };

  for (const b of bookings ?? []) {
    const when = new Date(b.scheduled_at).toLocaleString(undefined, {
      weekday: "long", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
    const baseData = {
      title: b.meeting_name,
      when,
      location: b.meeting_url || b.location_details || b.location_type,
      meeting_url: b.meeting_url || undefined,
      reschedule_url: b.reschedule_token ? await resolvePublicUrl(supabase, b.user_id, `/reschedule/${b.reschedule_token}`, "portal") : undefined,
    };

    if (b.client_email) {
      const ok = await send({
        templateName: "booking-reminder",
        recipientEmail: b.client_email,
        userId: b.user_id,
        idempotencyKey: `booking-reminder-24h:${b.id}`,
        data: { ...baseData, name: b.client_name },
      });
      if (ok) sent++;
    }

    const hostEmail = await getHostEmail(b.user_id);
    if (hostEmail) {
      const ok = await send({
        templateName: "booking-reminder",
        recipientEmail: hostEmail,
        userId: b.user_id,
        idempotencyKey: `booking-reminder-24h-host:${b.id}`,
        data: { ...baseData, name: "you", title: `${b.meeting_name} with ${b.client_name}` },
      });
      if (ok) sent++;
    }
  }

  return new Response(JSON.stringify({ ok: true, scanned: bookings?.length ?? 0, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
