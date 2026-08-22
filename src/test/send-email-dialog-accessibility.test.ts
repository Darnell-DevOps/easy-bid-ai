import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/emails/SendEmailDialog.tsx"),
  "utf8",
);

describe("email sending dialog accessibility", () => {
  it("provides a programmatic dialog description", () => {
    expect(source).toContain("<DialogDescription>");
    expect(source).toContain("Review the recipient and message before sending this email.");
  });

  it("associates every field label with a unique control", () => {
    const labelIds = [...source.matchAll(/<Label\s+htmlFor="([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(labelIds).toHaveLength(5);
    expect(new Set(labelIds).size).toBe(labelIds.length);
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);

    for (const id of labelIds) {
      expect(source).toContain(`id="${id}"`);
    }
  });

  it("marks the recipient as a required email field", () => {
    const recipientInput = source
      .split(/\r?\n/)
      .find((line) => line.includes('<Input id="send-email-recipient"'));

    expect(recipientInput).toContain('type="email"');
    expect(recipientInput).toContain('autoComplete="email" required');
  });

  it("exposes the current edit or preview mode", () => {
    expect(source).toMatch(/role="group" aria-label="Email view mode"/);
    expect(source).toContain('aria-pressed={mode === "edit"}');
    expect(source).toContain('aria-pressed={mode === "preview"}');
  });

  it("announces loading and retains a named preview frame", () => {
    expect(source).toMatch(/role="status" aria-live="polite"/);
    expect(source).toContain('<span className="sr-only">Loading email settings</span>');
    expect(source).toContain('<iframe title="email preview"');
  });

  it("announces sending and hides decorative icons", () => {
    expect(source).toMatch(
      /<Button onClick=\{send\} disabled=\{sending\} aria-busy=\{sending\}/,
    );

    const iconTags = [
      ...source.matchAll(/<(Loader2|Send|Copy|Eye|Pencil)\b[^>]*>/g),
    ].map((match) => match[0]);

    expect(iconTags).toHaveLength(6);
    for (const iconTag of iconTags) {
      expect(iconTag).toContain('aria-hidden="true"');
    }
  });
});
