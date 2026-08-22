import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/settings/SecuritySettings.tsx"), "utf8");

describe("Security settings accessibility", () => {
  it("associates the manual authenticator secret with its label", () => {
    expect(source).toContain('htmlFor="totp-manual-secret"');
    expect(source).toContain('id="totp-manual-secret"');
    expect(source).toContain('autoComplete="off"');
    expect(source).toContain("spellCheck={false}");
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);
  });

  it("preserves accessible names for adjacent 2FA controls", () => {
    expect(source).toContain('aria-label="Copy manual two-factor authentication code"');
    expect(source).toContain('<Copy aria-hidden="true"');
    expect(source).toContain('htmlFor="totp-code"');
    expect(source).toContain('id="totp-code"');
    expect(source).toContain('autoComplete="one-time-code"');
    expect(source).toContain('aria-label="Authenticator app two-factor authentication"');
    expect(source).toContain('<Switch checked={checked} onCheckedChange={onChange} aria-label={label} />');
  });

  it("preserves the complete MFA enrollment and removal workflow", () => {
    expect(source).toContain("supabase.auth.mfa.enroll({");
    expect(source).toContain('factorType: "totp"');
    expect(source).toContain("supabase.auth.mfa.challenge({ factorId: enrollFactorId })");
    expect(source).toContain("supabase.auth.mfa.verify({");
    expect(source).toContain("supabase.auth.mfa.unenroll({ factorId: enrollFactorId })");
    expect(source).toContain("supabase.auth.mfa.unenroll({ factorId: twoFAFactorId })");
  });

  it("preserves secret copying and recovery-code persistence", () => {
    expect(source).toContain("navigator.clipboard.writeText(enrollSecret)");
    expect(source).toContain("const codes = genRecoveryCodes()");
    expect(source).toContain('localStorage.setItem("security_2fa_codes", JSON.stringify(codes))');
    expect(source).toContain('localStorage.removeItem("security_2fa_codes")');
  });
});
