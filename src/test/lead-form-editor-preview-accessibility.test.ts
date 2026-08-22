import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/LeadFormEditor.tsx"), "utf8");

describe("Lead form editor preview accessibility", () => {
  it("uses a heading and labelled sections for the preview structure", () => {
    expect(source).toContain(">Live preview</h2>");
    expect(source).toContain('aria-labelledby={`lead-form-preview-section-${gi}`}');
    expect(source).toContain('<h3 id={`lead-form-preview-section-${gi}`}');
  });

  it("uses group labels for controls that are not labelled by htmlFor", () => {
    expect(source).toContain(
      'const usesGroupLabel = ["radio", "multi_select", "checkbox", "file"].includes(f.type);',
    );
    expect(source).toContain("<p id={labelId}");
    expect(source).toContain("<Label id={labelId} htmlFor={f.id}");
  });

  it("passes the visible label and help text IDs to each generated control", () => {
    expect(source).toMatch(/<SmartFieldRenderer[\s\S]*?labelId=\{labelId\}[\s\S]*?descriptionId=\{descriptionId\}/);
    expect(source).toContain("<p id={descriptionId}");
  });

  it("announces required fields without exposing the decorative asterisk", () => {
    expect(source).toContain('<span aria-hidden="true" className="text-rose-500 ml-1">*</span>');
    expect(source).toContain('<span className="sr-only"> (required)</span>');
  });

  it("hides decorative preview icons from assistive technology", () => {
    expect(source).toContain('<ShieldCheck aria-hidden="true"');
    expect(source).toContain('<Send aria-hidden="true"');
  });
});
