import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const retainer = readFileSync(resolve(process.cwd(), "src/pages/NewRetainerPage.tsx"), "utf8");

describe("new retainer form accessibility", () => {
  it("associates every visible form label with a unique control", () => {
    const controlIds = [
      "retainer-client-select",
      "retainer-client-name",
      "retainer-client-email",
      "retainer-client-company",
      "retainer-title",
      "retainer-description",
      "retainer-amount",
      "retainer-currency",
      "retainer-tax-mode",
      "retainer-tax-rate",
      "retainer-billing-frequency",
      "retainer-custom-days",
      "retainer-start-date",
      "retainer-end-date",
      "retainer-auto-renew",
      "retainer-notes",
    ];

    for (const id of controlIds) {
      expect(retainer).toContain(`htmlFor="${id}"`);
      expect(retainer).toContain(`id="${id}"`);
    }

    expect(new Set(controlIds).size).toBe(controlIds.length);
    expect([...retainer.matchAll(/<Label\b(?![^>]*\bhtmlFor=)[^>]*>/g)]).toEqual([]);
  });

  it("matches required and autocomplete semantics to the submission rules", () => {
    expect(retainer).toMatch(/id="retainer-client-name"\s+required\s+autoComplete="name"/);
    expect(retainer).toMatch(/id="retainer-client-email"\s+type="email"\s+autoComplete="email"/);
    expect(retainer).toMatch(/id="retainer-client-company"\s+autoComplete="organization"/);
    expect(retainer).toMatch(/id="retainer-amount"\s+type="number"\s+inputMode="decimal"\s+required/);
  });

  it("provides constrained numeric inputs for money and custom billing", () => {
    expect(retainer).toContain('min="0.01"');
    expect(retainer).toContain('step="0.01"');
    expect(retainer).toMatch(/id="retainer-custom-days"\s+type="number"\s+inputMode="numeric"/);
    expect(retainer).toContain("min={1}");
    expect(retainer).toContain("step={1}");
  });

  it("connects the Auto-renew explanation to its switch", () => {
    expect(retainer).toContain('htmlFor="retainer-auto-renew"');
    expect(retainer).toContain('id="retainer-auto-renew-label"');
    expect(retainer).toContain('aria-labelledby="retainer-auto-renew-label"');
    expect(retainer).toContain('id="retainer-auto-renew-help"');
    expect(retainer).toContain('aria-describedby="retainer-auto-renew-help"');
  });
});
