// Shared helpers for AI Sales Coach edge functions.
import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const token = auth.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

export interface ToolCallResult {
  args: any;
}

/**
 * Call the Lovable AI Gateway with a forced tool-call to get structured JSON output.
 * Returns the parsed arguments object.
 */
export async function callAITool(opts: {
  model?: string;
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  parameters: Record<string, any>;
}): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model || "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: opts.toolName,
            description: opts.toolDescription,
            parameters: opts.parameters,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: opts.toolName } },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 429) {
      throw new GatewayError("Rate limited. Please try again in a moment.", 429);
    }
    if (response.status === 402) {
      throw new GatewayError("AI credits exhausted. Please add funds.", 402);
    }
    console.error("AI gateway error:", response.status, text);
    throw new GatewayError("AI generation failed", 500);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    console.error("No tool_call in response", JSON.stringify(data).slice(0, 500));
    throw new GatewayError("AI did not return structured output", 500);
  }
  try {
    return JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error("Failed to parse tool call args", toolCall.function.arguments);
    throw new GatewayError("Invalid AI response", 500);
  }
}

export class GatewayError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function handleError(e: unknown): Response {
  if (e instanceof GatewayError) {
    return errorResponse(e.message, e.status);
  }
  console.error(e);
  return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
}

/**
 * Upsert an insight row, replacing the prior one for the same user/entity/kind.
 */
export async function saveInsight(opts: {
  userId: string;
  entityType: "proposal" | "retainer" | "dashboard" | "audit" | "lead";
  entityId: string | null;
  kind: string;
  score?: number | null;
  severity?: "info" | "warning" | "critical" | null;
  summary: string;
  details?: Record<string, any>;
  recommendedAction?: string | null;
  actionUrl?: string | null;
}) {
  const supabase = getServiceClient();
  // Delete prior non-dismissed for this user/entity/kind to keep table tidy.
  let del = supabase
    .from("ai_insights")
    .delete()
    .eq("user_id", opts.userId)
    .eq("entity_type", opts.entityType)
    .eq("kind", opts.kind);
  if (opts.entityId) {
    del = del.eq("entity_id", opts.entityId);
  } else {
    del = del.is("entity_id", null);
  }
  await del;

  const { data, error } = await supabase
    .from("ai_insights")
    .insert({
      user_id: opts.userId,
      entity_type: opts.entityType,
      entity_id: opts.entityId,
      kind: opts.kind,
      score: opts.score ?? null,
      severity: opts.severity ?? null,
      summary: opts.summary,
      details: opts.details ?? {},
      recommended_action: opts.recommendedAction ?? null,
      action_url: opts.actionUrl ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
