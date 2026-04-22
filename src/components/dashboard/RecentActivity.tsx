import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Receipt, ArrowRight } from "lucide-react";

interface Proposal {
  id: string;
  client_name: string;
  created_at: string;
  proposal_content: string | null;
  invoice_content: string | null;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function RecentActivity({ proposals }: { proposals: Proposal[] }) {
  const activities = proposals.slice(0, 8).flatMap((p) => {
    const items = [
      { icon: FileText, text: `Proposal created for ${p.client_name}`, time: p.created_at, accent: "text-accent" },
    ];
    if (p.invoice_content) {
      items.push({ icon: Receipt, text: `Invoice generated for ${p.client_name}`, time: p.created_at, accent: "text-emerald-400" });
    }
    return items;
  }).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No recent activity yet. Create your first proposal to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y divide-border">
        {activities.map((a, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <a.icon className={`w-4 h-4 ${a.accent}`} />
            </div>
            <span className="text-sm text-foreground flex-1 truncate">{a.text}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(a.time)}</span>
          </div>
        ))}
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
