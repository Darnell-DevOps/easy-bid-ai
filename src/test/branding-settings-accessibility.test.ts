import { describe, expect, it } from "vitest";
import { readSource } from "./read-source";

const source = readSource("src/components/settings/BrandingSettings.tsx");

describe("Branding settings accessibility", () => {
  it("associates identity and welcome-message labels with their controls", () => {
    for (const id of [
      "brand-settings-business-name",
      "brand-settings-tagline",
      "brand-settings-welcome-message",
    ]) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }

    expect(source).toContain('autoComplete="organization"');
  });

  it("labels both controls in each reusable colour field", () => {
    expect(source).toContain('<ColorField id="brand-settings-primary-colour"');
    expect(source).toContain('<ColorField id="brand-settings-secondary-colour"');
    expect(source).toContain("<Label htmlFor={id}");
    expect(source).toContain('aria-label={`${label} picker`}');
    expect(source).toContain("<Input id={id}");
  });

  it("names logo and favicon upload actions and connects file guidance", () => {
    expect(source).toContain('<AssetUpload\n                  id="brand-settings-logo"');
    expect(source).toContain('<AssetUpload\n                  id="brand-settings-favicon"');
    expect(source).toContain('aria-label={`${value ? "Replace" : "Upload"} ${label.toLowerCase()}`}');
    expect(source).toContain('aria-label={`Remove ${label.toLowerCase()}`}');
    expect(source).toContain('aria-busy={uploading}');
    expect(source).toContain('id={`${id}-help`}');
    expect(source).toContain('aria-describedby={`${id}-help`}');
  });

  it("preserves upload validation, storage, persistence, and switch naming", () => {
    expect(source).toContain('if (!file.type.startsWith("image/"))');
    expect(source).toContain("if (file.size > 2 * 1024 * 1024)");
    expect(source).toContain('.from("branding-logos")');
    expect(source).toContain('.upsert({ user_id: u.user.id, ...state }, { onConflict: "user_id" })');
    expect(source).toContain("<Switch checked={checked} onCheckedChange={onChange} aria-label={label} />");
  });
});
