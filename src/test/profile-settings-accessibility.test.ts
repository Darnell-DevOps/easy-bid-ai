import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/settings/ProfileSettings.tsx"), "utf8");

describe("Profile settings accessibility", () => {
  it("associates reusable profile fields with labels, errors, and guidance", () => {
    for (const id of [
      "profile-contact-email",
      "profile-first-name",
      "profile-last-name",
      "profile-business-name",
      "profile-phone",
      "profile-website",
    ]) {
      expect(source).toContain(`id="${id}"`);
    }

    expect(source).toContain("<Label htmlFor={id}");
    expect(source).toContain("<Input\n        id={id}");
    expect(source).toContain("aria-invalid={Boolean(error)}");
    expect(source).toContain("aria-describedby={messageId}");
    expect(source).toContain("aria-errormessage={error ? messageId : undefined}");
    expect(source).toContain('<p id={messageId} role="alert"');
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);
  });

  it("labels locale Selects and describes the appearance switch", () => {
    for (const id of ["profile-timezone", "profile-default-currency", "profile-language"]) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }

    expect(source).toContain('aria-labelledby="profile-appearance-label profile-appearance-mode"');
    expect(source).toContain('aria-describedby="profile-appearance-description"');
    expect(source).toContain('setTheme(checked ? "dark" : "light")');
  });

  it("announces async states and keeps the invisible save bar out of the tab order", () => {
    expect(source).toContain('role="status" aria-live="polite"');
    expect(source).toContain("aria-hidden={!dirty}");
    expect(source).toContain('disabled={!dirty || saving}');
    expect(source).toContain('aria-busy={saving}');
  });

  it("preserves validation, relay protection, persistence, and discard behavior", () => {
    expect(source).toContain("profileSchema.safeParse(form)");
    expect(source).toContain("isAppleRelayEmail(v)");
    expect(source).toContain('msg.includes("user_profiles_contact_email_normalized_uidx")');
    expect(source).toContain('msg.includes("apple_relay_contact_email_not_allowed")');
    expect(source).toContain('window.addEventListener("beforeunload", handler)');
    expect(source).toContain('contact_email: form.contact_email?.trim() || null');
    expect(source).toContain('.from("user_profiles")');
    expect(source).toContain('.upsert(payload, { onConflict: "user_id" })');
    expect(source).toContain("setForm(initial)");
  });
});
