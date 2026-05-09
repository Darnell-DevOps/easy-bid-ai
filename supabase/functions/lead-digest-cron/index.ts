// Daily digest of new inbound leads. Runs once per day via pg_cron.
// For each user who has new unread leads since their last digest (or last 24h if never sent),
// sends one email summarising the new leads. Marks last_digest_sent_at on the alias.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: aliases, error } = await svc
    .from("user_inbound_aliases")
    .select("user_id, last_digest_sent_at, last_inbound_at, notify_digest")
    .eq("notify_digest", true)
    .not("last_inbound_at", "is", null);

  if (error) {
    console.error("Aliases query failed", error);
    return new Response(JSON.stringify({ error: "query_failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let skipped = 0;

  for (const alias of aliases || []) {
    // Only send if there are inbounds since last digest
    const since = alias.last_digest_sent_at || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (alias.last_inbound_at && alias.last_inbound_at <= since) {
      skipped++;
      continue;
    }

    const cutoff = alias.last_digest_sent_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: leads } = await svc
      .from("clients")
      .select("name, lead_inbound_subject, lead_quality, created_at")
      .eq("user_id", alias.user_id)
      .eq("lead_source", "Email")
      .gt("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!leads || leads.length === 0) {
      skipped++;
      continue;
    }

    const summary = leads
      .map((l) => `• ${l.name}${l.lead_quality ? ` (${l.lead_quality})` : ""} — ${l.lead_inbound_subject || "(no subject)"}`)
      .join("\n");

    // Get user email from auth
    const { data: userData } = await svc.auth.admin.getUserById(alias.user_id);
    const recipient = userData?.user?.email;
    if (!recipient) {
      skipped++;
      continue;
    }

    try {
      const { error: sendErr } = await svc.functions.invoke("send-email", {
        body: {
          templateName: "lead-digest",
          recipientEmail: recipient,
          userId: alias.user_id,
          idempotencyKey: `lead-digest-${alias.user_id}-${new Date().toISOString().slice(0, 10)}`,
          data: {
            count: leads.length,
            summary,
            url: "https://app.closesync.io/dashboard/leads",
          },
        },
      });
      if (sendErr) {
        console.error("send-email failed for", alias.user_id, sendErr);
        skipped++;
        continue;
      }
      await svc
        .from("user_inbound_aliases")
        .update({ last_digest_sent_at: new Date().toISOString() })
        .eq("user_id", alias.user_id);
      sent++;
    } catch (e) {
      console.error("digest send error", e);
      skipped++;
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, skipped }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
