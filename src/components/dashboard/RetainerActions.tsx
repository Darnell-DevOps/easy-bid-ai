import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { currentBillingMonth } from "@/lib/retainer-billing";

const actions = [
  { status: "pending", label: "Needs approval", description: "Extras waiting for a client decision." },
  { status: "approved", label: "Ready to invoice", description: "Monthly fees and approved extras to add to an invoice." },
  { status: "invoiced", label: "Awaiting payment", description: "Issued invoice lines you haven’t marked paid." },
] as const;

export default function RetainerActions() {
  const [review, setReview] = useState<{ retainers: number; counts: number[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed(false);
    const month = `${currentBillingMonth()}-01`;
    void Promise.all([
      supabase.from("retainers").select("id", { count: "exact", head: true }).is("deleted_at", null),
      ...actions.map(({ status }) => supabase.from("retainer_billing_items")
        .select("id", { count: "exact", head: true }).eq("status", status).lte("billing_month", month)),
    ]).then(([retainers, ...items]) => {
      if (!active) return;
      if (retainers.error || items.some((item) => item.error)) setFailed(true);
      else setReview({ retainers: retainers.count ?? 0, counts: items.map((item) => item.count ?? 0) });
    });
    return () => { active = false; };
  }, [retry]);

  const empty = review && review.retainers === 0 && review.counts.every((count) => count === 0);
  return (
    <section aria-labelledby="retainer-actions-heading" className="cs-dashboard-panel space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="retainer-actions-heading" className="cs-text-h4">Retainer billing</h2>
          <p className="mt-1 text-sm text-muted-foreground">See what needs attention before your next invoice run.</p>
        </div>
        {review && !empty && <Button asChild variant="outline"><Link to="/dashboard/retainers">Open billing review</Link></Button>}
      </div>
      {failed ? (
        <p role="alert" className="text-sm">Could not load retainer billing. <Button variant="link" onClick={() => setRetry((count) => count + 1)}>Try again</Button></p>
      ) : !review ? (
        <p role="status" className="text-sm text-muted-foreground">Loading billing actions…</p>
      ) : empty ? (
        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">Start with a monthly agreement you already manage. Add the agreed fee and scope, then track any extras.</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild><Link to="/dashboard/retainers/new"><Plus aria-hidden="true" /> Add an existing retainer</Link></Button>
            <Button asChild variant="outline"><Link to="/sample-billing-review">See a sample billing review</Link></Button>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {actions.map(({ status, label, description }, index) => (
            <li key={status}>
              <Link to={`/dashboard/retainers?focus=${status}`} className="flex items-center justify-between gap-4 rounded-sm px-2 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="min-w-0">
                  <strong className="block text-sm font-medium">{label}</strong>
                  <small className="block text-sm text-muted-foreground">{description}</small>
                </span>
                <span className="flex shrink-0 items-center gap-3 text-sm tabular-nums">{review.counts[index]} <ArrowUpRight className="size-4" aria-hidden="true" /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
