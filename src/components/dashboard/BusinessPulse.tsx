import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { monthlyEquivalentCents } from "@/lib/retainers";

interface ProposalLite {
  budget: string;
  status?: string | null;
  client_paid?: boolean;
}

interface Props {
  proposals: ProposalLite[];
}

function parseAmount(s?: string | null): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function fmt(n: number, currency = "£"): string {
  if (n >= 1000) return `${currency}${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${currency}${Math.round(n).toLocaleString()}`;
}

export default function BusinessPulse({ proposals }: Props) {
  const navigate = useNavigate();
  const [mrr, setMrr] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("retainers")
        .select("amount_cents, billing_interval, custom_interval_days, status");
      const cents = ((data as any[]) || [])
        .filter((r) => r.status === "active")
        .reduce(
          (acc, r) =>
            acc +
            monthlyEquivalentCents(r.amount_cents, r.billing_interval, r.custom_interval_days),
          0,
        );
      setMrr(cents / 100);
    })();
  }, []);

  const stats = useMemo(() => {
    const revenue = proposals
      .filter((p) => p.client_paid)
      .reduce((a, p) => a + parseAmount(p.budget), 0);
    const outstanding = proposals
      .filter((p) => (p.status || "").toLowerCase() === "accepted" && !p.client_paid)
      .reduce((a, p) => a + parseAmount(p.budget), 0);
    const pipeline = proposals
      .filter((p) => {
        const s = (p.status || "").toLowerCase();
        return (s === "sent" || s === "viewed") && !p.client_paid;
      })
      .reduce((a, p) => a + parseAmount(p.budget), 0);

    return [
      { label: "Revenue", value: fmt(revenue), tone: "text-emerald-400", href: "/dashboard/revenue" },
      { label: "Pipeline", value: fmt(pipeline), tone: "text-foreground", href: "/dashboard/proposals" },
      { label: "Outstanding", value: fmt(outstanding), tone: "text-amber-400", href: "/dashboard/proposals" },
      { label: "MRR", value: fmt(mrr), tone: "text-foreground", href: "/dashboard/retainers" },
    ];
  }, [proposals, mrr]);

  return (
    <section aria-labelledby="pulse-heading" className="space-y-3">
      <div>
        <h2 id="pulse-heading" className="text-lg font-semibold text-foreground">
          Business pulse
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Where the money is right now.</p>
      </div>
      <Card>
        <CardContent className="p-0 divide-y divide-border/60">
          {stats.map((s) => (
            <button
              key={s.label}
              onClick={() => navigate(s.href)}
              className="w-full flex items-baseline justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
            >
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {s.label}
              </span>
              <span className={`text-xl font-bold tabular-nums ${s.tone}`}>{s.value}</span>
            </button>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
