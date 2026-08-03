import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireUser } from "../helpers";

export default defineTool({
  name: "create_client",
  title: "Create client",
  description: "Create a new client or lead record for the signed-in user.",
  inputSchema: {
    name: z.string().trim().min(1).describe("Contact name."),
    email: z.string().trim().email().optional(),
    company: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).optional(),
    service_requested: z.string().trim().min(1).optional(),
    project_description: z.string().trim().min(1).optional(),
    budget: z.string().trim().min(1).optional(),
    timeline: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional().describe("Defaults to the table default when omitted."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const userId = requireUser(ctx);
    if (!userId) return errorResult("Not authenticated.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...input, user_id: userId })
      .select("id, name, company, email, status, created_at")
      .single();
    if (error) return errorResult(error.message);
    return jsonResult({ client: data });
  },
});
