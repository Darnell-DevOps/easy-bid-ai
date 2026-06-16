// AI Lead Score: scores one inbound lead 0-100 with a one-line reason.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  callAITool,
  getUserId,
  handleError,
  errorResponse,
  jsonResponse,
  saveInsight,
} from "../_shared/ai-coach.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const { leadId } = await req.json();
    if (!leadId) return errorResponse("leadId is required", 400);

    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();
    if (error || !lead) return errorResponse("Lead not found", 404);

    // Map field IDs -> labels for richer prompt context.
    let labelMap: Record<string, string> = {};
    let formName = "(none)";
    if (lead.form_id) {
      const { data: form } = await supabase
        .from("lead_forms")
        .select("name, fields")
        .eq("id", lead.form_id)
        .maybeSingle();
      if (form) {
        formName = form.name || formName;
        ((form.fields as any[]) || []).forEach((f) => {
          if (f?.id && f?.label) labelMap[f.id] = f.label;
        });
      }
    }

    const responses = (lead.responses || {}) as Record<string, unknown>;
    const responseLines = Object.entries(responses)
      .map(([k, v]) => `- ${labelMap[k] || k}: ${String(v).slice(0, 400)}`)
      .join("\n") || "(no extra answers)";

    const ageHours = Math.round((Date.now() - new Date(lead.created_at).getTime()) / 3600000);

    const context = `
Lead facts:
- Name: ${lead.name || "(unknown)"}
- Email: ${lead.email || "(none)"}
- Phone: ${lead.phone || "(none)"}
- Company: ${lead.company || "(none)"}
- Source: ${lead.source || "(none)"}
- Status: ${lead.status}
- Form: ${formName}
- Age (hours): ${ageHours}

Form responses:
${responseLines}
`.trim();

    const result = await callAITool({
      model: "google/gemini-3-flash-preview",
      system:
        "You are a B2B sales qualifier. Score an inbound lead 0 (junk) to 100 (hot, ready to buy). Weigh: contact completeness, response depth and seriousness, explicit budget/timeline/intent signals, fit cues (company, role), and source. Penalize: missing email/phone, one-word answers, spammy text, unrealistic asks. Reward: clear scope, named budget, near-term timeline, decision-maker language. Always return the top 3-5 concrete factors that drove the score, each tagged positive (boosted) or negative (hurt).",
      user: context,
      toolName: "score_lead",
      toolDescription: "Return the lead score, a one-sentence reason, and the top factors used.",
      parameters: {
        type: "object",
        properties: {
          score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string", description: "One short sentence (max 120 chars)" },
          recommended_action: { type: "string", description: "Concrete next action (max 80 chars)" },
          factors: {
            type: "array",
            description: "Top 3-5 concrete signals that drove the score, most impactful first.",
            minItems: 3,
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "Short factor name, max 60 chars (e.g. 'Named budget $10k', 'Missing phone number')" },
                impact: { type: "string", enum: ["positive", "negative"] },
              },
              required: ["label", "impact"],
            },
          },
        },
        required: ["score", "reason", "recommended_action", "factors"],
      },
    });

    const severity = result.score >= 60 ? "info" : result.score >= 30 ? "warning" : "critical";

    const insight = await saveInsight({
      userId,
      entityType: "lead",
      entityId: leadId,
      kind: "lead_score",
      score: result.score,
      severity,
      summary: result.reason,
      recommendedAction: result.recommended_action,
      actionUrl: `/dashboard/leads`,
      details: { factors: result.factors ?? [] },
    });

    return jsonResponse({ insight });
  } catch (e) {
    return handleError(e);
  }
});
