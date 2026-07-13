// Shared helper used by lead-qualify (internal pg_net trigger) and
// lead-requalify (authenticated user-triggered re-run for both leads and clients).
import { createClient } from "npm:@supabase/supabase-js@2";
import { logLeadActivity } from "./lead-activity.ts";
import {
  appendSignature,
  type LeadPrefs,
  normalizeFitFactors,
  normalizeFitScore,
  normalizeMissingInfo,
  runQualification,
  summarizeThread,
} from "./qualify-core.ts";

export const qualifyCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

type FormField = { id?: string; key?: string; label?: string; type?: string };

function labelMap(fields: unknown): Record<string, string> {
  if (!Array.isArray(fields)) return {};
  const out: Record<string, string> = {};
  for (const f of fields as FormField[]) {
    const k = f?.id || f?.key;
    if (k && typeof k === "string") out[k] = f.label || k;
  }
  return out;
}

function formatResponses(responses: unknown, labels: Record<string, string>): string {
  if (!responses || typeof responses !== "object") return "";
  const entries = Object.entries(responses as Record<string, unknown>);
  if (entries.length === 0) return "";
  return entries
    .map(([k, v]) => {
      const label = labels[k] || k;
      let value: string;
      if (Array.isArray(v)) value = v.join(", ");
      else if (v === null || v === undefined) value = "";
      else if (typeof v === "object") value = JSON.stringify(v);
      else value = String(v);
      return `- ${label}: ${value || "(empty)"}`;
    })
    .join("\n");
}

function routeStatus(quality: string): string {
  if (quality === "High") return "qualified";
  // Low-quality leads stay visible as "new" — the Low badge flags them.
  // Archiving is a manual user action only (see LeadInbox archive button).
  return "new";
}

