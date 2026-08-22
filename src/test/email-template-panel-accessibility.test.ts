import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/emails/TemplatesPanel.tsx"),
  "utf8",
);

describe("email template editor panel accessibility", () => {
  it("announces the loading state", () => {
    expect(source).toMatch(/role="status" aria-live="polite"/);
    expect(source).toContain('<span className="sr-only">Loading email templates</span>');
  });

  it("names the template chooser and exposes its selection", () => {
    expect(source).toContain('id="email-template-list-heading"');
    expect(source).toMatch(
      /role="group" aria-labelledby="email-template-list-heading"/,
    );
    expect(source).toContain("aria-pressed={isActive}");
  });

  it("exposes the current edit or preview mode", () => {
    expect(source).toMatch(/role="group" aria-label="Email template view mode"/);
    expect(source).toContain('aria-pressed={mode === "edit"}');
    expect(source).toContain('aria-pressed={mode === "preview"}');
  });

  it("associates every form label with a unique control", () => {
    const labelIds = [...source.matchAll(/<Label\s+htmlFor="([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(labelIds).toHaveLength(6);
    expect(new Set(labelIds).size).toBe(labelIds.length);
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);

    for (const id of labelIds) {
      expect(source).toContain(`id="${id}"`);
    }
  });

  it("names and describes the variable insertion controls", () => {
    expect(source).toContain('id="email-template-variables-heading"');
    expect(source).toContain('id="email-template-variables-help"');
    expect(source).toMatch(
      /role="group" aria-labelledby="email-template-variables-heading" aria-describedby="email-template-variables-help"/,
    );
    expect(source).toContain('aria-label={`Insert ${v} variable`}');
  });

  it("announces saving and hides decorative icons", () => {
    expect(source).toMatch(
      /<Button size="sm" onClick=\{save\} disabled=\{saving\} aria-busy=\{saving\}/,
    );

    const iconTags = [
      ...source.matchAll(/<(Loader2|RotateCcw|Save|Eye|Pencil)\b[^>]*>/g),
    ].map((match) => match[0]);

    expect(iconTags).toHaveLength(6);
    for (const iconTag of iconTags) {
      expect(iconTag).toContain('aria-hidden="true"');
    }
  });

  it("gives the preview frame a descriptive title", () => {
    expect(source).toContain('<iframe title="Email template preview"');
  });
});
