import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireUser } from "../helpers";

export default defineTool({
  name: "revoke_connected_app",
  title: "Revoke connected app",
  description:
    "Revoke one of the signed-in user's own app authorisations by its consent id (from `list_connected_apps`). This immediately ends every session that app holds. Destructive — confirm with the user first.",
  inputSchema: {
    consent_id: z.string().uuid().describe("Consent id returned by list_connected_apps."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ consent_id }, ctx) => {
    if (!requireUser(ctx)) return errorResult("Not authenticated.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("revoke_my_oauth_consent", {
      p_consent_id: consent_id,
    });
    if (error) return errorResult(error.message);
    const result = (data ?? {}) as { revoked?: boolean; sessions_ended?: number; reason?: string };
    if (!result.revoked) {
      return errorResult("No matching connection found for this account.");
    }
    return jsonResult({
      revoked: true,
      consent_id,
      sessions_ended: result.sessions_ended ?? 0,
    });
  },
});
