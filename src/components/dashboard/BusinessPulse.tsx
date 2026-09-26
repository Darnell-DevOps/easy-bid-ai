import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Wallet, TrendingUp, Clock3, Repeat2 } from "lucide-react";
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
        .select("amount_cents, billing_interval, custom_interval_days, status")
        .is("deleted_at", null);
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
      { icon: Wallet, detail: "Paid proposals", label: "Revenue", value: fmt(revenue), href: "/dashboard/revenue" },
      { icon: TrendingUp, detail: "Sent & viewed proposals", label: "Pipeline", value: fmt(pipeline), href: "/dashboard/proposals" },
      { icon: Clock3, detail: "Accepted, awaiting payment", label: "Outstanding", value: fmt(outstanding), href: "/dashboard/proposals" },
      { icon: Repeat2, detail: "Monthly recurring revenue", label: "MRR", value: fmt(mrr), href: "/dashboard/retainers" },
    ];
  }, [proposals, mrr]);

  return (
    <section aria-labelledby="pulse-heading" className="space-y-3">
      <div className="sr-only">
        <h2 id="pulse-heading" className="text-xl font-semibold text-foreground">
          Business pulse
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Where the money is right now.</p>
      </div>
      <div className="cs-pulse-strip">
        <div className="cs-pulse-grid">
          {stats.map((s) => (
            <button
              key={s.label}
              aria-label={s.label + " " + s.value}
              onClick={() => navigate(s.href)}
              className="cs-pulse-stat"
            >
              <span className="cs-pulse-icon"><s.icon aria-hidden="true" /></span>
              <span className="cs-pulse-label">
                {s.label}
              </span>
              <span className="cs-pulse-value">
                {s.value}
              </span>
              <span className="cs-pulse-detail">{s.detail}</span>
              <ArrowUpRight aria-hidden="true" className="cs-pulse-arrow" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
