import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { billingCopy, billingMoney, billingMonthLabel, currentBillingMonth, type BillingItem, type MonthlyFee } from "@/lib/retainer-billing";
import type { Tables } from "@/integrations/supabase/types";

export type ReviewRetainer = Pick<Tables<"retainers">,
  "id" | "client_name" | "title" | "status" | "billing_interval" | "paddle_subscription_id" | "start_date" | "end_date">;

const groups = [
  { status: "pending", title: "Needs approval", empty: "No extras waiting for approval." },
  { status: "approved", title: "Ready to invoice", empty: "No base fees or approved extras to invoice." },
  { status: "invoiced", title: "Awaiting payment", empty: "No issued invoices awaiting payment." },
  { status: "paid", title: "Paid", empty: "No payments recorded for this month." },
] as const;

export type BillingReviewFocus = (typeof groups)[number]["status"];

export default function RetainerBillingReview({ retainers, focus }: { retainers: ReviewRetainer[]; focus?: BillingReviewFocus }) {
  const [month, setMonth] = useState(currentBillingMonth);
  const [items, setItems] = useState<BillingItem[]>([]);
  const [monthlyFees, setMonthlyFees] = useState<MonthlyFee[]>([]);
  const [loadedMonth, setLoadedMonth] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [invoiceId, setInvoiceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const clientNames = new Map(retainers.map((r) => [r.id, r.client_name]));

  useEffect(() => {
    let active = true;
    setLoadError(false);
    setLoadedMonth("");
    const date = `${month}-01`;
    // Carry forward outstanding lines for visibility, while exports remain scoped to the selected month.
    void Promise.all([supabase.from("retainer_billing_items")
      .select("id, retainer_id, billing_month, billing_due_date, kind, title, description, amount_cents, currency, status, decided_at, decided_by, invoiced_at, invoice_reference, paid_at, created_at")
      .or(`and(billing_month.eq.${date},status.in.(pending,approved,invoiced,paid)),and(billing_month.lt.${date},status.in.(pending,approved,invoiced))`)
      .order("billing_month", { ascending: true }).order("created_at", { ascending: true }),
      supabase.rpc("preview_retainer_billing_month", { _month: date }),
    ]).then(([lines, fees]) => {
        if (!active) return;
        if (lines.error || fees.error) setLoadError(true);
        else {
          setItems((lines.data || []).map((item) => ({ ...item, approval_token: null, expires_at: null })));
          setMonthlyFees(fees.data || []);
          setLoadedMonth(month);
        }
      }).catch(() => {
        if (active) setLoadError(true);
      });
    return () => { active = false; };
  }, [month, refresh]);

  const loaded = loadedMonth === month && !loadError;
  const monthItems = items.filter((item) => item.billing_month === `${month}-01`);
  const candidates = monthlyFees.filter((fee) => fee.preparation_state === "needs_preparation");
  const excludedFees = monthlyFees.filter((fee) => fee.preparation_state === "already_paid" || fee.preparation_state === "ends_before_due_date");
  const copyable = monthItems.some((item) => item.status === "approved");

  function upsert(item: BillingItem) {
    setItems((old) => old.some((row) => row.id === item.id)
      ? old.map((row) => row.id === item.id ? item : row) : [...old, item]);
  }

  async function prepareMonth() {
    if (busy || !loaded || candidates.length === 0) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const { data, error } = await supabase.rpc("prepare_retainer_billing_month", { _month: `${month}-01` });
      if (error || !data) {
        setError("Could not confirm monthly fee preparation. Refresh the review and retry; existing fees will not be duplicated.");
      } else {
        setNotice(data.prepared > 0
          ? `${data.prepared} monthly ${data.prepared === 1 ? "fee" : "fees"} prepared. Review the lines before invoicing.`
          : "Monthly fees are already prepared or no longer due. The review has been refreshed.");
      }
    } catch {
      setError("Could not confirm monthly fee preparation. Refresh the review and retry; existing fees will not be duplicated.");
    } finally {
      setBusy(false);
      setRefresh((n) => n + 1);
    }
  }

  async function record(item: BillingItem, action: "invoice" | "paid", reference?: string) {
    setBusy(true);
    setNotice("");
    setError("");
    const { data, error } = await supabase.rpc("update_retainer_billing_item", {
      _id: item.id, _action: action, ...(reference ? { _reference: reference } : {}),
    });
    setBusy(false);
    if (error || !data) {
      setRefresh((n) => n + 1);
      return setError("Could not record that update. Check the current status and try again.");
    }
    upsert(data);
    setInvoiceId("");
    setNotice(action === "invoice" ? "Invoice recorded." : "Payment recorded.");
  }

  async function copyLines() {
    setError("");
    try {
      await navigator.clipboard.writeText(billingCopy(monthItems, clientNames));
      setNotice("Ready-to-invoice lines copied for the selected month.");
    } catch {
      setError("Could not copy the billing lines. Check clipboard access and try again.");
    }
  }

  return (
    <section aria-labelledby="billing-review-title" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="billing-review-title" className="cs-text-h4">Billing review</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">Check what belongs on your invoices and record what has been paid.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="billing-review-month">Billing month</Label>
            <Input id="billing-review-month" type="month" value={month} disabled={busy} onChange={(e) => {
              if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) return;
              setMonth(e.target.value);
              setInvoiceId("");
              setError("");
              setNotice("");
            }} />
          </div>
          <Button variant="outline" disabled={busy} onClick={() => setRefresh((n) => n + 1)}>Refresh</Button>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {focus && <Button asChild variant="link" className="px-0"><Link to="/dashboard/retainers">Show all billing lines</Link></Button>}
      <p role="status" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>{notice}</p>
      {loadError ? (
        <p role="alert" className="text-sm text-destructive">Could not load this review. Use Refresh to try again.</p>
      ) : !loaded ? (
        <p role="status" className="text-sm text-muted-foreground">Loading billing review…</p>
      ) : !focus && items.length === 0 && monthlyFees.length === 0 ? (
        <p className="border-t pt-4 text-sm text-muted-foreground">
          {retainers.length ? "There’s nothing to review for this month." : "Add a monthly retainer to prepare your first billing review."}
        </p>
      ) : (
        <>
          {(!focus || focus === "approved") && monthlyFees.length > 0 && (
            <section aria-labelledby="monthly-fees-heading" className="space-y-4 border-y py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h3 id="monthly-fees-heading" className="text-sm font-semibold">Prepare monthly fees</h3>
                  <p className="max-w-prose text-sm text-muted-foreground">
                    {candidates.length > 0
                      ? `${candidates.length} monthly ${candidates.length === 1 ? "fee is" : "fees are"} due for preparation.`
                      : "No monthly fees need preparation for this month."}
                  </p>
                </div>
                {candidates.length > 0 && <Button disabled={busy} onClick={prepareMonth}>
                  {busy ? "Preparing fees…" : "Prepare monthly fees"}
                </Button>}
              </div>
              {candidates.length > 0 && <ul className="divide-y">
                {candidates.map((fee) => <li key={fee.retainer_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link to={`/dashboard/retainers/${fee.retainer_id}`} className="break-words text-sm font-medium hover:underline">{fee.client_name} · {fee.title}</Link>
                    <p className="text-xs text-muted-foreground">Scheduled {new Date(`${fee.billing_due_date}T12:00:00`).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{billingMoney(fee.amount_cents, fee.currency)}</span>
                </li>)}
              </ul>}
              {excludedFees.length > 0 && <details className="space-y-3">
                <summary className="cursor-pointer rounded-sm text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{excludedFees.length} {excludedFees.length === 1 ? "fee" : "fees"} excluded</summary>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {excludedFees.map((fee) => <li key={fee.retainer_id} className="break-words">
                    {fee.client_name} · {fee.title} — {fee.preparation_state === "already_paid" ? "A payment is already recorded for this month." : "The agreement ends before its billing day."}
                  </li>)}
                </ul>
              </details>}
              <p className="max-w-prose text-sm text-muted-foreground">Preparing fees adds review lines only. It does not send invoices or collect payments. Existing lines keep their recorded amounts.</p>
            </section>
          )}
          {groups.filter((group) => !focus || focus === group.status).map((group) => {
            const rows = items.filter((item) => item.status === group.status
              && (group.status !== "paid" || item.billing_month === `${month}-01`));
            return (
              <section key={group.status} aria-labelledby={`billing-${group.status}-heading`} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id={`billing-${group.status}-heading`} className="text-sm font-semibold">{group.title}</h3>
                  {group.status === "approved" && copyable && <Button size="sm" variant="outline" onClick={copyLines}>Copy this month’s lines</Button>}
                </div>
                {rows.length === 0 ? <p className="text-sm text-muted-foreground">{group.empty}</p> : (
                  <ul className="divide-y border-y">
                    {rows.map((item) => (
                      <li key={item.id} className="space-y-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <Link to={`/dashboard/retainers/${item.retainer_id}`} className="break-words text-sm font-medium hover:underline">
                              {clientNames.get(item.retainer_id) || "Retainer"} · {item.title}
                            </Link>
                            <p className="break-words text-xs text-muted-foreground">
                              {item.billing_due_date && item.status === "approved"
                                ? `Scheduled ${new Date(`${item.billing_due_date}T12:00:00`).toLocaleDateString()}`
                                : billingMonthLabel(item.billing_month)}
                              {item.invoice_reference && ` · Invoice ${item.invoice_reference}`}
                              {item.paid_at && ` · Recorded ${new Date(item.paid_at).toLocaleDateString()}`}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-medium tabular-nums">{billingMoney(item.amount_cents, item.currency)}</span>
                            {item.status === "approved" && invoiceId !== item.id && (
                              <Button variant="outline" size="sm" disabled={busy} onClick={() => setInvoiceId(item.id)}>Record invoice</Button>
                            )}
                            {item.status === "invoiced" && (
                              <Button variant="outline" size="sm" disabled={busy} onClick={() => record(item, "paid")}>Mark line paid</Button>
                            )}
                            {item.status === "pending" && <Button variant="outline" size="sm" asChild><Link to={`/dashboard/retainers/${item.retainer_id}`}>View approval</Link></Button>}
                          </div>
                        </div>
                        {invoiceId === item.id && item.status === "approved" && (
                          <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
                            event.preventDefault();
                            const reference = String(new FormData(event.currentTarget).get("reference")).trim();
                            if (reference) void record(item, "invoice", reference);
                            else setError("Enter the invoice reference from your billing tool.");
                          }}>
                            <div className="space-y-2">
                              <Label htmlFor={`invoice-reference-${item.id}`}>External invoice reference</Label>
                              <Input id={`invoice-reference-${item.id}`} name="reference" required maxLength={100} />
                            </div>
                            <Button type="submit" disabled={busy}>Save invoice</Button>
                            <Button type="button" variant="ghost" disabled={busy} onClick={() => setInvoiceId("")}>Cancel</Button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </>
      )}
    </section>
  );
}
