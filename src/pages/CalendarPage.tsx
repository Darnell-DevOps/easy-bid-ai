import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
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
  User,
} from "lucide-react";
import {
  DAY_NAMES,
  LOCATION_TYPES,
  generateSlug,
  locationLabel,
  formatTime,
  relativeDateLabel,
  type BookingLinkRow,
  type BookingRow,
} from "@/lib/bookings";

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

export default function CalendarPage() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [links, setLinks] = useState<BookingLinkRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [availOpen, setAvailOpen] = useState(false);

  // Form state for new link
  const [form, setForm] = useState({
    name: "Discovery Call",
    description: "",
    duration_minutes: 30,
    location_type: "google_meet",
    custom_location: "",
    available_days: [1, 2, 3, 4, 5],
    start_time: "09:00",
    end_time: "17:00",
  });

  // Availability form
  const [availForm, setAvailForm] = useState(DEFAULT_AVAILABILITY);

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

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
    setForm({
      name: "Discovery Call",
      description: "",
      duration_minutes: 30,
      location_type: "google_meet",
      custom_location: "",
      available_days: [1, 2, 3, 4, 5],
      start_time: "09:00",
      end_time: "17:00",
    });
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

  const upcoming = bookings.filter((b) => new Date(b.scheduled_at) >= new Date());
  const past = bookings.filter((b) => new Date(b.scheduled_at) < new Date());

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
              Share booking links so clients can schedule calls with you in seconds.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAvailOpen(true)} className="gap-2">
              <SettingsIcon className="w-4 h-4" /> Availability
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-gradient-to-r from-accent to-purple text-white">
              <Plus className="w-4 h-4" /> New booking link
            </Button>
          </div>
        </div>

        {/* Upcoming bookings */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Upcoming bookings</h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : upcoming.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No upcoming bookings yet. Share a booking link to get your first one.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {upcoming.map((b) => (
                  <div key={b.id} className="py-3 flex items-start justify-between gap-3">
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
                  </div>
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
                      <Button size="sm" asChild variant="ghost" className="text-xs">
                        <Link to={`/book/${link.slug}`} target="_blank">Preview</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past bookings */}
        {past.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Past bookings</h2>
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
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
