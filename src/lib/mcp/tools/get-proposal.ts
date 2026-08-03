import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireUser } from "../helpers";

export default defineTool({
  name: "get_proposal",
  title: "Get proposal",
  description: "Fetch one of the signed-in user's proposals in full, including its written content and pricing breakdown.",
  inputSchema: { proposal_id: z.string().uuid().describe("The proposal id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ proposal_id }, ctx) => {
    if (!requireUser(ctx)) return errorResult("Not authenticated.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("proposals")
      .select("id, client_name, company_name, service_type, project_scope, goals, deliverables, budget, timeline, notes, proposal_content, pricing_breakdown, payment_terms, tax_rate, status, amount_cents, currency, client_paid, sent_at, viewed_at, accepted_at, rejected_at, created_at, updated_at")
      .eq("id", proposal_id)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!data) return errorResult("No proposal found with that id for this account.");
    return jsonResult({ proposal: data });
  },
});
