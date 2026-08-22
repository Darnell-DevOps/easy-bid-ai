import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public booking abuse protection", () => {
  const backend = source("supabase/functions/create-public-booking/index.ts");
  const notifier = source("supabase/functions/notify-booking-host/index.ts");
  const sender = source("supabase/functions/send-email/index.ts");
  const frontend = source("src/pages/PublicBookingPage.tsx");
  const config = source("supabase/config.toml");
  const migration = source(
    "supabase/migrations/20260808120000_protect_public_booking_creation.sql",
  );

  it("creates public bookings only through the rate-limited Edge Function", () => {
    expect(frontend).toContain('functions.invoke("create-public-booking"');
    expect(frontend).not.toContain('.from("bookings").insert');
    expect(backend).toContain("enforcePublicRateLimit(req");
    expect(backend).toContain('source: "create-public-booking"');
    expect(backend).toContain("resource: slug.toLowerCase()");
  });

  it("uses server-owned booking-link values for the inserted booking", () => {
    const linkLookup = backend.indexOf('.from("booking_links")');
    const bookingInsert = backend.indexOf('.from("bookings")');

    expect(linkLookup).toBeGreaterThan(-1);
    expect(bookingInsert).toBeGreaterThan(linkLookup);
    expect(backend).toContain("user_id: link.user_id");
    expect(backend).toContain("duration_minutes: link.duration_minutes");
    expect(backend).toContain("meeting_name: link.name");
    expect(backend).not.toMatch(/body\.(userId|durationMinutes|meetingName)/);
  });

  it("binds optional proposals to the booking-link owner", () => {
    expect(backend).toContain('.from("proposals")');
    expect(backend).toContain('.eq("user_id", link.user_id)');
  });

  it("removes anonymous table insertion and the public token lookup", () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Public create bookings via link" ON public.bookings',
    );
    expect(migration).toContain("REVOKE INSERT ON public.bookings FROM anon");
    expect(migration).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.public_get_booking_reschedule_token\(uuid\)[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
  });

  it("routes public host notifications through the trusted booking function", () => {
    expect(frontend).not.toContain('functions.invoke("notify-booking-host"');
    expect(backend).toContain('`${supabaseUrl}/functions/v1/${functionName}`');
    expect(backend).toContain('"notify-booking-host"');
    expect(backend).toContain('Authorization: `Bearer ${serviceKey}`');
  });

  it("sends attendee confirmations only from the trusted booking function", () => {
    const bookingInsert = backend.indexOf('.from("bookings")');
    const attendeeEmail = backend.indexOf('"send-email"');

    expect(frontend).not.toContain("sendEmail(");
    expect(frontend).not.toContain("buildIcs(");
    expect(frontend).toContain("clientTimeZone: tz");
    expect(attendeeEmail).toBeGreaterThan(bookingInsert);
    expect(backend).toContain('templateName: "booking-confirmation"');
    expect(backend).toContain('idempotencyKey: `booking-${booking.id}`');
    expect(backend).toContain('content_type: "text/calendar"');
    expect(backend).toContain("resolvePublicUrl(");
    expect(sender).toContain('"text/calendar"');
  });

  it("allows host notifications only for internal calls or the booking owner", () => {
    const authentication = notifier.indexOf("await userClient.auth.getUser(bearer)");
    const bodyRead = notifier.indexOf("await req.json()");

    expect(authentication).toBeGreaterThan(-1);
    expect(authentication).toBeLessThan(bodyRead);
    expect(notifier).toContain("const isInternal = bearer === serviceKey");
    expect(notifier).toContain("booking.user_id !== callerUserId");
    expect(notifier).toContain('req.method !== "POST"');
  });

  it("declares the booking functions explicitly in Supabase config", () => {
    expect(config).toMatch(
      /\[functions\.create-public-booking\]\s+verify_jwt = false/,
    );
    expect(config).toMatch(
      /\[functions\.notify-booking-host\]\s+verify_jwt = true/,
    );
  });
});
