import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, ArrowRight, Send, Eye, CheckCircle2, Banknote } from "lucide-react";
import { formatTime, relativeDateLabel, type BookingRow } from "@/lib/bookings";

interface ProposalLite {
  id: string;
  client_name: string;
  status?: string | null;
  client_paid?: boolean;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  paid_at?: string | null;
}

interface Props {
  proposals: ProposalLite[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86400000);
  return `${days}d ago`;
}

export default function UpcomingAndRecent({ proposals }: Props) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .gte("scheduled_at", new Date().toISOString())
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true })
        .limit(2);
      setBookings((data as BookingRow[]) || []);
    })();
  }, []);

  const activities = (() => {
    const events: { id: string; iso: string; icon: any; text: string; tone: string; href: string }[] = [];
    for (const p of proposals) {
      if (p.paid_at)
        events.push({
          id: `paid-${p.id}`,
          iso: p.paid_at,
          icon: Banknote,
          text: `${p.client_name} paid`,
          tone: "text-emerald-400",
          href: `/dashboard/proposal/${p.id}`,
        });
      if (p.accepted_at)
        events.push({
          id: `acc-${p.id}`,
          iso: p.accepted_at,
          icon: CheckCircle2,
          text: `${p.client_name} accepted proposal`,
          tone: "text-emerald-400",
          href: `/dashboard/proposal/${p.id}`,
        });
      if (p.viewed_at)
        events.push({
          id: `v-${p.id}`,
          iso: p.viewed_at,
          icon: Eye,
          text: `${p.client_name} viewed proposal`,
          tone: "text-amber-400",
          href: `/dashboard/proposal/${p.id}`,
        });
      if (p.sent_at)
        events.push({
          id: `s-${p.id}`,
          iso: p.sent_at,
          icon: Send,
          text: `Proposal sent to ${p.client_name}`,
          tone: "text-blue-400",
          href: `/dashboard/proposal/${p.id}`,
        });
    }
    return events.sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime()).slice(0, 3);
  })();

  if (bookings.length === 0 && activities.length === 0) return null;

  const showBookings = bookings.length > 0;
  const showActivity = activities.length > 0;
  const gridCols = showBookings && showActivity ? "md:grid-cols-2" : "md:grid-cols-1";

  return (
    <section aria-labelledby="upcoming-heading" className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 id="upcoming-heading" className="text-lg font-semibold text-foreground">
            {showBookings && showActivity ? "Upcoming & recent" : showBookings ? "Upcoming" : "Recent activity"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Your next meetings and latest client moves.</p>
        </div>
      </div>
      <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
        {showBookings && (
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Upcoming</p>
                <Link
                  to="/dashboard/calendar"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  Calendar <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <ul className="divide-y divide-border/60">
                {bookings.map((b) => (
                  <li key={b.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple/15 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-purple" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {b.meeting_name} · {b.client_name}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {relativeDateLabel(b.scheduled_at)} at {formatTime(b.scheduled_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {showActivity && (
          <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Recent activity</p>
              <Link
                to="/dashboard/proposals"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {activities.length === 0 ? (
              <div className="px-4 py-6 text-xs text-muted-foreground">Nothing recent yet.</div>
            ) : (
              <ul className="divide-y divide-border/60">
                {activities.map((e) => {
                  const Icon = e.icon;
                  return (
                    <li key={e.id}>
                      <Link
                        to={e.href}
                        className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${e.tone}`} />
                        <span className="text-sm text-foreground flex-1 truncate">{e.text}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(e.iso)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
