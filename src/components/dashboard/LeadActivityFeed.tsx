import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  Mail,
  Gauge,
  Bot,
  Send,
  ClipboardList,
  FileText,
  Ban,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LeadActivityType } from "@/lib/lead-activity";

interface Row {
  id: string;
  type: LeadActivityType;
  title: string;
  summary: string | null;
  client_id: string | null;
  proposal_id: string | null;
  created_at: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ICONS: Record<LeadActivityType, { icon: typeof Mail; accent: string }> = {
  lead_email_received: { icon: Mail, accent: "text-blue-500" },
  lead_qualified: { icon: Gauge, accent: "text-amber-500" },
  reply_drafted: { icon: Bot, accent: "text-purple-500" },
  reply_sent: { icon: Send, accent: "text-emerald-500" },
  intake_form_sent: { icon: ClipboardList, accent: "text-cyan-500" },
  proposal_created_from_lead: { icon: FileText, accent: "text-accent" },
  lead_marked_not_a_lead: { icon: Ban, accent: "text-rose-500" },
};

export default function LeadActivityFeed({ limit = 8 }: { limit?: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("lead_activity")
        .select("id, type, title, summary, client_id, proposal_id, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      setRows((data || []) as Row[]);
      setLoading(false);
    })();
  }, [limit]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-xs text-muted-foreground">
          Loading activity…
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 px-4 text-center space-y-2">
          <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center mx-auto">
            <Inbox className="w-4 h-4 text-accent" />
          </div>
          <p className="text-sm font-semibold text-foreground">No lead activity yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            New emails, AI replies and proposal hand-offs will show up here as your lead pipeline runs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y divide-border">
        {rows.map((r) => {
          const meta = ICONS[r.type] || { icon: Mail, accent: "text-muted-foreground" };
          const Icon = meta.icon;
          const href = r.client_id
            ? `/dashboard/clients/${r.client_id}`
            : r.proposal_id
              ? `/dashboard/proposal/${r.proposal_id}`
              : "/dashboard/lead-assistant";
          return (
            <Link
              key={r.id}
              to={href}
              className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className={`w-4 h-4 ${meta.accent}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">{r.title}</p>
                {r.summary && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{r.summary}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0 mt-1">
                {timeAgo(r.created_at)}
              </span>
            </Link>
          );
        })}
        <Link
          to="/dashboard/lead-assistant"
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-accent hover:bg-muted/30 transition-colors"
        >
          Open Lead Assistant <ArrowRight className="w-3 h-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