export async function qualifyLeadById(
  leadId: string,
  opts?: { force?: boolean },
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: lead, error: leadErr } = await svc
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr || !lead) {
    return { ok: false, error: leadErr?.message || "Lead not found" };
  }

  if (lead.qualified_at && !opts?.force) {
    return { ok: true, skipped: true };
  }

  let labels: Record<string, string> = {};
  if (lead.form_id) {
    const { data: form } = await svc
      .from("lead_forms")
      .select("fields")
      .eq("id", lead.form_id)
      .maybeSingle();
    if (form) labels = labelMap(form.fields);
  }

  const { data: prefsRow } = await svc
    .from("ai_preferences")
    .select("business_name, business_services, business_ideal_client, business_target_audience, custom_instructions")
    .eq("user_id", lead.user_id)
    .maybeSingle();
  const prefs: BizPrefs | null = (prefsRow as BizPrefs) || null;

  const respText = formatResponses(lead.responses, labels);
  const message = [
    lead.notes ? `Notes: ${lead.notes}` : null,
    respText ? `Form responses:\n${respText}` : null,
  ]
    .filter(Boolean)
    .join("\n\n") || "(no message body — only contact info provided)";

  try {
    const ai = await runQualification({
      name: lead.name || "Unknown",
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      source: lead.source,
      message,
      prefs,
    });

    const newStatus = routeStatus(ai.lead_quality);
    const finalStatus = lead.status === "converted" ? lead.status : newStatus;

    const missingInfo = normalizeMissingInfo(ai.missing_info);
    const fitScore = normalizeFitScore(ai.fit_score);
    const fitFactors = normalizeFitFactors(ai.factors);

    const { error: updErr } = await svc
      .from("leads")
      .update({
        service_requested: ai.service_requested || null,
        budget: ai.budget || null,
        timeline: ai.timeline || null,
        goals: ai.goals || null,
        lead_quality: ai.lead_quality || null,
        ai_recommendation: ai.ai_recommendation || null,
        draft_reply: ai.reply || null,
        draft_subject: ai.reply_subject || null,
        lead_score: ai.lead_score || null,
        lead_score_reason: ai.lead_score_reason ? String(ai.lead_score_reason).slice(0, 200) : null,
        missing_info: missingInfo,
        fit_score: fitScore,
        fit_factors: fitFactors,

        qualified_at: new Date().toISOString(),
        qualification_error: null,
        status: finalStatus,
      })
      .eq("id", leadId);

    if (updErr) {
      console.error("Update lead failed", updErr);
      return { ok: false, error: updErr.message };
    }

    await logLeadActivity(svc, {
      user_id: lead.user_id,
      type: "lead_qualified",
      title: `AI qualified ${lead.name || "lead"} — ${ai.lead_quality || "Unclear"}`,
      summary: ai.quality_reason || null,
      lead_id: leadId,
      metadata: {
        lead_quality: ai.lead_quality || null,
        lead_score: ai.lead_score || null,
        source: lead.source || "form",
      },
    });
    if (ai.reply) {
      await logLeadActivity(svc, {
        user_id: lead.user_id,
        type: "reply_drafted",
        title: `AI reply drafted for ${lead.name || "lead"}`,
        summary: ai.reply_subject || null,
        lead_id: leadId,
      });
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("qualifyLeadById failed", msg);
    await svc.from("leads").update({ qualification_error: msg }).eq("id", leadId);
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Client-based requalification (used by the lead-requalify endpoint when the
// LeadInsightPanel on a client detail page triggers a fresh AI pass).
// ---------------------------------------------------------------------------

export async function qualifyClientById(
  clientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: client, error: clientErr } = await svc
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr || !client) {
    return { ok: false, error: clientErr?.message || "Client not found" };
  }

  const { data: prefsRow } = await svc
    .from("ai_preferences")
    .select("business_name, business_services, business_ideal_client, business_target_audience, custom_instructions")
    .eq("user_id", client.user_id)
    .maybeSingle();
  const prefs: BizPrefs | null = (prefsRow as BizPrefs) || null;

  // Build the message: prefer original enquiry + later thread replies; fall back
  // to the structured project fields if the client was manually entered.
  const original = (client.original_lead_message || "").trim();
  const threadSummary = summarizeThread((client as any).lead_thread);

  let message = "";
  if (original || threadSummary) {
    message = [
      original ? `Original enquiry:\n${original}` : null,
      threadSummary ? `Later replies from the lead:\n${threadSummary}` : null,
    ].filter(Boolean).join("\n\n");
  } else {
    const parts = [
      client.service_requested ? `Service requested: ${client.service_requested}` : null,
      client.project_description ? `Project description: ${client.project_description}` : null,
      client.goals ? `Goals: ${client.goals}` : null,
      client.budget ? `Budget: ${client.budget}` : null,
      client.timeline ? `Timeline: ${client.timeline}` : null,
    ].filter(Boolean);
    message = parts.length
      ? parts.join("\n")
      : "(no message body — only contact info provided)";
  }

  try {
    const ai = await runQualification({
      name: client.name || "Unknown",
      email: client.email,
      phone: client.phone,
      company: client.company,
      source: client.lead_source || "form",
      message,
      prefs,
    });

    const missingInfo = normalizeMissingInfo(ai.missing_info);
    const fitScore = normalizeFitScore(ai.fit_score);
    const fitFactors = normalizeFitFactors(ai.factors);

    const update: Record<string, unknown> = {
      lead_quality: ai.lead_quality || null,
      ai_recommendation: ai.ai_recommendation || null,
      lead_score: ai.lead_score || null,
      lead_score_reason: ai.lead_score_reason ? String(ai.lead_score_reason).slice(0, 200) : null,
      missing_info: missingInfo,
      fit_score: fitScore,
      fit_factors: fitFactors,
    };

    // Never clobber a reply that's already been sent to the client.
    if (!client.lead_reply_sent_at && ai.reply) {
      update.lead_draft_reply = ai.reply;
      update.lead_draft_subject = ai.reply_subject || null;
    }

    const { error: updErr } = await svc
      .from("clients")
      .update(update)
      .eq("id", clientId);

    if (updErr) {
      console.error("Update client failed", updErr);
      return { ok: false, error: updErr.message };
    }

    await logLeadActivity(svc, {
      user_id: client.user_id,
      type: "lead_qualified",
      title: `AI re-qualified ${client.name || "client"} — ${ai.lead_quality || "Unclear"}`,
      summary: ai.quality_reason || null,
      client_id: clientId,
      metadata: {
        lead_quality: ai.lead_quality || null,
        lead_score: ai.lead_score || null,
        source: client.lead_source || "form",
        requalified: true,
      },
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("qualifyClientById failed", msg);
    return { ok: false, error: msg };
  }
}
