import { createClient } from "npm:@supabase/supabase-js@2";
import { enforcePublicRateLimit } from "../_shared/abuse-rate-limit.ts";
import { resolvePublicUrl } from "../_shared/customDomain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_FUTURE_BOOKING_MS = 2 * 365 * 24 * 60 * 60 * 1000;

type BookingRequest = {
  slug?: unknown;
  proposalId?: unknown;
  clientName?: unknown;
  clientEmail?: unknown;
  clientMessage?: unknown;
  scheduledAt?: unknown;
  clientTimeZone?: unknown;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function meetingUrlFor(
  link: {
    location_type: string;
    custom_location: string | null;
    meeting_url: string | null;
  },
  bookingId: string,
): string | null {
  if (
    link.location_type === "custom" &&
    link.custom_location &&
    /^https?:\/\//i.test(link.custom_location)
  ) {
    return link.custom_location;
  }
  if (link.meeting_url && /^https?:\/\//i.test(link.meeting_url)) {
    return link.meeting_url;
  }
  if (link.location_type === "google_meet" || link.location_type === "zoom") {
    const room = `CloseSync-${bookingId.replace(/-/g, "").slice(0, 12)}`;
    return `https://meet.jit.si/${room}`;
  }
  return null;
}

function normalizeTimeZone(value: unknown): string {
  if (typeof value !== "string" || value.length > 100) return "UTC";
  const timeZone = value.trim();
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

function locationLabelFor(link: {
  location_type: string;
  custom_location: string | null;
}): string {
  if (link.location_type === "custom" && link.custom_location) {
    return link.custom_location;
  }
  const labels: Record<string, string> = {
    google_meet: "Google Meet",
    zoom: "Zoom",
    phone: "Phone call",
    custom: "Custom link",
  };
  return labels[link.location_type] || link.location_type;
}

function fmtIcs(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildIcs(opts: {
  uid: string;
  title: string;
  description?: string;
  start: Date;
  durationMinutes: number;
  location?: string;
  url?: string;
  attendeeName: string;
  attendeeEmail: string;
}): string {
  const end = new Date(opts.start.getTime() + opts.durationMinutes * 60_000);
  const escapeIcs = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const description = [
    opts.url ? `Join: ${opts.url}` : "",
    opts.description || "",
  ].filter(Boolean);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CloseSync AI//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@closesync.io`,
    `DTSTAMP:${fmtIcs(new Date())}`,
    `DTSTART:${fmtIcs(opts.start)}`,
    `DTEND:${fmtIcs(end)}`,
    `SUMMARY:${escapeIcs(opts.title)}`,
    description.length
      ? `DESCRIPTION:${escapeIcs(description.join("\n\n"))}`
      : "",
    opts.url || opts.location
      ? `LOCATION:${escapeIcs(opts.url || opts.location || "")}`
      : "",
    opts.url ? `URL:${escapeIcs(opts.url)}` : "",
    `ATTENDEE;CN=${escapeIcs(opts.attendeeName)};RSVP=TRUE:mailto:${opts.attendeeEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

function icsToBase64(ics: string): string {
  const bytes = new TextEncoder().encode(ics);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function invokeInternalFunction(
  supabaseUrl: string,
  serviceKey: string,
  functionName: string,
  body: unknown,
): Promise<void> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(
        `${functionName} failed`,
        response.status,
        await response.text(),
      );
    }
  } catch (error) {
    console.error(
      `${functionName} request failed`,
      error instanceof Error ? error.message : "unknown error",
    );
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ error: "request_too_large" }, 413);
  }

  let body: BookingRequest;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return json({ error: "request_too_large" }, 413);
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "invalid_json" }, 400);
    }
    body = parsed as BookingRequest;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const clientName =
    typeof body.clientName === "string" ? body.clientName.trim() : "";
  const clientEmail =
    typeof body.clientEmail === "string" ? body.clientEmail.trim() : "";
  const clientMessage =
    typeof body.clientMessage === "string" ? body.clientMessage.trim() : "";
  const scheduledAt =
    typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : null;
  const clientTimeZone = normalizeTimeZone(body.clientTimeZone);
  const proposalId =
    typeof body.proposalId === "string" && body.proposalId.trim()
      ? body.proposalId.trim()
      : null;

  if (!slug || slug.length > 100) return json({ error: "invalid_booking_link" }, 400);
  if (!clientName || clientName.length > 200) {
    return json({ error: "invalid_name" }, 400);
  }
  if (
    !clientEmail ||
    clientEmail.length > 200 ||
    !EMAIL_RE.test(clientEmail)
  ) {
    return json({ error: "invalid_email" }, 400);
  }
  if (clientMessage.length > 1000) {
    return json({ error: "message_too_long" }, 400);
  }
  if (proposalId && !UUID_RE.test(proposalId)) {
    return json({ error: "invalid_proposal" }, 400);
  }
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    return json({ error: "invalid_booking_time" }, 400);
  }
  const now = Date.now();
  if (
    scheduledAt.getTime() <= now ||
    scheduledAt.getTime() > now + MAX_FUTURE_BOOKING_MS
  ) {
    return json({ error: "invalid_booking_time" }, 400);
  }

  const limited = await enforcePublicRateLimit(req, {
    source: "create-public-booking",
    resource: slug.toLowerCase(),
    ipLimit: { maxRequests: 10, windowSeconds: 10 * 60 },
    resourceLimit: { maxRequests: 100, windowSeconds: 60 * 60 },
  });
  if (limited) return limited;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("create-public-booking is missing server configuration");
    return json({ error: "booking_temporarily_unavailable" }, 503);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: link, error: linkError } = await admin
    .from("booking_links")
    .select(
      "id, user_id, name, description, duration_minutes, location_type, custom_location, meeting_url",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (linkError) {
    console.error("Booking-link lookup failed", linkError.message);
    return json({ error: "booking_temporarily_unavailable" }, 503);
  }
  if (!link) return json({ error: "booking_link_not_found" }, 404);

  if (proposalId) {
    const { data: proposal, error: proposalError } = await admin
      .from("proposals")
      .select("id")
      .eq("id", proposalId)
      .eq("user_id", link.user_id)
      .maybeSingle();
    if (proposalError) {
      console.error("Proposal validation failed", proposalError.message);
      return json({ error: "booking_temporarily_unavailable" }, 503);
    }
    if (!proposal) return json({ error: "invalid_proposal" }, 400);
  }

  const bookingId = crypto.randomUUID();
  const meetingUrl = meetingUrlFor(link, bookingId);
  const { data: booking, error: insertError } = await admin
    .from("bookings")
    .insert({
      id: bookingId,
      user_id: link.user_id,
      booking_link_id: link.id,
      proposal_id: proposalId,
      client_name: clientName,
      client_email: clientEmail,
      meeting_name: link.name,
      duration_minutes: link.duration_minutes,
      scheduled_at: scheduledAt.toISOString(),
      location_type: link.location_type,
      location_details: link.custom_location,
      meeting_url: meetingUrl,
      client_message: clientMessage || null,
      status: "confirmed",
    })
    .select("id, reschedule_token, meeting_url")
    .single();

  if (insertError || !booking) {
    const overlap =
      insertError?.code === "23514" ||
      insertError?.message?.includes("time slot was just booked");
    if (!overlap) {
      console.error("Public booking insert failed", insertError?.message);
    }
    return json(
      { error: overlap ? "slot_unavailable" : "booking_temporarily_unavailable" },
      overlap ? 409 : 503,
    );
  }

  const locationDisplay = booking.meeting_url || locationLabelFor(link);
  const when = scheduledAt.toLocaleString("en-GB", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: clientTimeZone,
    timeZoneName: "short",
  });
  const rescheduleUrl = booking.reschedule_token
    ? await resolvePublicUrl(
        admin,
        link.user_id,
        `/reschedule/${booking.reschedule_token}`,
        "portal",
      )
    : undefined;
  const ics = buildIcs({
    uid: booking.id,
    title: link.name,
    description: link.description || clientMessage || "",
    start: scheduledAt,
    durationMinutes: link.duration_minutes,
    location: locationLabelFor(link),
    url: booking.meeting_url || undefined,
    attendeeName: clientName,
    attendeeEmail: clientEmail,
  });

  await Promise.all([
    invokeInternalFunction(
      supabaseUrl,
      serviceKey,
      "notify-booking-host",
      { booking_id: booking.id },
    ),
    invokeInternalFunction(supabaseUrl, serviceKey, "send-email", {
      templateName: "booking-confirmation",
      recipientEmail: clientEmail,
      userId: link.user_id,
      idempotencyKey: `booking-${booking.id}`,
      data: {
        name: clientName,
        title: link.name,
        when,
        location: locationDisplay,
        meeting_url: booking.meeting_url || undefined,
        reschedule_url: rescheduleUrl,
      },
      attachments: [
        {
          filename: "invite.ics",
          content: icsToBase64(ics),
          content_type: "text/calendar",
        },
      ],
    }),
  ]);

  return json({
    bookingId: booking.id,
    rescheduleToken: booking.reschedule_token,
    meetingUrl: booking.meeting_url,
  });
});
