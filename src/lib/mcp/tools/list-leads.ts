import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireUser } from "../helpers";

export default defineTool({
  name: "list_leads",
  title: "List inbound leads",
  description:
    "List inbound leads captured by the signed-in user's lead forms and inbox, newest first, with AI qualification scores when available.",
  inputSchema: {
    status: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(20).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!requireUser(ctx)) return errorResult("Not authenticated.");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("leads")
      .select("id, name, email, company, phone, source, status, service_requested, budget, timeline, lead_quality, lead_score, lead_score_reason, fit_score, ai_recommendation, client_id, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, leads: data ?? [] });
  },
});
