import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Eye, CheckCircle2, Banknote, XCircle, ArrowRight } from "lucide-react";

interface ProposalLite {
  id: string;
  client_name: string;
  status?: string | null;
  client_paid?: boolean;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  paid_at?: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 3600);
  // bug-safe: recompute hours properly
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86400000);
  return `${days}d ago`;
}

interface Event {
  id: string;
  proposalId: string;
  iso: string;
  icon: typeof Send;
  text: string;
  accent: string;
}

export default function DealActivity({ proposals }: { proposals: ProposalLite[] }) {
  const events: Event[] = [];
  for (const p of proposals) {
    if (p.paid_at) {
      events.push({
        id: `paid-${p.id}`,
        proposalId: p.id,
        iso: p.paid_at,
        icon: Banknote,
        text: `${p.client_name} paid`,
        accent: "text-emerald-500",
      });
    }
    if (p.accepted_at) {
      events.push({
        id: `accepted-${p.id}`,
        proposalId: p.id,
        iso: p.accepted_at,
        icon: CheckCircle2,
        text: `${p.client_name} accepted proposal`,
        accent: "text-emerald-500",
      });
    }
    if (p.rejected_at) {
      events.push({
        id: `rejected-${p.id}`,
        proposalId: p.id,
        iso: p.rejected_at,
        icon: XCircle,
        text: `${p.client_name} rejected proposal`,
        accent: "text-rose-500",
      });
    }
    if (p.viewed_at) {
      events.push({
        id: `viewed-${p.id}`,
        proposalId: p.id,
        iso: p.viewed_at,
        icon: Eye,
        text: `${p.client_name} viewed proposal`,
        accent: "text-amber-500",
      });
    }
    if (p.sent_at) {
      events.push({
        id: `sent-${p.id}`,
        proposalId: p.id,
        iso: p.sent_at,
        icon: Send,
        text: `Proposal sent to ${p.client_name}`,
        accent: "text-blue-500",
      });
    }
  }

  const sorted = events
    .sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime())
    .slice(0, 6);

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No deal activity yet. Send a proposal to start tracking momentum.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y divide-border">
        {sorted.map((e) => {
          const Icon = e.icon;
          return (
            <Link
              key={e.id}
              to={`/dashboard/proposal/${e.proposalId}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Icon className={`w-4 h-4 ${e.accent}`} />
              </div>
              <span className="text-sm text-foreground flex-1 truncate">{e.text}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(e.iso)}</span>
            </Link>
          );
        })}
        <Link
          to="/dashboard/proposals"
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-accent hover:bg-muted/30 transition-colors"
        >
          View all activity <ArrowRight className="w-3 h-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
