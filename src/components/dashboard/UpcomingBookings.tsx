import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { formatTime, relativeDateLabel, type BookingRow } from "@/lib/bookings";

export default function UpcomingBookings() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .gte("scheduled_at", new Date().toISOString())
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true })
        .limit(5);
      setBookings((data as BookingRow[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
          Upcoming Bookings
        </h2>
        <Link to="/dashboard/calendar" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          Calendar <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : bookings.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Let clients book themselves"
              description="Share your booking link and meetings will land here automatically — no back-and-forth on time zones."
              ctaLabel="Set up booking link"
              ctaHref="/dashboard/calendar"
              variant="inline"
              tone="purple"
            />
          ) : (
            <div className="space-y-2.5">
              {bookings.map((b) => (
                <div key={b.id} className="flex items-start gap-2.5 text-sm">
                  <div className="w-7 h-7 rounded-md bg-purple/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-purple" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {b.meeting_name} with {b.client_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {relativeDateLabel(b.scheduled_at)} at {formatTime(b.scheduled_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
