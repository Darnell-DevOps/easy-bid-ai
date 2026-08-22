import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
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
      const { data: linkRows, error } = (await supabase.rpc(
        "public_get_booking_link_by_slug" as never,
        { _slug: slug } as never,
      )) as { data: any; error: any };
      const linkData = Array.isArray(linkRows) && linkRows.length > 0 ? linkRows[0] : null;

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
        supabase.rpc(
          "public_get_booking_link_busy" as never,
          { _slug: slug } as never,
        ) as unknown as Promise<{ data: any }>,
      ]);
      if (availRes.data) setAvailability(availRes.data as AvailabilitySettings);
      setExisting((bookingsRes.data as any) || []);
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
    const { data: created, error } = await supabase.functions.invoke("create-public-booking", {
      body: {
        slug,
        proposalId,
        clientName: name.trim().slice(0, 200),
        clientEmail: email.trim().slice(0, 200),
        clientMessage: message.trim().slice(0, 1000) || null,
        scheduledAt: selectedSlot.toISOString(),
        clientTimeZone: tz,
      },
    });
    setSubmitting(false);
    if (error || !created?.bookingId) {
      toast({
        title: "Couldn't book",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
      return;
    }
    setConfirmed({ when: selectedSlot, meetingName: link.name });
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background" aria-busy="true">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading booking page</span>
      </main>
    );
  }

  if (notFound || !link) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Booking link not found</h1>
          <p className="text-muted-foreground text-sm">This link may be inactive or invalid.</p>
        </div>
      </main>
    );
  }

  if (confirmed) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6 py-12" aria-live="polite">
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
      </main>
    );
  }

  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const showBookingForm = !!selectedSlot;

  return (
    <div className="min-h-screen bg-background py-6 px-4">
      <DynamicFavicon userId={link?.user_id} />
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-purple" />
          <span className="text-sm font-semibold text-foreground">CloseSync AI</span>
        </header>

        <main className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[300px_1fr_320px]">
            {/* Left brand panel */}
            <div className="p-6 lg:p-8 border-b md:border-b-0 md:border-r border-border bg-card">
              <div className="space-y-5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent/15 border border-accent/25">
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
                <h2 className="text-xl font-semibold text-foreground">Select a date & time</h2>
              </div>

              <div className="flex items-center justify-between mb-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Show previous month"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  disabled={month <= startOfMonth(today)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium text-foreground" aria-live="polite">{monthLabel}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Show next month"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground text-center mb-1 font-medium uppercase tracking-wider" aria-hidden="true">
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
                      type="button"
                      disabled={!selectable}
                      aria-label={d.toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      aria-pressed={!!selected}
                      aria-current={isToday ? "date" : undefined}
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
                                type="button"
                                onClick={() => setPendingSlot(null)}
                                aria-label={`Cancel ${formatTime(s)} selection`}
                                aria-pressed="true"
                                className="py-2.5 rounded-lg border border-border bg-foreground/90 text-sm font-semibold text-background"
                              >
                                {formatTime(s)}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedSlot(s)}
                                aria-label={`Confirm ${formatTime(s)} booking time`}
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
                            type="button"
                            onClick={() => setPendingSlot(s)}
                            aria-label={`Select ${formatTime(s)} booking time`}
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
                <form
                  className="space-y-4"
                  aria-labelledby="booking-details-heading"
                  aria-busy={submitting}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                  }}
                >
                  <h2 id="booking-details-heading" className="sr-only">Your booking details</h2>
                  <div className="flex items-center justify-between" aria-live="polite">
                    <div>
                      <p className="text-xs text-muted-foreground">Selected time</p>
                      <p className="text-sm font-semibold text-foreground">
                        {selectedSlot!.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {formatTime(selectedSlot!)}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedSlot(null); setPendingSlot(null); }}>
                      Change
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor="booking-name">Your name</Label>
                    <Input
                      id="booking-name"
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={200}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="booking-email">Email</Label>
                    <Input
                      id="booking-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={200}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="booking-message">Message (optional)</Label>
                    <Textarea
                      id="booking-message"
                      name="message"
                      autoComplete="off"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={1000}
                      rows={3}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full gap-2 bg-accent text-accent-foreground"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm booking
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    A calendar invite (.ics) will be emailed to you instantly.
                  </p>
                </form>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
