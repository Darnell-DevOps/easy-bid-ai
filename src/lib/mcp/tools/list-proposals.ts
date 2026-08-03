import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireUser } from "../helpers";

export default defineTool({
  name: "list_proposals",
  title: "List proposals",
  description:
    "List the signed-in user's proposals, newest first. Optionally filter by status (draft, sent, viewed, accepted, rejected).",
  inputSchema: {
    status: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(20).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!requireUser(ctx)) return errorResult("Not authenticated.");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("proposals")
      .select("id, client_name, company_name, service_type, status, amount_cents, currency, client_paid, sent_at, viewed_at, accepted_at, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, proposals: data ?? [] });
  },
});
