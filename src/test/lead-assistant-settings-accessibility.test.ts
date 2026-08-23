import { describe, expect, it } from "vitest";
import { readSource } from "./read-source";

const source = readSource("src/components/settings/LeadAssistantSettings.tsx");

describe("Lead Assistant settings accessibility", () => {
  it("associates reusable business fields with labels and help", () => {
    for (const id of [
      "lead-assistant-business-name",
      "lead-assistant-services",
      "lead-assistant-ideal-client",
      "lead-assistant-target-audience",
      "lead-assistant-booking-link",
    ]) {
      expect(source).toContain(`id="${id}"`);
    }

    expect(source).toContain("<Label htmlFor={id}");
    expect(source).toContain("<Textarea\n          id={id}");
    expect(source).toContain("<Input\n          id={id}");
    expect(source).toContain('aria-describedby={helper ? `${id}-help` : undefined}');
    expect(source).toContain('<p id={`${id}-help`}');
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);
  });

  it("labels each reply preference Select and the email signature", () => {
    for (const id of [
      "lead-assistant-tone",
      "lead-assistant-reply-style",
      "lead-assistant-reply-length",
      "lead-assistant-min-confidence",
    ]) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }

    expect(source).toContain("<SelectTrigger id={id}");
    expect(source).toContain('htmlFor="lead-assistant-email-signature"');
    expect(source).toContain('id="lead-assistant-email-signature"');
    expect(source).toContain('aria-describedby="lead-assistant-email-signature-count"');
  });

  it("makes block-list controls and async states keyboard and screen-reader accessible", () => {
    expect(source).toContain('htmlFor="lead-assistant-block-keyword"');
    expect(source).toContain('aria-describedby="lead-assistant-block-keyword-help"');
    expect(source).toContain('aria-label={`Remove ${k} from block list`}');
    expect(source).toContain("focus-visible:ring-2");
    expect(source).toContain('role="status" aria-live="polite"');
    expect(source).toContain('aria-label="Save Lead Assistant changes" aria-busy={saving}');
    expect(source).toContain('<Switch checked={checked} onCheckedChange={onChange} aria-label={label} />');
  });

  it("preserves AI preference persistence, limits, and auto-send safeguards", () => {
    expect(source).toContain('.from("ai_preferences")');
    expect(source).toContain('.upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" })');
    expect(source).toContain('lead_auto_send_enabled: false');
    expect(source).toContain('if (prefs.lead_auto_send_block_keywords.includes(v))');
    expect(source).toContain('prefs.lead_auto_send_block_keywords.filter((x) => x !== k)');
    expect(source).toContain('e.target.value.slice(0, 600)');
    expect(source).toContain("server keeps every drafted reply in your review queue");
  });
});
