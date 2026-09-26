import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const settings = readFileSync(resolve(process.cwd(), "src/components/settings/SecuritySettings.tsx"), "utf8");
const guard = readFileSync(resolve(process.cwd(), "src/components/AuthGuard.tsx"), "utf8");

describe("authenticator and security settings", () => {
  it("challenges an enrolled factor before revealing the workspace", () => {
    expect(guard).toContain("getAuthenticatorAssuranceLevel(sessionData.session.access_token)");
    expect(guard).toContain('level.nextLevel === "aal2" && level.currentLevel !== "aal2"');
    expect(guard).toContain("challengeAndVerify({ factorId, code })");
    expect(guard.indexOf('setState("ready")')).toBeGreaterThan(guard.indexOf("getAuthenticatorAssuranceLevel("));
  });

  it("provides labelled enrollment controls and does not claim unsupported recovery codes", () => {
    expect(settings).toContain('htmlFor="mfa-secret"');
    expect(settings).toContain('id="mfa-secret"');
    expect(settings).toContain('htmlFor="mfa-enrollment-code"');
    expect(settings).toContain('id="mfa-enrollment-code"');
    expect(settings).toContain('autoComplete="one-time-code"');
    expect(settings).toContain("Recovery codes are not available yet.");
    expect(settings).not.toContain("security_2fa_codes");
    expect(settings).not.toContain("genRecoveryCodes");
  });

  it("does not show invented login history, security scores or deletion confirmations", () => {
    expect(settings).not.toContain("loginHistory");
    expect(settings).not.toContain("Security Score");
    expect(settings).not.toContain("Deletion request received");
    expect(settings).toContain("mailto:support@closesync.io?subject=CloseSync%20account%20deletion%20request");
  });
});
