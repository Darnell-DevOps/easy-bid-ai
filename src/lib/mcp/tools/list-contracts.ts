import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireUser } from "../helpers";

export default defineTool({
  name: "list_contracts",
  title: "List contracts",
  description:
    "List the signed-in user's contracts, newest first. Optionally filter by status (draft, sent, viewed, signed, executed).",
  inputSchema: {
    status: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(100).default(20).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!requireUser(ctx)) return errorResult("Not authenticated.");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("contracts")
      .select("id, title, contract_type, client_name, client_email, company_name, status, amount_cents, currency, sent_at, viewed_at, signed_at, countersigned_at, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, contracts: data ?? [] });
  },
});
