// AI Deal Score: scores one proposal 0-100 with a one-line reason.
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

    const sentAt = proposal.sent_at ? new Date(proposal.sent_at).getTime() : null;
    const viewedAt = proposal.viewed_at ? new Date(proposal.viewed_at).getTime() : null;
    const acceptedAt = proposal.accepted_at ? new Date(proposal.accepted_at).getTime() : null;
    const now = Date.now();
    const hours = (ms: number | null) => (ms ? Math.round((now - ms) / 3600000) : null);

    const context = `
Proposal facts:
- Status: ${proposal.status}
- Client paid: ${proposal.client_paid}
- Amount: ${proposal.amount_cents ? proposal.amount_cents / 100 : "n/a"} ${proposal.currency || "USD"}
- Service: ${proposal.service_type}
- Hours since sent: ${hours(sentAt) ?? "not sent"}
- Hours since viewed: ${hours(viewedAt) ?? "not viewed"}
- Hours since accepted: ${hours(acceptedAt) ?? "not accepted"}
- Client response: ${proposal.client_response_message || "(none)"}
`.trim();

    const result = await callAITool({
      model: "google/gemini-3-flash-preview",
      system:
        "You are a sales analyst. You score the close probability of an outstanding proposal from 0 (lost) to 100 (almost certain to close). You consider engagement (views), recency, status, and price sensitivity. Be conservative — paid deals score 100, rejected score 0, ghosted >7 days score below 25.",
      user: context,
      toolName: "score_deal",
      toolDescription: "Return the deal score and a one-sentence reason.",
      parameters: {
        type: "object",
        properties: {
          score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string", description: "One short sentence (max 120 chars)" },
          recommended_action: { type: "string", description: "Concrete next action (max 80 chars)" },
        },
        required: ["score", "reason", "recommended_action"],
      },
    });

    const severity = result.score >= 60 ? "info" : result.score >= 30 ? "warning" : "critical";

    const insight = await saveInsight({
      userId,
      entityType: "proposal",
      entityId: proposalId,
      kind: "deal_score",
      score: result.score,
      severity,
      summary: result.reason,
      recommendedAction: result.recommended_action,
      actionUrl: `/dashboard/proposal/${proposalId}`,
      details: {},
    });

    return jsonResponse({ insight });
  } catch (e) {
    return handleError(e);
  }
});
