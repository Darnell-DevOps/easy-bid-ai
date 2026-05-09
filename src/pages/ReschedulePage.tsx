import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
  Globe,
} from "lucide-react";
import {
  buildSlotsForDate,
  formatTime,
  locationLabel,
  buildIcs,
  icsToBase64,
} from "@/lib/bookings";
import { sendEmail } from "@/lib/email";

interface RescheduleData {
  booking: {
    id: string;
    client_name: string;
    client_email: string;
    meeting_name: string;
    duration_minutes: number;
    scheduled_at: string;
    location_type: string;
    location_details: string | null;
    status: string;
  };
  link: {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    available_days: number[];
    start_time: string;
    end_time: string;
    location_type: string;
    custom_location: string | null;
  } | null;
  availability: { buffer_minutes: number; min_notice_hours: number };
  busy: { scheduled_at: string; duration_minutes: number }[];
}

function locationIcon(type: string, className = "w-4 h-4") {
  if (type === "phone") return <Phone className={className} />;
  if (type === "custom") return <LinkIcon className={className} />;
  return <Video className={className} />;
}

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function ReschedulePage() {
  const { token } = useParams();
  const { toast } = useToast();
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time", []);

  const [data, setData] = useState<RescheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [pendingSlot, setPendingSlot] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ when: Date } | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data: res, error } = await supabase.rpc("booking_reschedule_get", { _token: token });
      if (error || !res) {
        setError("This reschedule link is invalid or expired.");
        setLoading(false);
        return;
      }
      setData(res as unknown as RescheduleData);
      setLoading(false);
    })();
  }, [token]);

  // Fallback link spec (when booking has no booking_link_id, e.g., manually created)
  const linkSpec = useMemo(() => {
    if (!data) return null;
    if (data.link) return data.link;
    return {
      id: "",
      name: data.booking.meeting_name,
      description: null,
      duration_minutes: data.booking.duration_minutes,
      available_days: [1, 2, 3, 4, 5],
      start_time: "09:00",
      end_time: "17:00",
      location_type: data.booking.location_type,
      custom_location: data.booking.location_details,
    };
  }, [data]);

  const slots = useMemo(() => {
    if (!linkSpec || !selectedDate || !data) return [];
    return buildSlotsForDate(
      selectedDate,
      linkSpec,
      data.busy,
      data.availability.buffer_minutes,
      data.availability.min_notice_hours,
    );
  }, [linkSpec, selectedDate, data]);

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
    if (!linkSpec) return false;
    if (d < today) return false;
    if (!linkSpec.available_days.includes(d.getDay())) return false;
    return true;
  };

  const confirm = async () => {
    if (!pendingSlot || !token || !data) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("booking_reschedule", {
      _token: token,
      _new_at: pendingSlot.toISOString(),
    });
    setSubmitting(false);
    if (error) {
      const msg = error.message?.includes("slot_taken")
        ? "That time was just taken. Please pick another."
        : "Couldn't reschedule — please try another time.";
      toast({ title: msg, variant: "destructive" });
      return;
    }

    // Send updated calendar invite
    const ics = buildIcs({
      uid: data.booking.id,
      title: data.booking.meeting_name,
      start: pendingSlot,
      durationMinutes: data.booking.duration_minutes,
      location: locationLabel(data.booking.location_type, data.booking.location_details || undefined),
      attendeeName: data.booking.client_name,
      attendeeEmail: data.booking.client_email,
    });
    void sendEmail({
      templateName: "booking-confirmation",
      recipientEmail: data.booking.client_email,
      idempotencyKey: `booking-reschedule-${data.booking.id}-${pendingSlot.getTime()}`,
      attachments: [{ filename: "invite.ics", content: icsToBase64(ics), content_type: "text/calendar" }],
      data: {
        name: data.booking.client_name,
        title: data.booking.meeting_name,
        when: pendingSlot.toLocaleString(undefined, {
          weekday: "long", month: "long", day: "numeric",
          hour: "numeric", minute: "2-digit",
        }),
        location: locationLabel(data.booking.location_type, data.booking.location_details || undefined),
        url: `${window.location.origin}/reschedule/${token}`,
      },
    });

    setDone({ when: pendingSlot });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data || !linkSpec) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Link unavailable</h1>
          <p className="text-muted-foreground text-sm">{error || "This reschedule link is no longer valid."}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Booking moved</h1>
            <p className="text-muted-foreground text-sm">
              An updated calendar invite is on its way to your inbox.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 text-left space-y-2">
            <p className="text-sm font-semibold text-foreground">{data.booking.meeting_name}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              {done.when.toLocaleDateString(undefined, { dateStyle: "full" })}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {formatTime(done.when)} ({data.booking.duration_minutes} min)
            </p>
          </div>
        </div>
      </div>
    );
  }

  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const currentWhen = new Date(data.booking.scheduled_at);

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
                  <CalendarIcon className="w-5 h-5 text-purple" />
                </div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Reschedule
                </p>
                <h1 className="text-2xl font-bold text-foreground leading-tight">
                  {data.booking.meeting_name}
                </h1>
                <div className="rounded-lg border border-border bg-background/50 p-3 space-y-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Currently booked</p>
                  <p className="text-sm font-semibold text-foreground">
                    {currentWhen.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatTime(currentWhen)}</p>
                </div>
                <div className="space-y-3 pt-2 text-sm">
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>{data.booking.duration_minutes} minutes</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    {locationIcon(data.booking.location_type)}
                    <span>{locationLabel(data.booking.location_type, data.booking.location_details || undefined)}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Globe className="w-4 h-4 shrink-0" />
                    <span className="truncate">{tz}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div className="p-6 lg:p-8">
              <h2 className="text-base font-semibold text-foreground mb-5">Pick a new date & time</h2>

              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  disabled={month <= startOfMonth(today)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium text-foreground">{monthLabel}</span>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground text-center mb-1 font-medium uppercase tracking-wider">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => (
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
                      onClick={() => { setSelectedDate(d); setPendingSlot(null); }}
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

            {/* Slots */}
            <div className="p-6 lg:p-8 border-t lg:border-t-0 lg:border-l border-border bg-background/50">
              {!selectedDate ? (
                <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground py-8">
                  Pick a date to see available times.
                </div>
              ) : (
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
                                onClick={confirm}
                                disabled={submitting}
                                className="py-2.5 rounded-lg bg-purple text-sm font-semibold text-white hover:bg-purple/90 transition flex items-center justify-center gap-2"
                              >
                                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
