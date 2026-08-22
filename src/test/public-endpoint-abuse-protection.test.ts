import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const protectedPublicFunctions = [
  "client-portal-accept",
  "create-public-booking",
  "create-proposal-checkout",
  "create-retainer-subscription",
  "retainer-portal-session",
  "retainer-recover-portal",
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public endpoint abuse protection", () => {
  it.each(protectedPublicFunctions)("protects %s with the shared atomic limiter", (name) => {
    const contents = source(`supabase/functions/${name}/index.ts`);
    expect(contents).toContain("abuse-rate-limit.ts");
    expect(contents).toContain("enforcePublicRateLimit(req");
    expect(contents).toContain('req.method !== "POST"');
  });

  it("binds retainer checkout to the secret client token instead of a raw UUID", () => {
    const backend = source("supabase/functions/create-retainer-subscription/index.ts");
    const frontend = source("src/pages/RetainerSubscribePage.tsx");

    expect(backend).toContain('.eq("access_token", token)');
    expect(backend).not.toContain('.eq("id", retainerId)');
    expect(frontend).toContain("token: retainer.access_token");
    expect(frontend).not.toContain("retainerId: retainer.id");
  });

  it("does not let public checkout callers select the Paddle environment", () => {
    for (const name of ["create-proposal-checkout", "create-retainer-subscription"]) {
      const contents = source(`supabase/functions/${name}/index.ts`);
      expect(contents).toContain("getServerPaddleEnv()");
      expect(contents).not.toMatch(/const \{[^}]*environment[^}]*\} = await req\.json\(\)/s);
    }
  });

  it("locks the unused Paddle price lookup behind verified authentication", () => {
    const config = source("supabase/config.toml");
    const backend = source("supabase/functions/get-paddle-price/index.ts");

    expect(config).toMatch(/\[functions\.get-paddle-price\]\s+verify_jwt = true/);
    expect(backend).toContain("auth.getUser(");
    expect(backend).toContain("enforcePublicRateLimit(req");
    expect(backend).toContain("getServerPaddleEnv()");
  });

  it("hashes address and resource subjects before atomic database accounting", () => {
    const helper = source("supabase/functions/_shared/abuse-rate-limit.ts");

    expect(helper).toContain("enforcePublicRateLimit");
    expect(helper).toContain("address:${getRequestAddress(req)}");
    expect(helper).toContain("resource:${options.resource}");
    expect(helper).toContain("consumeWindow(");
    expect(helper).toContain('eventType: "rate_limit_exceeded"');
  });
});
