import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireUser } from "../helpers";

export default defineTool({
  name: "list_clients",
  title: "List clients",
  description:
    "List the signed-in user's clients and leads, newest first. Optionally filter by status or search by name, company or email.",
  inputSchema: {
    search: z.string().trim().min(1).optional().describe("Match against name, company or email."),
    status: z.string().trim().min(1).optional().describe("Filter by client status, e.g. lead or client."),
    limit: z.number().int().min(1).max(100).default(20).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, status, limit }, ctx) => {
    if (!requireUser(ctx)) return errorResult("Not authenticated.");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("clients")
      .select("id, name, company, email, phone, status, service_requested, budget, timeline, lead_quality, lead_score, project_stage, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status);
    if (search) query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, clients: data ?? [] });
  },
});
