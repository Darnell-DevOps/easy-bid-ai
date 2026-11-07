import type { JsonValueInput, ToolContext, ToolHandlerResult } from "@lovable.dev/mcp-js";

export function errorResult(message: string): ToolHandlerResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function jsonResult(payload: Record<string, JsonValueInput>): ToolHandlerResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

export function requireUser(ctx: ToolContext): string | null {
  if (!ctx.isAuthenticated()) return null;
  return ctx.getUserId() ?? null;
}
