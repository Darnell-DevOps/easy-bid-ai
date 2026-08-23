import { describe, expect, it } from "vitest";
import { readSource } from "./read-source";

const calendar = readSource("src/pages/CalendarPage.tsx");

describe("calendar form accessibility", () => {
  it("associates every Calendar Label with a unique form control", () => {
    const controlIds = [
      "schedule-client-name",
      "schedule-client-email",
      "schedule-meeting-name",
      "schedule-date",
      "schedule-time",
      "schedule-duration",
      "schedule-location",
      "schedule-location-details",
      "schedule-notes",
      "booking-link-name",
      "booking-link-description",
      "booking-link-duration",
      "booking-link-location",
      "booking-link-custom-location",
      "booking-link-meeting-url",
      "booking-link-start-time",
      "booking-link-end-time",
      "availability-working-start",
      "availability-working-end",
      "availability-buffer",
      "availability-minimum-notice",
    ];

    for (const id of controlIds) {
      expect(calendar).toContain(`htmlFor="${id}"`);
      expect(calendar).toContain(`id="${id}"`);
    }

    expect(new Set(controlIds).size).toBe(controlIds.length);
    expect([...calendar.matchAll(/<Label\b(?![^>]*\bhtmlFor=)[^>]*>/g)]).toEqual([]);
  });

  it("exposes available-day selectors as named pressed-button groups", () => {
    expect(calendar).toContain("<legend className=\"text-sm font-medium leading-none\">Available days</legend>");
    expect(calendar).toContain("<legend className=\"text-sm font-medium leading-none\">Working days</legend>");
    expect(calendar.match(/aria-label=\{DAY_NAMES_FULL\[i\]\}/g)).toHaveLength(2);
    expect(calendar.match(/aria-pressed=\{active\}/g)).toHaveLength(2);
  });

  it("keeps required customer fields, help text, and compact controls accessible", () => {
    expect(calendar).toContain('id="schedule-client-name"\n                  required\n                  autoComplete="name"');
    expect(calendar).toContain('id="schedule-client-email"\n                  type="email"\n                  required\n                  autoComplete="email"');
    expect(calendar).toContain('aria-describedby="booking-link-meeting-url-help"');
    expect(calendar).toContain('id="booking-link-meeting-url-help"');
    expect(calendar).toContain('className="h-6 w-6 shrink-0 rounded border-border"');
  });

  it("stacks dense Calendar dialog rows at narrow widths", () => {
    expect(calendar.match(/grid grid-cols-1 gap-3 sm:grid-cols-2/g)?.length).toBeGreaterThanOrEqual(6);
    expect(calendar).toContain("grid grid-cols-1 gap-3 sm:grid-cols-3");
  });
});
