import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Repeat, ArrowRight, AlertTriangle } from "lucide-react";
import {
  formatMoney,
  monthlyEquivalentCents,
  daysUntil,
  intervalLabel,
} from "@/lib/retainers";

interface Row {
  id: string;
  client_name: string;
  amount_cents: number;
  currency: string;
  billing_interval: string;
  custom_interval_days: number | null;
  status: string;
  next_billing_date: string | null;
  end_date: string | null;
  has_failed_payment: boolean;
}

export default function RetainersWidget() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("retainers")
        .select(
          "id, client_name, amount_cents, currency, billing_interval, custom_interval_days, status, next_billing_date, end_date, has_failed_payment",
        )
        .order("next_billing_date", { ascending: true, nullsFirst: false });
      setRows((data as Row[]) || []);
      setLoading(false);
    })();
  }, []);

  const active = rows.filter((r) => r.status === "active");
  const mrrCents = active.reduce(
    (acc, r) =>
      acc + monthlyEquivalentCents(r.amount_cents, r.billing_interval, r.custom_interval_days),
    0,
  );
  const mrrCurrency = active[0]?.currency || "USD";

  const failed = rows.filter((r) => r.has_failed_payment);
  const upcoming = active
    .filter((r) => r.next_billing_date)
    .slice(0, 3);
  const renewingSoon = active.filter((r) => {
    const d = daysUntil(r.end_date);
    return d !== null && d >= 0 && d <= 14;
  });

  return (
    <Card className="border-border/60">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <Repeat className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Retainers</p>
              <p className="text-[11px] text-muted-foreground">Recurring revenue</p>
            </div>
          </div>
          <Link
            to="/dashboard/retainers"
            className="text-xs text-accent hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/60 bg-card/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              MRR
            </p>
            <p className="text-lg font-bold text-foreground mt-1">
              {formatMoney(mrrCents, mrrCurrency)}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Active
            </p>
            <p className="text-lg font-bold text-foreground mt-1">{active.length}</p>
          </div>
        </div>

        {(failed.length > 0 || renewingSoon.length > 0) && (
          <Link
            to="/dashboard/recovery"
            className="block rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 hover:bg-amber-500/15 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-xs font-semibold text-amber-300">
                {failed.length > 0 && (
                  <>
                    {failed.length} failed payment{failed.length > 1 ? "s" : ""}
                  </>
                )}
                {failed.length > 0 && renewingSoon.length > 0 && " · "}
                {renewingSoon.length > 0 && (
                  <>
                    {renewingSoon.length} renewing soon
                  </>
                )}
              </p>
              <ArrowRight className="w-3 h-3 text-amber-300 ml-auto" />
            </div>
            <p className="text-[11px] text-amber-300/80 mt-1">
              Open the recovery queue to act on them.
            </p>
          </Link>
        )}

        {!loading && upcoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Upcoming charges
            </p>
            {upcoming.map((r) => (
              <Link
                key={r.id}
                to={`/dashboard/retainers/${r.id}`}
                className="flex items-center justify-between text-xs hover:bg-secondary/40 -mx-2 px-2 py-1.5 rounded"
              >
                <span className="text-foreground truncate">{r.client_name}</span>
                <span className="text-muted-foreground shrink-0 ml-2">
                  {formatMoney(r.amount_cents, r.currency)} ·{" "}
                  {r.next_billing_date
                    ? new Date(r.next_billing_date).toLocaleDateString()
                    : intervalLabel(r.billing_interval, r.custom_interval_days)}
                </span>
              </Link>
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No retainers yet.{" "}
            <Link to="/dashboard/retainers/new" className="text-accent hover:underline">
              Create one
            </Link>
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}

