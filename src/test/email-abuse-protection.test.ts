import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DiagnosticCategory,
  ModuleKind,
  ScriptTarget,
  flattenDiagnosticMessageText,
  transpileModule,
} from "typescript";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function syntaxErrors(fileName: string, contents: string) {
  const result = transpileModule(contents, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      module: ModuleKind.ESNext,
      target: ScriptTarget.ES2022,
    },
  });
  return (result.diagnostics || [])
    .filter((diagnostic) => diagnostic.category === DiagnosticCategory.Error)
    .map((diagnostic) => flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
}

describe("authenticated email abuse protection", () => {
  const sender = source("supabase/functions/send-email/index.ts");
  const helper = source("supabase/functions/_shared/abuse-rate-limit.ts");
  const booking = source("supabase/functions/create-public-booking/index.ts");
  const config = source("supabase/config.toml");

  it("limits authenticated users before parsing or sending email", () => {
    const authentication = sender.indexOf("authedUserId = u.user.id");
    const rateLimit = sender.indexOf("await enforceUserRateLimit(");
    const bodyRead = sender.indexOf("body = await req.json()");

    expect(authentication).toBeGreaterThan(-1);
    expect(rateLimit).toBeGreaterThan(authentication);
    expect(rateLimit).toBeLessThan(bodyRead);
  });

  it("uses atomic burst and daily quotas", () => {
    expect(sender).toContain(
      '{ name: "burst", maxRequests: 30, windowSeconds: 10 * 60 }',
    );
    expect(sender).toContain(
      '{ name: "daily", maxRequests: 250, windowSeconds: 24 * 60 * 60 }',
    );
    expect(helper).toContain("export async function enforceUserRateLimit");
    expect(helper).toContain("await consumeWindow(");
    expect(helper).toContain('dimension: "user"');
  });

  it("keeps internal transactional mail outside the user quota", () => {
    expect(sender).toContain("const isInternal = bearer && bearer === serviceRoleKey");
    expect(sender).toMatch(/if \(!isInternal\)[\s\S]*enforceUserRateLimit/);
  });

  it("keeps the Edge Function and shared helper syntactically valid", () => {
    expect(syntaxErrors("send-email/index.ts", sender)).toEqual([]);
    expect(syntaxErrors("_shared/abuse-rate-limit.ts", helper)).toEqual([]);
    expect(syntaxErrors("create-public-booking/index.ts", booking)).toEqual([]);
  });

  it("requires verified JWT handling at the Edge gateway", () => {
    expect(config).toMatch(/\[functions\.send-email\]\s+verify_jwt = true/);
  });
});
