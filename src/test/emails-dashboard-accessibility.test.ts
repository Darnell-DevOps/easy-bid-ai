import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/EmailsDashboard.tsx"),
  "utf8",
);

describe("Emails dashboard accessibility", () => {
  it("names the dashboard section tabs", () => {
    expect(source).toMatch(/<TabsList aria-label="Email dashboard sections">/);
    expect(source).toContain('<TabsTrigger value="logs"');
    expect(source).toContain('<TabsTrigger value="templates"');
  });

  it("groups date filters and exposes the selected range", () => {
    expect(source).toMatch(
      /role="group" aria-label="Email activity date range"/,
    );
    expect(source).toContain("aria-pressed={range === r}");
  });

  it("associates every filter and dialog label with a unique control", () => {
    const labelIds = [...source.matchAll(/<Label\s+htmlFor="([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(labelIds).toEqual([
      "email-template-filter",
      "email-status-filter",
      "test-email-template",
      "test-email-recipient",
    ]);
    expect(new Set(labelIds).size).toBe(labelIds.length);
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);

    for (const id of labelIds) {
      expect(source).toContain(`id="${id}"`);
    }
  });

  it("provides a keyboard-operable error disclosure", () => {
    expect(source).toContain("aria-expanded={isOpen}");
    expect(source).toContain('aria-controls={`email-error-${r.id}`}');
    expect(source).toContain(
      'aria-label={`${isOpen ? "Hide" : "Show"} error details for ${r.recipient}`}',
    );
    expect(source).toContain("e.stopPropagation();");
    expect(source).toContain('<TableRow id={`email-error-${r.id}`}>');
  });

  it("labels pagination and announces page changes", () => {
    expect(source).toMatch(
      /<nav[^>]*aria-label="Email log pagination"/,
    );
    expect(source).toMatch(/aria-live="polite">Page \{page \+ 1\}<\/span>/);
  });

  it("provides a programmatic description for the test-email dialog", () => {
    expect(source).toContain("<DialogDescription>");
    expect(source).toContain(
      "Sends realistic sample data through the live Resend connection.",
    );
  });

  it("marks the test recipient as a required email field", () => {
    expect(source).toMatch(
      /id="test-email-recipient"[\s\S]*?type="email"[\s\S]*?autoComplete="email"[\s\S]*?required/,
    );
    expect(source).toMatch(
      /<Button onClick=\{send\} disabled=\{sending \|\| !recipient\} aria-busy=\{sending\}>/,
    );
  });

  it("hides decorative dashboard and status icons", () => {
    const iconTags = [
      ...source.matchAll(/<(Mail|List|FileText|Send|Loader2)\b[^>]*>/g),
    ].map((match) => match[0]);

    expect(iconTags).toHaveLength(5);
    for (const iconTag of iconTags) {
      expect(iconTag).toContain('aria-hidden="true"');
    }
    expect(source.match(/<meta\.Icon[^>]*aria-hidden="true"/g)).toHaveLength(2);
  });

  it("preserves the accessible loading and email activity table", () => {
    expect(source).toContain(
      '<AccessibleLoadingState label="Loading email activity" className="p-12" />',
    );
    expect(source).toContain('<Table scrollLabel="Email activity table">');
    expect(source).toContain(
      '<TableCaption className="sr-only">Email delivery activity for the selected date range.</TableCaption>',
    );
  });
});
