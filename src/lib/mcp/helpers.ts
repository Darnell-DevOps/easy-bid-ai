import type { ToolContext } from "@lovable.dev/mcp-js";

export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function jsonResult(payload: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

export function requireUser(ctx: ToolContext): string | null {
  if (!ctx.isAuthenticated()) return null;
  return ctx.getUserId() ?? null;
}
