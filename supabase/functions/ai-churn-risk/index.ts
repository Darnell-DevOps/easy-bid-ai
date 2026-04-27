// AI Churn Risk: scores churn risk for an active retainer 0-100.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  callAITool,
  getServiceClient,
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

    const { retainerId } = await req.json();
    if (!retainerId) return errorResponse("retainerId is required", 400);

    const supabase = getServiceClient();
    const { data: retainer, error } = await supabase
      .from("retainers")
      .select("*")
      .eq("id", retainerId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !retainer) return errorResponse("Retainer not found", 404);

    const { data: invoices } = await supabase
      .from("retainer_invoices")
      .select("status, paid_at, failed_at, due_date")
      .eq("retainer_id", retainerId)
      .order("due_date", { ascending: false })
      .limit(12);

    const failed = (invoices || []).filter((i) => i.status === "failed").length;
    const paid = (invoices || []).filter((i) => i.status === "paid").length;
    const ageDays = retainer.start_date
      ? Math.round((Date.now() - new Date(retainer.start_date).getTime()) / 86400000)
      : 0;

    const ctx = `
Retainer facts:
- Status: ${retainer.status}
- Cancel at period end: ${retainer.cancel_at_period_end}
- Has failed payment: ${retainer.has_failed_payment}
- Failed payment reason: ${retainer.failed_payment_reason || "(none)"}
- Total payments collected: ${paid}
- Failed invoices in last 12: ${failed}
- Age in days: ${ageDays}
- Billing interval: ${retainer.billing_interval}
- Amount per cycle: ${retainer.amount_cents / 100} ${retainer.currency}
- Service: ${retainer.service_type || "(unspecified)"}
- Auto-renew: ${retainer.auto_renew}
`.trim();

    const result = await callAITool({
      model: "google/gemini-3-flash-preview",
      system:
        "You are a customer success analyst for service businesses. You score churn risk for a recurring client retainer from 0 (rock solid) to 100 (about to churn). Heavy weight on payment failures, cancel_at_period_end, and lack of recent payments. New retainers (<14 days) without history get moderate uncertainty (~40).",
      user: ctx,
      toolName: "score_churn",
      toolDescription: "Return churn risk score and a one-sentence reason.",
      parameters: {
        type: "object",
        properties: {
          risk_score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string", description: "One short sentence (max 140 chars)" },
          recommended_action: { type: "string", description: "Concrete retention action (max 100 chars)" },
        },
        required: ["risk_score", "reason", "recommended_action"],
      },
    });

    const severity = result.risk_score >= 70 ? "critical" : result.risk_score >= 40 ? "warning" : "info";

    const insight = await saveInsight({
      userId,
      entityType: "retainer",
      entityId: retainerId,
      kind: "churn_risk",
      score: result.risk_score,
      severity,
      summary: result.reason,
      recommendedAction: result.recommended_action,
      actionUrl: `/dashboard/retainer/${retainerId}`,
      details: {},
    });

    return jsonResponse({ insight });
  } catch (e) {
    return handleError(e);
  }
});
