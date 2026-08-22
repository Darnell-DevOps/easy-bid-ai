import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const contracts = readFileSync(resolve(process.cwd(), "src/pages/ContractsPage.tsx"), "utf8");

describe("contracts creation form accessibility", () => {
  it("associates every ContractsPage Label with a unique control", () => {
    const controlIds = [
      "contract-create-type",
      "contract-create-proposal",
      "contract-create-client-link",
      "contract-create-provider",
      "contract-create-client-name",
      "contract-create-client-email",
      "contract-create-client-company",
      "contract-create-service",
      "contract-create-scope",
      "contract-create-timeline",
      "contract-create-fee",
      "contract-create-payment-terms",
    ];

    for (const id of controlIds) {
      expect(contracts).toContain(`htmlFor="${id}"`);
      expect(contracts).toContain(`id="${id}"`);
    }

    expect(new Set(controlIds).size).toBe(controlIds.length);
    expect([...contracts.matchAll(/<Label\b(?![^>]*\bhtmlFor=)[^>]*>/g)]).toEqual([]);
  });

  it("marks required client details and exposes useful autocomplete hints", () => {
    expect(contracts).toMatch(/id="contract-create-client-name"\s+required\s+autoComplete="name"/);
    expect(contracts).toMatch(/id="contract-create-client-email"\s+type="email"\s+autoComplete="email"/);
    expect(contracts).toMatch(/id="contract-create-client-company"\s+autoComplete="organization"/);
    expect(contracts).toMatch(/id="contract-create-service"\s+required/);
    expect(contracts).toMatch(/id="contract-create-fee"\s+inputMode="decimal"/);
  });

  it("connects the linked-client explanation to its select trigger", () => {
    expect(contracts).toContain('id="contract-create-client-link" aria-describedby="contract-create-client-link-help"');
    expect(contracts).toContain('id="contract-create-client-link-help"');
  });
});
