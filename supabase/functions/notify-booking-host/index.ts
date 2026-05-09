// Sends a meeting notification + .ics invite to the host (logged-in user)
// of a booking. Looks up the host's email from auth.users via service role,
// so this can be invoked from public (anon) booking flows safely without
// leaking the host email back to the client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function fmtIcs(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildIcs(opts: {
  uid: string;
  title: string;
  description?: string;
  start: Date;
  durationMinutes: number;
  location?: string;
  url?: string;
  organizerEmail?: string;
  attendeeName?: string;
  attendeeEmail?: string;
}): string {
  const end = new Date(opts.start.getTime() + opts.durationMinutes * 60000);
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const descParts = [opts.url ? `Join: ${opts.url}` : "", opts.description || ""].filter(Boolean);
  const lines = [
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
    `SUMMARY:${esc(opts.title)}`,
    descParts.length ? `DESCRIPTION:${esc(descParts.join("\n\n"))}` : "",
    (opts.url || opts.location) ? `LOCATION:${esc(opts.url || opts.location || "")}` : "",
    opts.url ? `URL:${opts.url}` : "",
    opts.organizerEmail ? `ORGANIZER:mailto:${opts.organizerEmail}` : "",
    opts.attendeeEmail
      ? `ATTENDEE;CN=${esc(opts.attendeeName || "Attendee")};RSVP=TRUE:mailto:${opts.attendeeEmail}`
      : "",
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

function icsToBase64(ics: string): string {
  return btoa(unescape(encodeURIComponent(ics)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { booking_id } = await req.json();
    if (!booking_id || typeof booking_id !== "string") {
      return new Response(JSON.stringify({ error: "booking_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .maybeSingle();
    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: "booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up host email from auth.users
    const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(
      booking.user_id,
    );
    if (uErr || !userRes?.user?.email) {
      return new Response(JSON.stringify({ error: "host email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const hostEmail = userRes.user.email;

    const start = new Date(booking.scheduled_at);
    const whenStr = start.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const meetingUrl: string | null = booking.meeting_url || null;
    const locationDisplay = meetingUrl || booking.location_details || booking.location_type;

    const ics = buildIcs({
      uid: booking.id,
      title: `${booking.meeting_name} with ${booking.client_name}`,
      description: booking.client_message || "",
      start,
      durationMinutes: booking.duration_minutes,
      location: booking.location_details || booking.location_type,
      url: meetingUrl || undefined,
      organizerEmail: hostEmail,
      attendeeName: booking.client_name,
      attendeeEmail: booking.client_email,
    });

    // Invoke send-email function
    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateName: "booking-host-notification",
        recipientEmail: hostEmail,
        userId: booking.user_id,
        idempotencyKey: `booking-host-${booking.id}`,
        data: {
          title: booking.meeting_name,
          when: whenStr,
          client_name: booking.client_name,
          client_email: booking.client_email,
          location: locationDisplay,
          meeting_url: meetingUrl || undefined,
          client_message: booking.client_message || "",
        },
        attachments: [
          {
            filename: "invite.ics",
            content: icsToBase64(ics),
            content_type: "text/calendar",
          },
        ],
      }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      return new Response(JSON.stringify({ error: "send-email failed", detail: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, host_email: hostEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
