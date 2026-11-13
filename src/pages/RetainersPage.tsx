import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import RetainerBillingReview, { type ReviewRetainer } from "@/components/retainers/RetainerBillingReview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { billingMoney } from "@/lib/retainer-billing";
import { intervalLabel } from "@/lib/retainers";
import { Plus } from "lucide-react";

type Retainer = ReviewRetainer & {
  company_name: string | null;
  amount_cents: number;
  currency: string;
  custom_interval_days: number | null;
};

export default function RetainersPage() {
  const [params, setParams] = useSearchParams();
  const agreements = params.get("view") === "agreements";
  const focus = params.get("focus");
  const billingFocus = focus === "pending" || focus === "approved" || focus === "invoiced" ? focus : undefined;
  const [rows, setRows] = useState<Retainer[] | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    setError(false);
    void supabase.from("retainers")
      .select("id, client_name, company_name, title, amount_cents, currency, billing_interval, custom_interval_days, status, paddle_subscription_id, start_date, end_date")
      .is("deleted_at", null).order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(true);
        else setRows(data || []);
      });
    return () => { active = false; };
  }, [refresh]);

  const filtered = rows?.filter((r) =>
    `${r.client_name} ${r.company_name || ""} ${r.title}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="cs-workspace-page-title">Retainers</h1>
            <p>Keep each agreement, approved extra and invoice in view.</p>
          </div>
          <Button asChild><Link to="/dashboard/retainers/new"><Plus aria-hidden="true" /> Add retainer</Link></Button>
        </div>
        <nav aria-label="Retainers views" className="flex flex-wrap gap-2 border-b pb-3">
          <Button variant={agreements ? "ghost" : "secondary"} aria-current={agreements ? undefined : "page"} onClick={() => setParams({})}>Billing review</Button>
          <Button variant={agreements ? "secondary" : "ghost"} aria-current={agreements ? "page" : undefined} onClick={() => setParams({ view: "agreements" })}>Agreements</Button>
        </nav>
        {error ? (
          <p role="alert" className="text-sm">Could not load retainers. <Button variant="link" onClick={() => setRefresh((n) => n + 1)}>Try again</Button></p>
        ) : !rows ? (
          <p role="status" className="text-sm text-muted-foreground">Loading retainers…</p>
        ) : !agreements ? (
          <RetainerBillingReview retainers={rows} focus={billingFocus} />
        ) : (
          <section aria-labelledby="retainer-agreements-title" className="space-y-4">
            <h2 id="retainer-agreements-title" className="cs-text-h4">Agreements</h2>
            {rows.length > 0 && (
              <div className="max-w-sm space-y-2">
                <Label htmlFor="retainer-search">Find an agreement</Label>
                <Input id="retainer-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Client or retainer name" />
              </div>
            )}
            {!filtered?.length ? (
              <p className="text-sm text-muted-foreground">
                {rows.length ? "No matching agreements." : "Add an existing retainer to record its scope and approve extra work."}
              </p>
            ) : (
              <ul className="divide-y border-y">
                {filtered.map((r) => (
                  <li key={r.id}>
                    <Link to={`/dashboard/retainers/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-2 py-3 hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium">{r.client_name}</p>
                        <p className="break-words text-sm text-muted-foreground">{r.title}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm tabular-nums">{billingMoney(r.amount_cents, r.currency)} · {intervalLabel(r.billing_interval, r.custom_interval_days).toLowerCase()}</span>
                        <Badge variant="outline" className="capitalize">{r.status.replaceAll("_", " ")}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
