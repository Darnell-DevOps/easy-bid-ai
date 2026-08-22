import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/LeadAssistant.tsx"), "utf8");

describe("Lead Assistant client form accessibility", () => {
  it("associates each extracted client-detail label with its control", () => {
    const controlIds = [
      "lead-detail-phone",
      "lead-detail-service",
      "lead-detail-budget",
      "lead-detail-timeline",
      "lead-detail-goals",
      "lead-detail-notes",
    ];

    for (const id of controlIds) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
  });

  it("exposes useful phone input metadata", () => {
    expect(source).toMatch(/id="lead-detail-phone"[\s\S]*?type="tel"[\s\S]*?autoComplete="tel"/);
  });

  it("names the editable AI-drafted reply from its heading", () => {
    expect(source).toContain('id="ai-drafted-reply-heading"');
    expect(source).toContain('id="ai-drafted-reply"');
    expect(source).toContain('aria-labelledby="ai-drafted-reply-heading"');
  });

  it("announces client-save activity and completion", () => {
    expect(source).toContain("aria-busy={saving}");
    expect(source).toContain('<div role="status" aria-live="polite"');
    expect(source).toContain('<Loader2 aria-hidden="true"');
    expect(source).toContain('<UserPlus aria-hidden="true"');
  });

  it("preserves earlier validation and error associations", () => {
    expect(source).toContain('document.getElementById(firstInvalid === "message" ? "msg" : firstInvalid)?.focus()');
    expect(source).toContain('<p role="alert" aria-atomic="true"');
    expect(source).toContain('aria-describedby={errors.name ? "name-error" : undefined}');
    expect(source).toContain('aria-describedby={errors.email ? "email-error" : undefined}');
    expect(source).toContain('aria-describedby={errors.message ? "msg-error" : undefined}');
  });

  it("preserves existing-client enrichment and new-client insertion", () => {
    expect(source).toContain('.update(update)');
    expect(source).toContain('.eq("id", existing.id)');
    expect(source).toContain('.insert({');
    expect(source).toContain("setSavedClientId(existing.id)");
    expect(source).toContain("setSavedClientId(data.id)");
  });
});
