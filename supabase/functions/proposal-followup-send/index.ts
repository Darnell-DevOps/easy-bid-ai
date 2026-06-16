// Manually trigger a proposal follow-up send. Authenticated; owner-only.
// Reuses the same scenario engine + send-email pipeline as the hourly cron.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  bodyToHtml,
  buildFollowUpTemplate,
  getFollowUpScenario,
  scenarioBadge,
  type FollowUpScenario,
} from "../_shared/follow-up.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://app.closesync.io";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimErr } = await userClient.auth.getClaims(token);
  if (claimErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  let body: { proposalId?: string; scenario?: FollowUpScenario; recipientEmail?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body.proposalId) return json({ error: "missing_proposal_id" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: proposal, error: pErr } = await admin
    .from("proposals")
    .select(
      "id, user_id, client_id, client_name, service_type, status, client_paid, sent_at, viewed_at, accepted_at, paid_at",
    )
    .eq("id", body.proposalId)
    .maybeSingle();
  if (pErr || !proposal) return json({ error: "proposal_not_found" }, 404);
  if (proposal.user_id !== userId) return json({ error: "forbidden" }, 403);

  // Pick scenario: explicit override or derived from timestamps. If override
  // is "none" or derived is "none", fall back to a generic nudge so the user
  // can always send a manual follow-up.
  const derived = getFollowUpScenario(proposal as any);
  let scenario: Exclude<FollowUpScenario, "none"> =
    (body.scenario && body.scenario !== "none" ? body.scenario : derived) as Exclude<FollowUpScenario, "none">;
  if (!scenario || (scenario as string) === "none") scenario = "not_viewed_24h";

  // Resolve recipient
  let recipient = body.recipientEmail || null;
  if (!recipient && proposal.client_id) {
    const { data: client } = await admin
      .from("clients")
      .select("email")
      .eq("id", proposal.client_id)
      .maybeSingle();
    recipient = (client?.email as string) || null;
  }
  if (!recipient) return json({ error: "missing_recipient_email" }, 400);

  // Owner info
  const [{ data: profile }, { data: ownerUser }] = await Promise.all([
    admin.from("user_profiles").select("full_name, display_name").eq("user_id", userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);
  const senderName =
    (profile?.display_name as string) || (profile?.full_name as string) || null;
  const ownerEmailAddr = ownerUser?.user?.email || undefined;

  const tpl = buildFollowUpTemplate(scenario, {
    clientName: proposal.client_name || "",
    serviceType: proposal.service_type || undefined,
    proposalUrl: `${APP_URL}/proposal/${proposal.id}`,
    senderName: senderName || undefined,
  });

  // --- Idempotency guard ---
  // If we already logged a send for this (proposal, scenario) within the last
  // 60 seconds, treat this as a duplicate click and no-op. Prevents double-
  // sends from rapid clicks even before the send-email idempotency key kicks in.
  const DUP_WINDOW_MS = 60_000;
  const { data: recent } = await admin
    .from("proposal_follow_ups")
    .select("id, sent_at, recipient_email")
    .eq("proposal_id", proposal.id)
    .eq("scenario", scenario)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent && Date.now() - new Date(recent.sent_at).getTime() < DUP_WINDOW_MS) {
    return json({
      ok: true,
      deduped: true,
      scenario,
      recipient: recent.recipient_email || recipient,
    });
  }

  // Stable, time-bucketed idempotency key (5-minute bucket). Identical rapid
  // requests collapse to the same key, so send-email's unique constraint on
  // email_send_log.idempotency_key short-circuits the second send.
  const bucket = Math.floor(Date.now() / (5 * 60_000));
  const idemKey = `proposal-followup-manual-${proposal.id}-${scenario}-${bucket}`;

  const { data: sendResp, error: sendErr } = await admin.functions.invoke("send-email", {
    body: {
      templateName: `proposal-followup-${scenario}`,
      recipientEmail: recipient,
      userId,
      idempotencyKey: idemKey,
      replyTo: ownerEmailAddr,
      prerendered: {
        subject: tpl.subject,
        html: bodyToHtml(tpl.body),
        text: tpl.body,
      },
      meta: { proposal_id: proposal.id, scenario, manual: true },
    },
  });
  if (sendErr) return json({ error: "send_failed", message: sendErr.message }, 500);
  const deduped = !!(sendResp as any)?.deduped;

  // Upsert log row only if this was a real send. Keep the existing sent_at if
  // send-email deduped, so the history doesn't lie about send time.
  if (!deduped) {
    await admin
      .from("proposal_follow_ups")
      .upsert(
        {
          user_id: userId,
          proposal_id: proposal.id,
          scenario,
          recipient_email: recipient,
          sent_at: new Date().toISOString(),
        },
        { onConflict: "proposal_id,scenario" },
      );

    await admin.from("user_notifications").insert({
      user_id: userId,
      category: "proposals",
      key: `proposal_follow_up_sent_manual:${proposal.id}:${scenario}:${bucket}`,
      title: `Follow-up sent — ${scenarioBadge(scenario)}`,
      body: `You sent a manual follow-up to ${proposal.client_name}.`,
      link_url: `/proposals/${proposal.id}`,
      metadata: { proposal_id: proposal.id, scenario, manual: true },
    });
  }

  return json({ ok: true, deduped, scenario, recipient });
});

