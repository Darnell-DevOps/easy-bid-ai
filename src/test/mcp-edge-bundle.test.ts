import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const bundle = readFileSync(
  resolve(process.cwd(), "supabase/functions/mcp/index.ts"),
  "utf8",
);

describe("MCP Edge Function bundle", () => {
  it("never imports source through a machine-specific path", () => {
    expect(bundle).not.toMatch(/npm:[A-Za-z]:[\\/]/);
    expect(bundle).not.toMatch(/[A-Za-z]:[\\/]Users[\\/]/i);
    expect(bundle).not.toContain("file:///");
  });

  it("remains self-contained and exposes every registered tool", () => {
    expect(bundle).toContain("// src/lib/mcp/index.ts");
    expect(bundle).toContain("createSupabaseHandler");

    for (const tool of [
      "pipeline_summary",
      "list_clients",
      "create_client",
      "list_proposals",
      "get_proposal",
      "list_contracts",
      "list_leads",
      "list_connected_apps",
      "revoke_connected_app",
    ]) {
      expect(bundle).toContain(`name: "${tool}"`);
    }
  });
});
