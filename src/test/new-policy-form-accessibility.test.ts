import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/NewPolicy.tsx"), "utf8");

describe("New Policy form accessibility", () => {
  it("associates every visible field label with its control", () => {
    const controlIds = [
      "policy-type",
      "policy-business-name",
      "policy-country",
      "policy-services",
      "policy-business-type",
      "policy-payment-methods",
      "policy-refund-rules",
      "policy-data-collected",
      "policy-special-requirements",
    ];

    for (const id of controlIds) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
  });

  it("announces required fields without relying on an asterisk", () => {
    expect(source.match(/aria-required="true"/g)).toHaveLength(4);
    expect(source.match(/<span className="sr-only"> \(required\)<\/span>/g)).toHaveLength(4);
    expect(source.match(/<span aria-hidden="true"> \*<\/span>/g)).toHaveLength(4);
  });

  it("exposes the optional details as an expanded or collapsed region", () => {
    expect(source).toContain("aria-expanded={showAdvanced}");
    expect(source).toContain('aria-controls="policy-optional-details"');
    expect(source).toContain('<Card id="policy-optional-details">');
  });

  it("announces generation activity and hides decorative icons", () => {
    expect(source).toContain("aria-busy={loading}");
    expect(source).toContain('<ArrowLeft aria-hidden="true"');
    expect(source).toContain('<AlertTriangle aria-hidden="true"');
    expect(source).toContain('<Sparkles aria-hidden="true"');
  });

  it("preserves the policy generation and persistence flow", () => {
    expect(source).toContain('supabase.functions.invoke("generate-policy", { body: form })');
    expect(source).toContain('.from("policies")');
    expect(source).toContain('.insert({ ...form, content, user_id: userId })');
    expect(source).toContain('navigate(`/dashboard/policies/${inserted.id}`)');
  });
});
