import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Gauge, Bot, Send, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Counts = {
  lead_email_received: number;
  lead_qualified: number;
  reply_drafted: number;
  reply_sent: number;
  proposal_created_from_lead: number;
};

const EMPTY: Counts = {
  lead_email_received: 0,
  lead_qualified: 0,
  reply_drafted: 0,
  reply_sent: 0,
  proposal_created_from_lead: 0,
};

export default function LeadFunnelMetrics() {
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("lead_activity")
        .select("type")
        .gte("created_at", since);
      const next: Counts = { ...EMPTY };
      for (const r of (data || []) as { type: keyof Counts }[]) {
        if (r.type in next) next[r.type] += 1;
      }
      setCounts(next);
      setLoading(false);
    })();
  }, []);

  const tiles = [
    { label: "New leads", value: counts.lead_email_received, icon: Mail, accent: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Qualified", value: counts.lead_qualified, icon: Gauge, accent: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Replies drafted", value: counts.reply_drafted, icon: Bot, accent: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Replies sent", value: counts.reply_sent, icon: Send, accent: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Proposals from leads", value: counts.proposal_created_from_lead, icon: FileText, accent: "text-accent", bg: "bg-accent/10" },
  ];

  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
            Lead Funnel
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Last 30 days</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {tiles.map((t) => (
          <Card key={t.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${t.bg} flex items-center justify-center mb-2`}>
                <t.icon className={`w-4 h-4 ${t.accent}`} />
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {loading ? "—" : t.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
