import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public customer form accessibility", () => {
  const booking = source("src/pages/PublicBookingPage.tsx");
  const contract = source("src/pages/ContractSignPage.tsx");
  const leadForm = source("src/pages/PublicLeadFormPage.tsx");
  const smartFields = source("src/components/forms/SmartFieldRenderer.tsx");

  it("keeps the public booking fields and calendar programmatically named", () => {
    expect(booking).toContain('<Label htmlFor="booking-name">');
    expect(booking).toContain('id="booking-name"');
    expect(booking).toContain('autoComplete="name"');
    expect(booking).toContain('<Label htmlFor="booking-email">');
    expect(booking).toContain('id="booking-email"');
    expect(booking).toContain('autoComplete="email"');
    expect(booking).toContain('<Label htmlFor="booking-message">');
    expect(booking).toContain('id="booking-message"');
    expect(booking).toContain('aria-labelledby="booking-details-heading"');
    expect(booking).toContain("aria-label={d.toLocaleDateString");
    expect(booking).toContain("aria-pressed={!!selected}");
  });

  it("keeps contract signing usable without relying on placeholder text or drawing", () => {
    expect(contract).toContain('<Label htmlFor="contract-signer-name">');
    expect(contract).toContain('id="contract-signer-name"');
    expect(contract).toContain('autoComplete="name"');
    expect(contract).toContain('<Label htmlFor="contract-signer-email">');
    expect(contract).toContain('id="contract-signer-email"');
    expect(contract).toContain('autoComplete="email"');
    expect(contract).toContain('aria-label="Signature method"');
    expect(contract).toContain('aria-label={`Typed signature preview:');
    expect(contract).toContain('aria-describedby="draw-signature-instructions"');
    expect(contract).toContain("Keyboard and screen-reader users can select Type signature instead.");
  });

  it("keeps the signing agreement control labelled and large enough for WCAG 2.2", () => {
    expect(contract).toContain('id="contract-agreement"');
    expect(contract).toContain('<Label htmlFor="contract-agreement"');
    expect(contract).toContain('className="mt-0.5 h-6 w-6"');
  });

  it("keeps the public lead form structured as a labelled, announced form", () => {
    expect(leadForm).toContain("<form onSubmit={handleSubmit} noValidate aria-busy={submitting}>");
    expect(leadForm).toContain('type="submit"');
    expect(leadForm).toContain('role="alert"');
    expect(leadForm).toContain("labelId={labelId}");
    expect(leadForm).toContain("descriptionId={descriptionId}");
    expect(leadForm).toContain('aria-labelledby={`lead-form-section-${gi}`}');
  });

  it("keeps dynamic controls and uploads programmatically named", () => {
    expect(smartFields).toContain("aria-labelledby={labelId}");
    expect(smartFields).toContain("const describedBy = [descriptionId, invalid ? errorId : undefined]");
    expect(smartFields).toContain("aria-describedby={describedBy}");
    expect(smartFields).toContain("aria-required={field.required || undefined}");
    expect(smartFields).toContain('aria-label={`Remove ${p.name}`}');
    expect(smartFields).toContain('aria-label={`Remove ${existingSingle.name}`}');
    expect(smartFields).toContain('aria-live="polite"');
    expect(smartFields).toContain('className="h-6 w-6"');
  });
});
