// Hourly cron: scans proposals and sends follow-up emails for scenarios
// derived from src/lib/follow-up.ts. Respects per-user automation prefs
// and is idempotent via the proposal_follow_ups(unique proposal_id, scenario).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  bodyToHtml,
  buildFollowUpTemplate,
  getFollowUpScenario,
  scenarioBadge,
  scenarioToPrefKey,
} from "../_shared/follow-up.ts";
import { sendWhatsAppFromCron } from "../_shared/whatsapp.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

import { resolvePublicUrl } from "../_shared/customDomain.ts";

async function ownerEmail(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

async function ownerName(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_profiles")
    .select("full_name, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.display_name as string) || (data?.full_name as string) || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  try {
    // Pull all candidate proposals (sent/viewed/accepted, unpaid).
    const { data: proposals, error } = await supabase
      .from("proposals")
      .select(
        "id, user_id, client_id, client_name, service_type, status, client_paid, sent_at, viewed_at, accepted_at, paid_at",
      )
      .in("status", ["sent", "viewed", "accepted"])
      .eq("client_paid", false);
    if (error) throw error;

    let evaluated = 0;
    let sent = 0;
    let skipped = 0;

    // Cache prefs per user.
    const prefsCache = new Map<string, Record<string, boolean>>();
    async function getPrefs(userId: string) {
      if (prefsCache.has(userId)) return prefsCache.get(userId)!;
      const { data } = await supabase
        .from("automation_preferences")
        .select("preferences")
        .eq("user_id", userId)
        .maybeSingle();
      const prefs = (data?.preferences as Record<string, boolean>) || {};
      prefsCache.set(userId, prefs);
      return prefs;
    }

    for (const p of proposals || []) {
      evaluated++;
      const scenario = getFollowUpScenario(p as any);
      if (scenario === "none") { skipped++; continue; }

      // Already sent?
      const { data: existing } = await supabase
        .from("proposal_follow_ups")
        .select("id")
        .eq("proposal_id", p.id)
        .eq("scenario", scenario)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      // Pref check (defaults: proposal_follow_up=on, payment_follow_up_unpaid=on)
      const prefs = await getPrefs(p.user_id);
      const prefKey = scenarioToPrefKey(scenario);
      const enabled = prefs[prefKey] !== false; // default on
      if (!enabled) { skipped++; continue; }

      // Resolve client email + phone.
      let clientEmail: string | null = null;
      let clientPhone: string | null = null;
      if (p.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("email, phone")
          .eq("id", p.client_id)
          .maybeSingle();
        clientEmail = (client?.email as string) || null;
        clientPhone = ((client as any)?.phone as string) || null;
      }
      if (!clientEmail) { skipped++; continue; }

      const senderName = await ownerName(p.user_id);
      const tpl = buildFollowUpTemplate(scenario, {
        clientName: p.client_name || "",
        serviceType: p.service_type || undefined,
        proposalUrl: await resolvePublicUrl(supabase, p.user_id, `/proposal/${p.id}`, "portal"),
        senderName: senderName || undefined,
      });

      // Log first (idempotent guard against duplicate sends if cron races).
      const { error: logErr } = await supabase.from("proposal_follow_ups").insert({
        user_id: p.user_id,
        proposal_id: p.id,
        scenario,
        recipient_email: clientEmail,
      });
      if (logErr) {
        // Likely unique violation from concurrent run — skip silently.
        skipped++;
        continue;
      }

      const ownerEmailAddr = await ownerEmail(p.user_id);
      try {
        const { error: sendErr } = await supabase.functions.invoke("send-email", {
          body: {
            templateName: `proposal-followup-${scenario}`,
            recipientEmail: clientEmail,
            userId: p.user_id,
            idempotencyKey: `proposal-followup-${p.id}-${scenario}`,
            replyTo: ownerEmailAddr || undefined,
            prerendered: {
              subject: tpl.subject,
              html: bodyToHtml(tpl.body),
              text: tpl.body,
            },
            meta: { proposal_id: p.id, scenario },
          },
        });
        if (sendErr) {
          console.error("send-email error:", sendErr.message);
        } else {
          sent++;
          // Owner notification
          await supabase.from("user_notifications").insert({
            user_id: p.user_id,
            category: "proposals",
            key: `proposal_follow_up_sent:${p.id}:${scenario}`,
            title: `Follow-up sent — ${scenarioBadge(scenario)}`,
            body: `Sent automated follow-up to ${p.client_name} about their proposal.`,
            link_url: `/proposals/${p.id}`,
            metadata: { proposal_id: p.id, scenario },
          });
        }
      } catch (e: any) {
        console.error("send invoke threw:", e?.message || e);
      }

      // WhatsApp dispatch (no-op when disabled / no phone / no settings).
      if (clientPhone) {
        const waBody = tpl.body.length > 1000 ? `${tpl.body.slice(0, 980)}…` : tpl.body;
        const waRes = await sendWhatsAppFromCron({
          supabase,
          userId: p.user_id,
          to: clientPhone,
          body: waBody,
          autoKey: "auto_proposal_reminders",
          context: `proposal_followup_${scenario}`,
          relatedId: p.id,
          idempotencyKey: `wa-proposal-followup-${p.id}-${scenario}`,
        });
        if (waRes.sent) {
          console.log(`whatsapp sent for proposal ${p.id} (${scenario})`);
        } else if (waRes.error) {
          console.error(`whatsapp send failed for proposal ${p.id}:`, waRes.error);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, evaluated, sent, skipped }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("proposal-follow-up-cron error:", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
