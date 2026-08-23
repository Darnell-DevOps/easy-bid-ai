import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const userTriggeredAiFunctions = [
  "ai-churn-risk",
  "ai-client-brief",
  "ai-coach-feed",
  "ai-deal-score",
  "ai-generate-form",
  "ai-lead-score",
  "ai-preview",
  "ai-proposal-audit",
  "generate-contract",
  "generate-policy",
  "generate-proposal",
  "lead-reply-regenerate",
  "lead-requalify",
  "lead-response",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("AI abuse protection", () => {
  it.each(userTriggeredAiFunctions)("protects %s with the shared limiter", (functionName) => {
    const contents = source(`supabase/functions/${functionName}/index.ts`);
    expect(contents).toContain("abuse-rate-limit.ts");
    expect(contents).toContain("enforceAiRateLimit(");
  });

  it("charges the two-call coach feed twice", () => {
    const contents = source("supabase/functions/ai-coach-feed/index.ts");
    expect(contents).toMatch(/source:\s*"ai-coach-feed",\s*cost:\s*2/s);
  });

  it("keeps rate-limit storage and consumption server-only", () => {
    const migration = source(
      "supabase/migrations/20260822155730_296b50f3-e76c-4264-a1f8-9f3d272793f3.sql",
    );
    expect(migration).toContain("ALTER TABLE public.abuse_rate_limits ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON public.abuse_rate_limits FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
    expect(migration).toContain("ON CONFLICT (bucket, subject_hash) DO UPDATE");
  });
});
