import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/templates/CreateOnboardingFromTemplateDialog.tsx"),
  "utf8",
);

describe("Create onboarding from template dialog accessibility", () => {
  it("associates the client selector and identity fields", () => {
    for (const id of [
      "onboarding-template-client",
      "onboarding-template-client-name",
      "onboarding-template-client-email",
    ]) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }

    expect(source).toContain('autoComplete="name"');
    expect(source).toContain("required");
    expect(source).toContain('type="email"');
    expect(source).toContain('autoComplete="email"');
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);
  });

  it("describes prefilling, creation progress, and success", () => {
    expect(source).toContain('aria-label="Pre-fill onboarding from lead intake"');
    expect(source).toContain('aria-describedby="onboarding-template-prefill-help"');
    expect(source).toContain('id="onboarding-template-prefill-help"');
    expect(source).toContain('aria-busy={submitting}');
    expect(source).toContain('<div role="status"');
  });

  it("labels and protects the generated share-link controls", () => {
    expect(source).toContain('htmlFor="onboarding-template-share-link"');
    expect(source).toContain('id="onboarding-template-share-link"');
    expect(source).toContain('autoComplete="off"');
    expect(source).toContain("spellCheck={false}");
    expect(source).toContain('aria-label="Copy onboarding link"');
    expect(source).toContain('<Copy aria-hidden="true"');
  });

  it("preserves client loading and direct or label-based prefilling", () => {
    expect(source).toContain('.from("clients")');
    expect(source).toContain('.select("id, name, email, company, intake_responses")');
    expect(source).toContain("if (intake[f.id] != null && intake[f.id] !== \"\")");
    expect(source).toContain("const slug = slugify(f.label)");
    expect(source).toContain("const prefill = usePrefill ? computePrefill(fields, intake) : {}");
  });

  it("preserves creation, status, link, preview, and navigation workflows", () => {
    expect(source).toContain("if (!clientName.trim())");
    expect(source).toContain('client_id: clientId !== "__new__" ? clientId : null');
    expect(source).toContain('status: appliedCount > 0 ? "in_progress" : "pending"');
    expect(source).toContain("started_at: appliedCount > 0 ? nowIso : null");
    expect(source).toContain('.select("id, access_token")');
    expect(source).toContain("setCreatedToken(data.access_token)");
    expect(source).toContain("await navigator.clipboard.writeText(link)");
    expect(source).toContain('window.open(link, "_blank")');
    expect(source).toContain('navigate("/dashboard/onboarding")');
  });
});
