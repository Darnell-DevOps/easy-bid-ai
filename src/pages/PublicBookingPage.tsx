import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { sendEmail } from "@/lib/email";
import DynamicFavicon from "@/components/branding/DynamicFavicon";
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  Phone,
  Link as LinkIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  ArrowLeft,
  Globe,
} from "lucide-react";
import {
  buildSlotsForDate,
  formatTime,
  locationLabel,
  buildIcs,
  icsToBase64,
  resolveMeetingUrl,
  type BookingLinkRow,
} from "@/lib/bookings";

interface AvailabilitySettings {
  buffer_minutes: number;
  min_notice_hours: number;
}

function locationIcon(type: string, className = "w-4 h-4") {
  if (type === "phone") return <Phone className={className} />;
  if (type === "custom") return <LinkIcon className={className} />;
  return <Video className={className} />;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function PublicBookingPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const proposalId = params.get("proposal");
  const { toast } = useToast();

  const [link, setLink] = useState<BookingLinkRow | null>(null);
  const [hostName, setHostName] = useState<string>("");
  const [availability, setAvailability] = useState<AvailabilitySettings | null>(null);
  const [existing, setExisting] = useState<{ scheduled_at: string; duration_minutes: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [pendingSlot, setPendingSlot] = useState<Date | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ when: Date; meetingName: string } | null>(null);

  const tz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time",
    [],
  );

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const { data: linkData, error } = await supabase
        .from("booking_links")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !linkData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setLink(linkData as BookingLinkRow);

      const [availRes, bookingsRes] = await Promise.all([
        supabase
          .from("availability_settings")
          .select("buffer_minutes, min_notice_hours")
          .eq("user_id", linkData.user_id)
          .maybeSingle(),
        supabase
          .from("bookings")
          .select("scheduled_at, duration_minutes")
          .eq("user_id", linkData.user_id)
          .gte("scheduled_at", new Date().toISOString()),
      ]);
      if (availRes.data) setAvailability(availRes.data as AvailabilitySettings);
      setExisting(bookingsRes.data || []);
      setHostName("");
      setLoading(false);
    };
    load();
  }, [slug]);

  const slots = useMemo(() => {
    if (!link || !selectedDate) return [];
    return buildSlotsForDate(
      selectedDate,
      link,
      existing,
      availability?.buffer_minutes ?? 15,
      availability?.min_notice_hours ?? 0,
    );
  }, [link, selectedDate, existing, availability]);

  const monthDays = useMemo(() => {
    const first = startOfMonth(month);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isDateSelectable = (d: Date) => {
    if (!link) return false;
    if (d < today) return false;
    if (!link.available_days.includes(d.getDay())) return false;
    return true;
  };

  const submit = async () => {
    if (!link || !selectedSlot) return;
    if (!name.trim() || !email.trim()) {
      toast({ title: "Name and email required", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const bookingId = crypto.randomUUID();
    const meetingUrl = resolveMeetingUrl({
      locationType: link.location_type,
      customLocation: link.custom_location,
      linkMeetingUrl: link.meeting_url,
      bookingId,
    });
    const { data: inserted, error } = await supabase.from("bookings").insert({
      id: bookingId,
      user_id: link.user_id,
      booking_link_id: link.id,
      proposal_id: proposalId,
      client_name: name.trim().slice(0, 200),
      client_email: email.trim().slice(0, 200),
      meeting_name: link.name,
      duration_minutes: link.duration_minutes,
      scheduled_at: selectedSlot.toISOString(),
      location_type: link.location_type,
      location_details: link.custom_location,
      meeting_url: meetingUrl || null,
      client_message: message.trim().slice(0, 1000) || null,
      status: "confirmed",
    }).select("reschedule_token").maybeSingle();
    setSubmitting(false);
    if (error) {
      toast({ title: "Couldn't book", description: error.message, variant: "destructive" });
      return;
    }

    const rescheduleUrl = inserted?.reschedule_token
      ? `${window.location.origin}/reschedule/${inserted.reschedule_token}`
      : undefined;

    const locationDisplay = meetingUrl || locationLabel(link.location_type, link.custom_location);

    // Build .ics calendar invite for both parties
    const ics = buildIcs({
      uid: bookingId,
      title: link.name,
      description: link.description || message || "",
      start: selectedSlot,
      durationMinutes: link.duration_minutes,
      location: locationLabel(link.location_type, link.custom_location),
      url: meetingUrl || undefined,
      organizerName: hostName || "Host",
      attendeeName: name.trim(),
      attendeeEmail: email.trim(),
    });
    const icsAttachment = {
      filename: "invite.ics",
      content: icsToBase64(ics),
      content_type: "text/calendar",
    };

    void sendEmail({
      templateName: "booking-confirmation",
      recipientEmail: email.trim(),
      userId: link.user_id,
      idempotencyKey: `booking-${bookingId}`,
      attachments: [icsAttachment],
      data: {
        name: name.trim(),
        title: link.name,
        when: selectedSlot.toLocaleString(undefined, {
          weekday: "long", month: "long", day: "numeric",
          hour: "numeric", minute: "2-digit",
        }),
        location: locationDisplay,
        meeting_url: meetingUrl || undefined,
        reschedule_url: rescheduleUrl,
      },
    });

    // Notify the host (looks up host email server-side)
    void supabase.functions.invoke("notify-booking-host", {
      body: { booking_id: bookingId },
    });

    setConfirmed({ when: selectedSlot, meetingName: link.name });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Booking link not found</h1>
          <p className="text-muted-foreground text-sm">This link may be inactive or invalid.</p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Booking confirmed</h1>
            <p className="text-muted-foreground text-sm">
              A calendar invite has been emailed to you. We'll send a reminder 24 hours before.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 text-left space-y-2">
            <p className="text-sm font-semibold text-foreground">{confirmed.meetingName}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              {confirmed.when.toLocaleDateString(undefined, { dateStyle: "full" })}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {formatTime(confirmed.when)} ({link.duration_minutes} min)
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              {locationIcon(link.location_type)}
              {locationLabel(link.location_type, link.custom_location)}
            </p>
          </div>
          {proposalId && (
            <Button asChild variant="outline">
              <Link to={`/proposal/view/${proposalId}`}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to proposal
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const showBookingForm = !!selectedSlot;

  return (
    <div className="min-h-screen bg-background py-6 px-4">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-purple" />
          <span className="text-sm font-semibold text-foreground">CloseSync AI</span>
        </header>

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[300px_1fr_320px]">
            {/* Left brand panel */}
            <div className="p-6 lg:p-8 border-b md:border-b-0 md:border-r border-border bg-gradient-to-b from-card to-background/30">
              <div className="space-y-5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-accent/30 to-purple/30 border border-purple/20">
                  <Sparkles className="w-5 h-5 text-purple" />
                </div>
                {hostName && (
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    {hostName}
                  </p>
                )}
                <h1 className="text-2xl font-bold text-foreground leading-tight">
                  {link.name}
                </h1>
                {link.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {link.description}
                  </p>
                )}
                <div className="space-y-3 pt-2 text-sm">
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>{link.duration_minutes} minutes</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    {locationIcon(link.location_type)}
                    <span>{locationLabel(link.location_type, link.custom_location)}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Globe className="w-4 h-4 shrink-0" />
                    <span className="truncate">{tz}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div className={`p-6 lg:p-8 ${showBookingForm ? "hidden lg:block" : ""}`}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-foreground">Select a date & time</h2>
              </div>

              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  disabled={month <= startOfMonth(today)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium text-foreground">{monthLabel}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground text-center mb-1 font-medium uppercase tracking-wider">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                  <div key={i} className="py-1.5">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const selectable = isDateSelectable(d);
                  const selected = selectedDate && sameDay(d, selectedDate);
                  const isToday = sameDay(d, today);
                  return (
                    <button
                      key={i}
                      disabled={!selectable}
                      onClick={() => {
                        setSelectedDate(d);
                        setSelectedSlot(null);
                        setPendingSlot(null);
                      }}
                      className={`aspect-square rounded-full text-sm font-medium transition relative ${
                        selected
                          ? "bg-purple text-white shadow-md shadow-purple/30"
                          : selectable
                          ? "bg-purple/5 hover:bg-purple/15 text-foreground"
                          : "text-muted-foreground/30 cursor-not-allowed"
                      } ${isToday && !selected ? "ring-1 ring-purple/40" : ""}`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right slots / form panel */}
            <div className="p-6 lg:p-8 border-t lg:border-t-0 lg:border-l border-border bg-background/50">
              {!selectedDate ? (
                <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground py-8">
                  Pick a date to see available times.
                </div>
              ) : !showBookingForm ? (
                <>
                  <p className="text-sm font-semibold text-foreground mb-4">
                    {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                  {slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No times available on this day.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto pr-1">
                      {slots.map((s) => {
                        const isPending = pendingSlot && s.getTime() === pendingSlot.getTime();
                        if (isPending) {
                          return (
                            <div key={s.toISOString()} className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setPendingSlot(null)}
                                className="py-2.5 rounded-lg border border-border bg-foreground/90 text-sm font-semibold text-background"
                              >
                                {formatTime(s)}
                              </button>
                              <button
                                onClick={() => setSelectedSlot(s)}
                                className="py-2.5 rounded-lg bg-purple text-sm font-semibold text-white hover:bg-purple/90 transition"
                              >
                                Confirm
                              </button>
                            </div>
                          );
                        }
                        return (
                          <button
                            key={s.toISOString()}
                            onClick={() => setPendingSlot(s)}
                            className="py-2.5 rounded-lg border border-purple/30 bg-background text-sm font-semibold text-purple hover:border-purple hover:bg-purple/5 transition"
                          >
                            {formatTime(s)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Selected time</p>
                      <p className="text-sm font-semibold text-foreground">
                        {selectedSlot!.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {formatTime(selectedSlot!)}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedSlot(null); setPendingSlot(null); }}>
                      Change
                    </Button>
                  </div>
                  <div>
                    <Label>Your name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
                  </div>
                  <div>
                    <Label>Message (optional)</Label>
                    <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={3} />
                  </div>
                  <Button
                    onClick={submit}
                    disabled={submitting}
                    className="w-full gap-2 bg-gradient-to-r from-accent to-purple text-white"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm booking
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    A calendar invite (.ics) will be emailed to you instantly.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
