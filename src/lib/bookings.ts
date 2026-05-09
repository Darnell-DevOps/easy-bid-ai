export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const LOCATION_TYPES = [
  { value: "google_meet", label: "Google Meet" },
  { value: "zoom", label: "Zoom" },
  { value: "phone", label: "Phone call" },
  { value: "custom", label: "Custom link" },
] as const;

export function locationLabel(type: string, custom?: string | null): string {
  const found = LOCATION_TYPES.find((l) => l.value === type);
  if (type === "custom" && custom) return custom;
  return found?.label || type;
}

export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${base || "meeting"}-${rand}`;
}

export interface BookingLinkRow {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  location_type: string;
  custom_location: string | null;
  available_days: number[];
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface BookingRow {
  id: string;
  user_id: string;
  booking_link_id: string | null;
  proposal_id: string | null;
  client_name: string;
  client_email: string;
  meeting_name: string;
  duration_minutes: number;
  scheduled_at: string;
  location_type: string;
  location_details: string | null;
  client_message: string | null;
  status: string;
  created_at: string;
}

/**
 * Build available time slots for a given date using:
 *  - link's working window + days
 *  - duration + buffer
 *  - existing bookings (to filter conflicts)
 *  - minimum notice
 */
export function buildSlotsForDate(
  date: Date,
  link: { duration_minutes: number; available_days: number[]; start_time: string; end_time: string },
  existing: { scheduled_at: string; duration_minutes: number }[],
  bufferMinutes = 15,
  minNoticeHours = 0,
): Date[] {
  const day = date.getDay();
  if (!link.available_days.includes(day)) return [];

  const [sH, sM] = link.start_time.split(":").map(Number);
  const [eH, eM] = link.end_time.split(":").map(Number);

  const start = new Date(date);
  start.setHours(sH, sM, 0, 0);
  const end = new Date(date);
  end.setHours(eH, eM, 0, 0);

  const minTime = new Date(Date.now() + minNoticeHours * 3600 * 1000);

  const slots: Date[] = [];
  const step = link.duration_minutes;
  let cursor = new Date(start);

  while (cursor.getTime() + link.duration_minutes * 60000 <= end.getTime()) {
    if (cursor.getTime() >= minTime.getTime()) {
      const slotEnd = new Date(cursor.getTime() + link.duration_minutes * 60000);
      const conflict = existing.some((b) => {
        const bs = new Date(b.scheduled_at).getTime();
        const be = bs + b.duration_minutes * 60000;
        return cursor.getTime() < be + bufferMinutes * 60000 && slotEnd.getTime() + bufferMinutes * 60000 > bs;
      });
      if (!conflict) slots.push(new Date(cursor));
    }
    cursor = new Date(cursor.getTime() + step * 60000);
  }
  return slots;
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function relativeDateLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return DAY_NAMES_FULL[d.getDay()];
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Build a minimal RFC 5545 .ics calendar invite for a single booking.
 * Returns the raw .ics text — base64-encode for email attachments.
 */
export function buildIcs(opts: {
  uid: string;
  title: string;
  description?: string;
  start: Date;
  durationMinutes: number;
  location?: string;
  organizerName?: string;
  organizerEmail?: string;
  attendeeName?: string;
  attendeeEmail?: string;
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(opts.start.getTime() + opts.durationMinutes * 60000);
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CloseSync AI//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@closesync.io`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(opts.start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(opts.title)}`,
    opts.description ? `DESCRIPTION:${esc(opts.description)}` : "",
    opts.location ? `LOCATION:${esc(opts.location)}` : "",
    opts.organizerEmail
      ? `ORGANIZER;CN=${esc(opts.organizerName || "Host")}:mailto:${opts.organizerEmail}`
      : "",
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

export function icsToBase64(ics: string): string {
  const bytes = new TextEncoder().encode(ics);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
