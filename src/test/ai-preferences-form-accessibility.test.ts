import { describe, expect, it } from "vitest";
import { readSource } from "./read-source";

const source = readSource("src/components/settings/AiPreferencesSettings.tsx");

describe("AI preferences form accessibility", () => {
  it("associates every standalone preference label with its Select trigger", () => {
    const selectIds = [
      "ai-default-tone",
      "ai-proposal-length",
      "ai-proposal-style",
      "ai-contract-detail",
      "ai-lead-tone",
      "ai-lead-length",
      "ai-email-tone",
      "ai-email-length",
    ];

    for (const id of selectIds) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`<SelectField id="${id}"`);
    }

    expect(source).toContain("<SelectTrigger id={id}");
  });

  it("gives reusable business fields stable labels and described counters", () => {
    const fieldIds = [
      "ai-business-what-you-do",
      "ai-business-services",
      "ai-business-target-audience",
      "ai-business-ideal-client",
    ];

    for (const id of fieldIds) expect(source).toContain(`<Field\n            id="${id}"`);

    expect(source).toContain("<Label htmlFor={id}");
    expect(source).toContain("id={id}");
    expect(source).toContain('aria-describedby={max ? `${id}-count` : undefined}');
    expect(source).toContain('id={`${id}-count`}');
  });

  it("names the custom-instructions field and connects its counter", () => {
    expect(source).toContain('htmlFor="ai-custom-instructions"');
    expect(source).toContain('id="ai-custom-instructions"');
    expect(source).toContain('aria-describedby="ai-custom-instructions-count"');
    expect(source).toContain('id="ai-custom-instructions-count"');
  });

  it("preserves preference persistence, preview generation, and switch naming", () => {
    expect(source).toContain('.from("ai_preferences")');
    expect(source).toContain('.upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" })');
    expect(source).toContain('supabase.functions.invoke("ai-preview", { body: { prefs } })');
    expect(source).toContain("<Switch checked={checked} onCheckedChange={onChange} aria-label={label} />");
  });
});
