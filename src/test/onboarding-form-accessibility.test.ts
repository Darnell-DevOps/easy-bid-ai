import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/OnboardingFormPage.tsx"), "utf8");

describe("public onboarding form accessibility", () => {
  it("labels each field group with a real heading", () => {
    expect(source).toContain('aria-labelledby={`onboarding-section-${groupIndex}`}');
    expect(source).toContain('<h2 id={`onboarding-section-${groupIndex}`}');
  });

  it("uses the correct label pattern for single and grouped controls", () => {
    expect(source).toContain(
      'const usesGroupLabel = ["radio", "multi_select", "checkbox", "file"].includes(field.type);',
    );
    expect(source).toContain("<p id={labelId}");
    expect(source).toContain("<Label id={labelId} htmlFor={field.id}");
  });

  it("connects labels, help text, and validation messages to generated controls", () => {
    expect(source).toMatch(/<SmartFieldRenderer[\s\S]*?labelId=\{labelId\}[\s\S]*?descriptionId=\{descriptionId\}[\s\S]*?invalid=\{invalid\}[\s\S]*?errorId=\{errorId\}/);
    expect(source).toContain("<p id={descriptionId}");
    expect(source).toContain("<p id={errorId}");
  });

  it("announces validation and focuses the first missing field", () => {
    expect(source).toContain('<div role="alert"');
    expect(source).toContain("setInvalidFieldIds(missing.map((field) => field.id))");
    expect(source).toContain('document.getElementById(`onboarding-${missing[0].id}-field-wrapper`)?.focus()');
    expect(source).toContain("tabIndex={-1}");
  });

  it("preserves progress semantics and exposes submission activity", () => {
    expect(source).toContain('role="progressbar"');
    expect(source).toContain('aria-label="Onboarding form completion"');
    expect(source.match(/aria-busy=\{submitting\}/g)).toHaveLength(2);
  });
});
