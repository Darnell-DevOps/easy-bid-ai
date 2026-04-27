// AI Proposal Audit: deep audit of a proposal (pricing, scope, missing pieces, rewrite tips).
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

    const { proposalId } = await req.json();
    if (!proposalId) return errorResponse("proposalId is required", 400);

    const supabase = getServiceClient();
    const { data: proposal, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", proposalId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !proposal) return errorResponse("Proposal not found", 404);

    const ctx = `
Service: ${proposal.service_type}
Client: ${proposal.client_name} at ${proposal.company_name}
Budget hint: ${proposal.budget || "n/a"}
Timeline: ${proposal.timeline || "n/a"}
Stated amount: ${proposal.amount_cents ? proposal.amount_cents / 100 : "n/a"} ${proposal.currency || "USD"}

PROPOSAL CONTENT:
${(proposal.proposal_content || "").slice(0, 8000)}

PRICING BREAKDOWN:
${(proposal.pricing_breakdown || "").slice(0, 2000)}
`.trim();

    const result = await callAITool({
      model: "google/gemini-2.5-pro",
      system:
        "You are an elite proposal coach for agencies and consultants. You audit a draft proposal and give brutally honest, concrete feedback that improves win rate and pricing. Be specific. Avoid generic advice.",
      user: ctx,
      toolName: "audit_proposal",
      toolDescription: "Return a structured audit of the proposal.",
      parameters: {
        type: "object",
        properties: {
          overall_score: { type: "integer", minimum: 0, maximum: 100 },
          predicted_close_probability: { type: "integer", minimum: 0, maximum: 100 },
          pricing_verdict: { type: "string", enum: ["underpriced", "fair", "overpriced", "unknown"] },
          suggested_price_low: { type: "number" },
          suggested_price_high: { type: "number" },
          pricing_rationale: { type: "string" },
          scope_clarity_score: { type: "integer", minimum: 0, maximum: 100 },
          missing_sections: {
            type: "array",
            items: { type: "string" },
            description: "Sections that are missing or weak (e.g. 'timeline', 'deliverables', 'terms')",
          },
          strengths: {
            type: "array",
            items: { type: "string" },
            description: "2-3 things this proposal does well",
          },
          rewrite_suggestions: {
            type: "array",
            description: "3 concrete rewrite suggestions with before/after",
            items: {
              type: "object",
              properties: {
                target: { type: "string", description: "What to fix" },
                suggestion: { type: "string", description: "How to fix it" },
              },
              required: ["target", "suggestion"],
            },
          },
        },
        required: [
          "overall_score",
          "predicted_close_probability",
          "pricing_verdict",
          "pricing_rationale",
          "scope_clarity_score",
          "missing_sections",
          "strengths",
          "rewrite_suggestions",
        ],
      },
    });

    const severity = result.overall_score >= 70 ? "info" : result.overall_score >= 40 ? "warning" : "critical";

    const insight = await saveInsight({
      userId,
      entityType: "audit",
      entityId: proposalId,
      kind: "audit",
      score: result.overall_score,
      severity,
      summary: `Overall ${result.overall_score}/100 — ${result.pricing_verdict}, ${result.predicted_close_probability}% close odds`,
      details: result,
      recommendedAction: result.rewrite_suggestions?.[0]?.suggestion || null,
      actionUrl: `/dashboard/proposal/${proposalId}`,
    });

    return jsonResponse({ insight });
  } catch (e) {
    return handleError(e);
  }
});
