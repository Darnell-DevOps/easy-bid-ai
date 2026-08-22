import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import SmartFieldRenderer from "@/components/forms/SmartFieldRenderer";
import type { SmartField } from "@/lib/form-fields";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("validation and asynchronous status accessibility", () => {
  it("connects invalid shared fields to help and error messages", () => {
    const field: SmartField = {
      id: "contact-email",
      label: "Contact email",
      type: "email",
      required: true,
    };

    render(
      <>
        <label id="contact-email-label" htmlFor="contact-email">Contact email</label>
        <SmartFieldRenderer
          field={field}
          value=""
          onChange={vi.fn()}
          labelId="contact-email-label"
          descriptionId="contact-email-help"
          invalid
          errorId="contact-email-error"
        />
        <p id="contact-email-help">Use a work address.</p>
        <p id="contact-email-error">This field is required.</p>
      </>,
    );

    const input = screen.getByRole("textbox", { name: "Contact email" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "contact-email-help contact-email-error");
    expect(input).toHaveAttribute("aria-required", "true");
  });

  it("marks, describes, and focuses invalid public lead fields", () => {
    const page = source("src/pages/PublicLeadFormPage.tsx");

    expect(page).toContain("setInvalidFieldIds(missing.map((field) => field.id))");
    expect(page).toContain('document.getElementById(`${missing[0].id}-field-wrapper`)?.focus()');
    expect(page).toContain("invalid={invalid}");
    expect(page).toContain("errorId={errorId}");
    expect(page).toContain('<p role="alert" aria-atomic="true"');
  });

  it("connects lead-assistant errors and announces generation state", () => {
    const assistant = source("src/pages/LeadAssistant.tsx");

    for (const id of ["name-error", "email-error", "msg-error"]) {
      expect(assistant).toContain(`aria-describedby={errors.${id === "msg-error" ? "message" : id.replace("-error", "")} ? "${id}" : undefined}`);
      expect(assistant).toContain(`id="${id}"`);
    }
    expect(assistant).toContain('role="alert" aria-atomic="true" className="sr-only"');
    expect(assistant).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(assistant).toContain("aria-busy={generating}");
  });

  it("keeps key public and AI async flows announced", () => {
    const oauth = source("src/pages/OAuthConsent.tsx");
    const recover = source("src/pages/RetainerRecoverPage.tsx");
    const reschedule = source("src/pages/ReschedulePage.tsx");
    const audit = source("src/components/ai/ProposalAuditPanel.tsx");

    expect(oauth).toContain('role="status" aria-live="polite"');
    expect(oauth).toContain('role="alert"');
    expect(oauth).toContain('aria-live="assertive"');
    expect(oauth).toContain("errorRef.current?.focus()");
    expect(recover).toContain('id="retainer-recovery-error" role="alert"');
    expect(reschedule).toContain('aria-label="Loading reschedule details"');
    expect(audit).toContain('role="alert" aria-atomic="true"');
    expect(audit).toContain("Proposal audit results ready.");
  });
});
