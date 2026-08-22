import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/TestimonialsDashboard.tsx"), "utf8");

describe("Testimonials dashboard accessibility", () => {
  it("requires the reusable field wrapper to target a control", () => {
    expect(source).toContain("function Field({");
    expect(source).toContain("id: string;");
    expect(source).toContain("<Label htmlFor={id}");
    expect(source).not.toMatch(/<Field\s+label=/);
  });

  it("associates settings and dialog labels with their controls", () => {
    const controlIds = [
      "testimonial-from-name",
      "testimonial-personal-message",
      "testimonial-follow-up-days",
      "testimonial-max-reminders",
      "testimonial-google-review-url",
      "testimonial-wall-headline",
      "testimonial-wall-intro",
      "review-request-name",
      "review-request-email",
      "manual-testimonial-name",
      "manual-testimonial-company",
      "manual-testimonial-role",
      "manual-testimonial-content",
    ];

    for (const id of controlIds) {
      expect(source).toContain(`<Field id="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
  });

  it("connects automation switches and Google review help text", () => {
    expect(source).toContain('<ToggleRow id="testimonial-auto-contract"');
    expect(source).toContain('<ToggleRow id="testimonial-auto-payment"');
    expect(source).toContain("<Label htmlFor={id}");
    expect(source).toContain("<Switch id={id}");
    expect(source).toContain('aria-describedby="testimonial-google-review-help"');
    expect(source).toContain('id="testimonial-google-review-help"');
  });

  it("exposes rating selection and testimonial card ratings", () => {
    expect(source).toContain('role="group" aria-labelledby="manual-testimonial-rating-label"');
    expect(source).toContain('aria-label={`${i} star${i === 1 ? "" : "s"}`}');
    expect(source).toContain("aria-pressed={form.rating === i}");
    expect(source).toContain('role="img" aria-label={`${t.rating || 0} out of 5 stars`}');
  });

  it("names dialogs, required fields, async actions, and icon-only actions", () => {
    expect(source.match(/<DialogDescription>/g)).toHaveLength(2);
    expect(source.match(/aria-busy=\{busy\}/g)).toHaveLength(2);
    expect(source).toContain('aria-label="Copy testimonial wall URL"');
    expect(source).toContain('aria-label="Open testimonial wall in a new tab"');
    expect(source).toContain('aria-label={`Delete testimonial from ${t.client_name}`}');
    expect(source).toContain('aria-label={`Copy review link for ${r.client_name || r.client_email}`}');
    expect(source).toContain('aria-label={`Delete review request for ${r.client_name || r.client_email}`}');
  });

  it("preserves settings, review-request, and testimonial persistence", () => {
    expect(source).toContain('.from("testimonial_settings")');
    expect(source).toContain('.from("review_requests").insert({');
    expect(source).toContain('.from("testimonials").insert({');
    expect(source).toContain('.from("testimonials").update(patch).eq("id", t.id)');
  });
});
