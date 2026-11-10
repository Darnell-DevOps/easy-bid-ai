import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageMeta from "@/components/PageMeta";
import { supabase } from "@/integrations/supabase/client";
import { billingMoney, billingMonthLabel } from "@/lib/retainer-billing";
import type { Database } from "@/integrations/supabase/types";

type Extra = Database["public"]["Functions"]["read_retainer_extra"]["Returns"][number];

export default function RetainerExtraApproval() {
  const token = useLocation().hash.slice(1);
  const [extra, setExtra] = useState<Extra | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setExtra(null);
    setError("");
    setUnavailable(false);
    if (!/^[a-f0-9]{64}$/.test(token)) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    void supabase.rpc("read_retainer_extra", { _token: token }).then(({ data, error }) => {
      if (!active) return;
      setLoading(false);
      if (error) setError("Could not load the request. Try again.");
      else if (!data?.[0]) setUnavailable(true);
      else setExtra(data[0]);
    });
    return () => { active = false; };
  }, [token, refresh]);

  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const decision = submitted?.value;
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    if (!name || (decision !== "approved" && decision !== "declined")) {
      setError("Enter your name and choose Approve or Decline.");
      return;
    }
    setWorking(true);
    setError("");
    const { data, error } = await supabase.rpc("decide_retainer_extra", {
      _token: token, _decision: decision, _name: name,
    });
    setWorking(false);
    if (error || !data) return setError("Could not record your decision. Refresh the request and try again.");
    setExtra((current) => current ? { ...current, status: data } : current);
  }

  return (
    <>
      <PageMeta title="Review extra work | CloseSync" description="Review a priced request from your service provider." path="/approve-extra" noIndex />
      <Helmet><meta name="referrer" content="no-referrer" /></Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b">
          <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-4 sm:px-6">
            <img src="/closesync-mark.png" alt="" width="28" height="28" />
            <span className="font-semibold">CloseSync</span>
          </div>
        </header>
        <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
          <h1 className="cs-text-h2">Review extra work</h1>
          {loading && <p role="status" className="text-sm text-muted-foreground">Loading request…</p>}
          {unavailable && <p role="alert" className="text-sm">This approval link is unavailable or has expired. Ask your service provider for a new link.</p>}
          {extra && (
            <>
              <section aria-labelledby="extra-review-title" className="space-y-4 border-y py-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="extra-review-title" className="cs-text-h4 break-words">{extra.title}</h2>
                    <p className="mt-1 break-words text-sm text-muted-foreground">{extra.retainer_title}</p>
                  </div>
                  <p className="cs-text-h4 tabular-nums">{billingMoney(extra.amount_cents, extra.currency)}</p>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{extra.description}</p>
                <p className="text-sm text-muted-foreground">Billing month: {billingMonthLabel(extra.billing_month)}</p>
              </section>
              {extra.status === "pending" ? (
                <form onSubmit={decide} className="space-y-4">
                  <p className="text-sm text-muted-foreground">Approving confirms this one-off price. Your service provider will invoice you separately.</p>
                  <div className="max-w-sm space-y-2">
                    <Label htmlFor="approval-name">Your name</Label>
                    <Input id="approval-name" name="name" autoComplete="name" required maxLength={100} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" value="approved" disabled={working}>Approve extra</Button>
                    <Button type="submit" value="declined" disabled={working} variant="outline">Decline</Button>
                  </div>
                </form>
              ) : (
                <p role="status" className="text-sm font-medium">
                  {extra.status === "approved" ? "Extra approved. Your service provider can now add it to the invoice." : "Extra declined."}
                </p>
              )}
            </>
          )}
          {error && <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setRefresh((n) => n + 1)}>Refresh request</Button></div>}
        </main>
      </div>
    </>
  );
}
