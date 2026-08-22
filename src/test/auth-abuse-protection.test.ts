import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("authentication abuse protection", () => {
  it.each([
    ["src/pages/Login.tsx", 'action="login"'],
    ["src/pages/Signup.tsx", 'action="signup"'],
    ["src/pages/ForgotPassword.tsx", 'action="password-reset"'],
  ])("passes a Turnstile token from %s to Supabase Auth", (path, action) => {
    const contents = source(path);

    expect(contents).toContain("AuthCaptcha");
    expect(contents).toContain(action);
    expect(contents).toContain("captchaToken: captchaToken || undefined");
    expect(contents).toContain("captchaConfigured && !captchaToken");
    expect(contents).toContain("captchaRef.current?.reset()");
  });

  it("loads Turnstile only when its public site key is configured", () => {
    const component = source("src/components/auth/AuthCaptcha.tsx");
    const config = source("src/lib/auth-captcha.ts");

    expect(config).toContain("VITE_TURNSTILE_SITE_KEY");
    expect(component).toContain("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
    expect(component).toContain("if (!authCaptchaSiteKey) return null");
    expect(component).toContain('"error-callback"');
    expect(component).toContain('"expired-callback"');
  });

  it("documents only the browser-safe Turnstile site key", () => {
    const example = source(".env.example");

    expect(example).toContain("VITE_TURNSTILE_SITE_KEY=");
    expect(example).not.toContain("TURNSTILE_SECRET_KEY=");
    expect(example).not.toContain("VITE_TURNSTILE_SECRET");
  });
});
