import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Plus,
  Clock,
  Video,
  Phone,
  Link as LinkIcon,
  Copy,
  Trash2,
  Settings as SettingsIcon,
  CheckCircle2,
  Mail,
  CalendarPlus,
  ExternalLink,
  X,
} from "lucide-react";
import {
  DAY_NAMES,
  LOCATION_TYPES,
  generateSlug,
  locationLabel,
  formatTime,
  relativeDateLabel,
  buildIcs,
  icsToBase64,
  resolveMeetingUrl,
  type BookingLinkRow,
  type BookingRow,
} from "@/lib/bookings";
import { sendEmail } from "@/lib/email";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DeadlinesPanel from "@/components/calendar/DeadlinesPanel";
import { useSearchParams } from "react-router-dom";

interface AvailabilityRow {
  id: string;
  user_id: string;
  working_days: number[];
  working_start: string;
  working_end: string;
  buffer_minutes: number;
  min_notice_hours: number;
  timezone: string;
}

const DEFAULT_AVAILABILITY = {
  working_days: [1, 2, 3, 4, 5],
  working_start: "09:00",
  working_end: "17:00",
  buffer_minutes: 15,
  min_notice_hours: 24,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
};

function locationIcon(type: string) {
  if (type === "phone") return <Phone className="w-3.5 h-3.5" />;
  if (type === "custom") return <LinkIcon className="w-3.5 h-3.5" />;
  return <Video className="w-3.5 h-3.5" />;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function CalendarPage() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [links, setLinks] = useState<BookingLinkRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [availOpen, setAvailOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [form, setForm] = useState({
    name: "Discovery Call",
    description: "",
    duration_minutes: 30,
    location_type: "google_meet",
    custom_location: "",
    meeting_url: "",
    available_days: [1, 2, 3, 4, 5],
    start_time: "09:00",
    end_time: "17:00",
  });

  const [availForm, setAvailForm] = useState(DEFAULT_AVAILABILITY);

  // Schedule manual meeting form
  const [scheduleForm, setScheduleForm] = useState({
    client_name: "",
    client_email: "",
    meeting_name: "Meeting",
    duration_minutes: 30,
    date: new Date().toISOString().slice(0, 10),
    time: "10:00",
    location_type: "google_meet",
    location_details: "",
    meeting_url: "",
    client_message: "",
    send_invite: true,
  });

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setUserEmail(user.email ?? null);

    const [linksRes, bookingsRes, availRes] = await Promise.all([
      supabase.from("booking_links").select("*").order("created_at", { ascending: false }),
      supabase.from("bookings").select("*").order("scheduled_at", { ascending: true }),
      supabase.from("availability_settings").select("*").maybeSingle(),
    ]);

    setLinks((linksRes.data as BookingLinkRow[]) || []);
    setBookings((bookingsRes.data as BookingRow[]) || []);
    if (availRes.data) {
      setAvailability(availRes.data as AvailabilityRow);
      setAvailForm({
        working_days: availRes.data.working_days,
        working_start: availRes.data.working_start,
        working_end: availRes.data.working_end,
        buffer_minutes: availRes.data.buffer_minutes,
        min_notice_hours: availRes.data.min_notice_hours,
        timezone: availRes.data.timezone,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const toggleDay = (target: "form" | "avail", d: number) => {
    if (target === "form") {
      setForm((f) => ({
        ...f,
        available_days: f.available_days.includes(d)
          ? f.available_days.filter((x) => x !== d)
          : [...f.available_days, d].sort(),
      }));
    } else {
      setAvailForm((f) => ({
        ...f,
        working_days: f.working_days.includes(d)
          ? f.working_days.filter((x) => x !== d)
          : [...f.working_days, d].sort(),
      }));
    }
  };

  const createLink = async () => {
    if (!userId) return;
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("booking_links").insert({
      user_id: userId,
      slug: generateSlug(form.name),
      name: form.name.trim(),
      description: form.description.trim() || null,
      duration_minutes: form.duration_minutes,
      location_type: form.location_type,
      custom_location: form.custom_location.trim() || null,
      meeting_url: form.meeting_url.trim() || null,
      available_days: form.available_days,
      start_time: form.start_time,
      end_time: form.end_time,
    });
    if (error) {
      toast({ title: "Couldn't create link", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Booking link created" });
    setCreateOpen(false);
    fetchAll();
  };

  const deleteLink = async (id: string) => {
    if (!confirm("Delete this booking link?")) return;
    const { error } = await supabase.from("booking_links").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  const cancelBooking = async (b: BookingRow) => {
    if (!confirm(`Cancel meeting with ${b.client_name}? They'll be notified by email.`)) return;
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", b.id);
    if (error) {
      toast({ title: "Couldn't cancel", description: error.message, variant: "destructive" });
      return;
    }

    // Notify the client
    if (b.client_email) {
      const scheduled = new Date(b.scheduled_at);
      const { data: { user } } = await supabase.auth.getUser();
      const hostName =
        (user?.user_metadata as any)?.full_name ||
        (user?.user_metadata as any)?.name ||
        user?.email ||
        undefined;
      void sendEmail({
        templateName: "booking-cancelled",
        recipientEmail: b.client_email,
        userId: b.user_id,
        idempotencyKey: `booking-cancelled-${b.id}`,
        replyTo: user?.email || undefined,
        data: {
          name: b.client_name,
          title: b.meeting_name,
          host_name: hostName,
          when: scheduled.toLocaleString(undefined, {
            weekday: "long", month: "long", day: "numeric",
            hour: "numeric", minute: "2-digit",
          }),
          reschedule_url: b.reschedule_token
            ? `${window.location.origin}/reschedule/${b.reschedule_token}`
            : undefined,
        },
      });
    }

    toast({ title: "Meeting cancelled", description: b.client_email ? "Client notified by email." : undefined });
    fetchAll();
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: url });
  };

  const saveAvailability = async () => {
    if (!userId) return;
    const payload = { user_id: userId, ...availForm };
    const { error } = availability
      ? await supabase.from("availability_settings").update(payload).eq("id", availability.id)
      : await supabase.from("availability_settings").insert(payload);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Availability saved" });
    setAvailOpen(false);
    fetchAll();
  };

  const scheduleMeeting = async () => {
    if (!userId) return;
    const f = scheduleForm;
    if (!f.client_name.trim()) {
      toast({ title: "Client name required", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.client_email.trim())) {
      toast({ title: "Valid client email required", variant: "destructive" });
      return;
    }
    const scheduled = new Date(`${f.date}T${f.time}:00`);
    if (Number.isNaN(scheduled.getTime())) {
      toast({ title: "Invalid date/time", variant: "destructive" });
      return;
    }

    const newBookingId = crypto.randomUUID();
    const meetingUrl = resolveMeetingUrl({
      locationType: f.location_type,
      customLocation: f.location_details,
      linkMeetingUrl: f.meeting_url,
      bookingId: newBookingId,
    });
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        id: newBookingId,
        user_id: userId,
        client_name: f.client_name.trim(),
        client_email: f.client_email.trim(),
        meeting_name: f.meeting_name.trim() || "Meeting",
        duration_minutes: f.duration_minutes,
        scheduled_at: scheduled.toISOString(),
        location_type: f.location_type,
        location_details: f.location_details.trim() || null,
        meeting_url: meetingUrl || null,
        client_message: f.client_message.trim() || null,
        status: "confirmed",
      })
      .select("*")
      .single();

    if (error) {
      toast({ title: "Couldn't schedule", description: error.message, variant: "destructive" });
      return;
    }

    const locationDisplay = meetingUrl || locationLabel(f.location_type, f.location_details);

    if (f.send_invite) {
      const ics = buildIcs({
        uid: (data as BookingRow).id,
        title: f.meeting_name || "Meeting",
        description: f.client_message || "",
        start: scheduled,
        durationMinutes: f.duration_minutes,
        location: locationLabel(f.location_type, f.location_details),
        url: meetingUrl || undefined,
        organizerEmail: userEmail || undefined,
        attendeeName: f.client_name,
        attendeeEmail: f.client_email,
      });
      await sendEmail({
        templateName: "booking-confirmation",
        recipientEmail: f.client_email,
        userId,
        data: {
          name: f.client_name,
          title: f.meeting_name,
          when: scheduled.toLocaleString(undefined, {
            weekday: "long", month: "long", day: "numeric",
            hour: "numeric", minute: "2-digit",
          }),
          location: locationDisplay,
          meeting_url: meetingUrl || undefined,
          reschedule_url: `${window.location.origin}/reschedule/${(data as any).reschedule_token}`,
        },
        attachments: [
          { filename: "invite.ics", content: icsToBase64(ics), content_type: "text/calendar" },
        ],
      });
    }

    // Always notify the host (you), even if client invite was disabled
    void supabase.functions.invoke("notify-booking-host", {
      body: { booking_id: (data as BookingRow).id },
    });

    toast({ title: "Meeting scheduled", description: "Calendar invite sent to your email." });
    setScheduleOpen(false);
    setScheduleForm({
      client_name: "",
      client_email: "",
      meeting_name: "Meeting",
      duration_minutes: 30,
      date: new Date().toISOString().slice(0, 10),
      time: "10:00",
      location_type: "google_meet",
      location_details: "",
      meeting_url: "",
      client_message: "",
      send_invite: true,
    });
    fetchAll();
  };

  const activeBookings = useMemo(
    () => bookings.filter((b) => b.status !== "cancelled"),
    [bookings],
  );

  const bookingDates = useMemo(() => {
    return activeBookings.map((b) => new Date(b.scheduled_at));
  }, [activeBookings]);

  const bookingsForSelected = useMemo(() => {
    return activeBookings
      .filter((b) => sameDay(new Date(b.scheduled_at), selectedDate))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [activeBookings, selectedDate]);

  const upcoming = activeBookings.filter((b) => new Date(b.scheduled_at) >= new Date());
  const past = bookings.filter((b) => new Date(b.scheduled_at) < new Date());

  const openScheduleForDate = (d: Date) => {
    setScheduleForm((s) => ({ ...s, date: d.toISOString().slice(0, 10) }));
    setScheduleOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-6 h-6 text-purple" />
              Calendar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Schedule meetings, view your month at a glance, and share booking links.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAvailOpen(true)} className="gap-2">
              <SettingsIcon className="w-4 h-4" /> Availability
            </Button>
            <Button variant="outline" onClick={() => setCreateOpen(true)} className="gap-2">
              <LinkIcon className="w-4 h-4" /> New booking link
            </Button>
            <Button onClick={() => setScheduleOpen(true)} className="gap-2 bg-gradient-to-r from-accent to-purple text-white">
              <CalendarPlus className="w-4 h-4" /> Schedule meeting
            </Button>
          </div>
        </div>

        {/* Calendar + day detail */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <CalendarUI
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                modifiers={{ hasBooking: bookingDates }}
                modifiersClassNames={{
                  hasBooking:
                    "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-purple",
                }}
                className="p-0"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {selectedDate.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {bookingsForSelected.length === 0
                      ? "No meetings scheduled"
                      : `${bookingsForSelected.length} meeting${bookingsForSelected.length > 1 ? "s" : ""}`}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openScheduleForDate(selectedDate)} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>

              {bookingsForSelected.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-border rounded-lg">
                  <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nothing on the books for this day.</p>
                  <Button size="sm" variant="ghost" onClick={() => openScheduleForDate(selectedDate)} className="mt-2 gap-1.5 text-xs">
                    <CalendarPlus className="w-3.5 h-3.5" /> Schedule a meeting
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {bookingsForSelected.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:border-purple/30 transition"
                    >
                      <div className="w-14 text-xs text-center flex-shrink-0">
                        <div className="font-semibold text-foreground">{formatTime(b.scheduled_at)}</div>
                        <div className="text-muted-foreground mt-0.5">{b.duration_minutes}m</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{b.meeting_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{b.client_name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {b.client_email}
                          </span>
                          <span className="flex items-center gap-1">
                            {locationIcon(b.location_type)}
                            {locationLabel(b.location_type, b.location_details)}
                          </span>
                        </div>
                        {b.client_message && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 italic line-clamp-2">"{b.client_message}"</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => cancelBooking(b)}
                        className="h-7 w-7 flex-shrink-0"
                        title="Cancel meeting"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming list */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Upcoming meetings</h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : upcoming.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No upcoming meetings. Schedule one or share a booking link.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {upcoming.slice(0, 10).map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedDate(new Date(b.scheduled_at))}
                    className="w-full py-3 flex items-start justify-between gap-3 text-left hover:bg-muted/30 -mx-2 px-2 rounded transition"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {b.meeting_name} with {b.client_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {relativeDateLabel(b.scheduled_at)} at {formatTime(b.scheduled_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          {locationIcon(b.location_type)}
                          {locationLabel(b.location_type, b.location_details)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {b.client_email}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {b.status}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking links */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Your booking links</h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : links.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">
                  No booking links yet. Create one for discovery calls, kickoffs, or reviews.
                </p>
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Create your first link
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {links.map((link) => (
                  <div key={link.id} className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{link.name}</p>
                        {link.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{link.description}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteLink(link.id)} className="h-7 w-7">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="w-3 h-3" /> {link.duration_minutes} min
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        {locationIcon(link.location_type)}
                        {locationLabel(link.location_type, link.custom_location)}
                      </Badge>
                      <Badge variant="secondary">
                        {link.available_days.map((d) => DAY_NAMES[d]).join(", ")}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyLink(link.slug)} className="flex-1 gap-1.5 text-xs">
                        <Copy className="w-3 h-3" /> Copy link
                      </Button>
                      <Button size="sm" asChild variant="ghost" className="text-xs gap-1">
                        <Link to={`/book/${link.slug}`} target="_blank">
                          <ExternalLink className="w-3 h-3" /> Preview
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {past.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Past meetings</h2>
              <div className="divide-y divide-border">
                {past.slice(0, 10).map((b) => (
                  <div key={b.id} className="py-2.5 flex items-center justify-between gap-3 opacity-70">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {b.meeting_name} with {b.client_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(b.scheduled_at).toLocaleDateString()} at {formatTime(b.scheduled_at)}
                      </p>
                    </div>
                    {b.status === "cancelled" && (
                      <Badge variant="outline" className="text-xs">cancelled</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Schedule meeting dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule a meeting</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Client name *</Label>
                <Input
                  value={scheduleForm.client_name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, client_name: e.target.value })}
                  placeholder="Jane Smith"
                  maxLength={100}
                />
              </div>
              <div>
                <Label>Client email *</Label>
                <Input
                  type="email"
                  value={scheduleForm.client_email}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, client_email: e.target.value })}
                  placeholder="jane@company.com"
                  maxLength={255}
                />
              </div>
            </div>
            <div>
              <Label>Meeting name</Label>
              <Input
                value={scheduleForm.meeting_name}
                onChange={(e) => setScheduleForm({ ...scheduleForm, meeting_name: e.target.value })}
                placeholder="Discovery Call"
                maxLength={100}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={scheduleForm.date}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={scheduleForm.time}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                />
              </div>
              <div>
                <Label>Duration</Label>
                <Select
                  value={String(scheduleForm.duration_minutes)}
                  onValueChange={(v) => setScheduleForm({ ...scheduleForm, duration_minutes: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60, 90, 120].map((m) => (
                      <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Location</Label>
                <Select
                  value={scheduleForm.location_type}
                  onValueChange={(v) => setScheduleForm({ ...scheduleForm, location_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Link / details</Label>
                <Input
                  value={scheduleForm.location_details}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, location_details: e.target.value })}
                  placeholder={scheduleForm.location_type === "phone" ? "+1 555 0100" : "https://..."}
                />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={scheduleForm.client_message}
                onChange={(e) => setScheduleForm({ ...scheduleForm, client_message: e.target.value })}
                placeholder="Agenda or context for the meeting"
                maxLength={1000}
                rows={2}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleForm.send_invite}
                onChange={(e) => setScheduleForm({ ...scheduleForm, send_invite: e.target.checked })}
                className="rounded border-border"
              />
              Send confirmation email with calendar invite (.ics) to the client
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button onClick={scheduleMeeting} className="gap-2 bg-gradient-to-r from-accent to-purple text-white">
              <CheckCircle2 className="w-4 h-4" /> Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Link dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New booking link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Meeting name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Discovery Call"
                maxLength={100}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="A quick chat to understand your goals."
                maxLength={500}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duration</Label>
                <Select
                  value={String(form.duration_minutes)}
                  onValueChange={(v) => setForm({ ...form, duration_minutes: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60, 90].map((m) => (
                      <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location</Label>
                <Select
                  value={form.location_type}
                  onValueChange={(v) => setForm({ ...form, location_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.location_type === "custom" && (
              <div>
                <Label>Custom link or location</Label>
                <Input
                  value={form.custom_location}
                  onChange={(e) => setForm({ ...form, custom_location: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            )}
            {form.location_type !== "phone" && form.location_type !== "custom" && (
              <div>
                <Label>Your meeting link <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  value={form.meeting_url}
                  onChange={(e) => setForm({ ...form, meeting_url: e.target.value })}
                  placeholder="https://meet.google.com/abc-defg-hij or your Zoom personal room"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Paste your Google Meet, Zoom, or Whereby link. If left blank, a free Jitsi Meet room is auto-generated for each booking.
                </p>
              </div>
            )}
            <div>
              <Label>Available days</Label>
              <div className="flex gap-1 mt-1.5">
                {DAY_NAMES.map((name, i) => {
                  const active = form.available_days.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay("form", i)}
                      className={`flex-1 py-2 rounded-md text-xs font-medium border transition ${
                        active
                          ? "bg-purple text-white border-purple"
                          : "bg-background border-border text-muted-foreground hover:border-purple/40"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Available from</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div>
                <Label>Available until</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createLink} className="gap-2">
              <CheckCircle2 className="w-4 h-4" /> Create link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Availability dialog */}
      <Dialog open={availOpen} onOpenChange={setAvailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Availability settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Working days</Label>
              <div className="flex gap-1 mt-1.5">
                {DAY_NAMES.map((name, i) => {
                  const active = availForm.working_days.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay("avail", i)}
                      className={`flex-1 py-2 rounded-md text-xs font-medium border transition ${
                        active
                          ? "bg-purple text-white border-purple"
                          : "bg-background border-border text-muted-foreground hover:border-purple/40"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Working start</Label>
                <Input type="time" value={availForm.working_start} onChange={(e) => setAvailForm({ ...availForm, working_start: e.target.value })} />
              </div>
              <div>
                <Label>Working end</Label>
                <Input type="time" value={availForm.working_end} onChange={(e) => setAvailForm({ ...availForm, working_end: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Buffer between meetings</Label>
                <Select
                  value={String(availForm.buffer_minutes)}
                  onValueChange={(v) => setAvailForm({ ...availForm, buffer_minutes: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 5, 10, 15, 30, 60].map((m) => (
                      <SelectItem key={m} value={String(m)}>{m === 0 ? "None" : `${m} minutes`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Minimum notice</Label>
                <Select
                  value={String(availForm.min_notice_hours)}
                  onValueChange={(v) => setAvailForm({ ...availForm, min_notice_hours: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 4, 12, 24, 48].map((h) => (
                      <SelectItem key={h} value={String(h)}>{h === 0 ? "None" : `${h}h`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              These defaults apply to all booking links. You can override hours and days per link.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAvailOpen(false)}>Cancel</Button>
            <Button onClick={saveAvailability}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
