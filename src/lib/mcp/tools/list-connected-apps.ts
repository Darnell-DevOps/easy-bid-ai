import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireUser } from "../helpers";

export default defineTool({
  name: "list_connected_apps",
  title: "List connected apps",
  description:
    "List the external apps (AI assistants, integrations) the signed-in user has authorised to access CloseSync AI on their behalf, including when access was granted and how many sessions are active.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!requireUser(ctx)) return errorResult("Not authenticated.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("list_my_oauth_consents");
    if (error) return errorResult(error.message);
    const rows = (data as unknown[]) ?? [];
    return jsonResult({ count: rows.length, connections: rows });
  },
});
