import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { approvalLink, billingMoney, billingMonthLabel, billingStatus, currentBillingMonth, type BillingItem } from "@/lib/retainer-billing";

interface Props {
  retainerId: string;
  currency: string;
  scope: string | null;
  agreementUrl: string | null;
  canCreate: boolean;
}

export default function RetainerExtras({ retainerId, currency, scope, agreementUrl, canCreate }: Props) {
  const [items, setItems] = useState<BillingItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState(false);
  const [agreement, setAgreement] = useState({ scope: scope || "", url: agreementUrl || "" });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "", amount: "", month: currentBillingMonth() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadError(false);
    void supabase.from("retainer_billing_items").select("*")
      .eq("retainer_id", retainerId).eq("kind", "extra").order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setLoadError(true);
        else setItems(data);
      });
    return () => { active = false; };
  }, [retainerId, refresh]);

  function replaceItem(item: BillingItem) {
    setItems((old) => [item, ...(old || []).filter((row) => row.id !== item.id)]);
  }

  async function saveScope(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const description = String(fields.get("scope")).trim();
    const url = String(fields.get("agreement")).trim();
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error();
      } catch {
        setError("Enter a secure agreement link starting with https://.");
        return;
      }
    }
    setBusy(true);
    setError("");
    setNotice("");
    const { data, error } = await supabase.from("retainers")
      .update({ description: description || null, agreement_url: url || null }).eq("id", retainerId)
      .select("id").maybeSingle();
    setBusy(false);
    if (error || !data) return setError("Could not save the agreement. Try again.");
    setAgreement({ scope: description, url });
    setEditing(false);
    setNotice("Agreement saved.");
  }

  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Math.round(Number(draft.amount) * 100);
    if (!draft.title.trim() || !draft.description.trim() || !Number.isSafeInteger(amount) || amount < 1) {
      setError("Enter a title, description and final price.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    requestId.current ??= crypto.randomUUID();
    const { data, error } = await supabase.rpc("prepare_retainer_billing_item", {
      _id: requestId.current, _retainer: retainerId, _month: `${draft.month}-01`,
      _kind: "extra", _title: draft.title, _description: draft.description, _amount: amount,
    });
    setBusy(false);
    if (error || !data) return setError("Could not create the link. Check that the month falls within the active agreement and try again.");
    replaceItem(data);
    requestId.current = null;
    setDraft({ title: "", description: "", amount: "", month: draft.month });
    setAdding(false);
    setNotice("Approval link created. Copy it and share it with your client.");
  }

  async function withdraw(id: string) {
    setBusy(true);
    setNotice("");
    setError("");
    const { data, error } = await supabase.rpc("update_retainer_billing_item", { _id: id, _action: "withdraw" });
    setBusy(false);
    if (error || !data) {
      setRefresh((n) => n + 1);
      return setError("Could not withdraw this link. Check its latest status.");
    }
    replaceItem(data);
    setNotice("Approval link withdrawn.");
  }

  async function copy(token: string) {
    setError("");
    try {
      await navigator.clipboard.writeText(approvalLink(token));
      setNotice("Approval link copied.");
    } catch {
      setError("Could not copy the link. Use Open approval to copy it from the address bar.");
    }
  }

  const hasScope = Boolean(agreement.scope || agreement.url);
  return (
    <div className="space-y-8">
      <section aria-labelledby="retainer-scope-title" className="space-y-3 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="retainer-scope-title" className="cs-text-h4">Agreed scope</h2>
          {!editing && <Button variant="outline" size="sm" onClick={() => { setEditing(true); setError(""); }}>{hasScope ? "Edit scope" : "Add scope"}</Button>}
        </div>
        {editing ? (
          <form onSubmit={saveScope} className="max-w-xl space-y-4">
            <div className="space-y-2">
              <Label htmlFor="billing-scope">Included work</Label>
              <Textarea id="billing-scope" name="scope" maxLength={4000} defaultValue={agreement.scope} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-agreement">Agreement link (optional)</Label>
              <Input id="billing-agreement" name="agreement" type="url" maxLength={2048} defaultValue={agreement.url} placeholder="https://" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>Save scope</Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => { setEditing(false); setError(""); }}>Cancel</Button>
            </div>
          </form>
        ) : (
          <>
            <p className="max-w-prose whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {agreement.scope || (agreement.url ? "Open the agreement to see what’s included." : "Record what the client agreed to before you price any extras.")}
            </p>
            {agreement.url.startsWith("https://") && (
              <a href={agreement.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline underline-offset-4">Open agreement</a>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="retainer-extras-title" className="space-y-4 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="retainer-extras-title" className="cs-text-h4">Extra work</h2>
            <p className="mt-1 text-sm text-muted-foreground">Get a price approved before it goes on the invoice.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {items?.some((item) => item.status === "pending") && <Button variant="outline" onClick={() => setRefresh((n) => n + 1)}>Refresh decisions</Button>}
            {canCreate && hasScope && !adding && <Button disabled={busy} onClick={() => { setAdding(true); setError(""); }}>Price an extra</Button>}
          </div>
        </div>
        {adding && (
          <form onSubmit={prepare} className="max-w-xl space-y-4 border-y py-4">
            <div className="space-y-2">
              <Label htmlFor="extra-title">Extra title</Label>
              <Input id="extra-title" maxLength={120} required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra-description">What the client gets</Label>
              <Textarea id="extra-description" maxLength={2000} required value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="extra-price">Final price ({currency})</Label>
                <Input id="extra-price" type="number" inputMode="decimal" min="0.01" max="9999999.99" step="0.01" required value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
                <p className="text-xs text-muted-foreground">Include any applicable tax.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="extra-month">Billing month</Label>
                <Input id="extra-month" type="month" required value={draft.month} onChange={(e) => setDraft({ ...draft, month: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>Create approval link</Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => { setAdding(false); setError(""); }}>Cancel</Button>
            </div>
          </form>
        )}
        {loadError ? <p role="alert" className="text-sm">Could not load extras. <Button variant="link" onClick={() => setRefresh((n) => n + 1)}>Try again</Button></p>
          : !items ? <p className="text-sm text-muted-foreground">Loading extras…</p>
          : items.length === 0 && !adding && <p className="text-sm text-muted-foreground">No extras yet.</p>}
        {items && items.length > 0 && (
          <ul className="divide-y border-y">
            {items.map((item) => {
              const url = item.approval_token && item.expires_at && new Date(item.expires_at) > new Date()
                ? approvalLink(item.approval_token) : null;
              return (
                <li key={item.id} className="space-y-2 py-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="min-w-0 break-words text-sm font-medium">{item.title}</span>
                    <span className="text-sm tabular-nums">{billingMoney(item.amount_cents, item.currency)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.description}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{billingStatus[item.status]}</Badge>
                    <span>{billingMonthLabel(item.billing_month)}</span>
                    {item.decided_by && item.decided_at && <span>{item.decided_by} · {new Date(item.decided_at).toLocaleDateString()}</span>}
                  </div>
                  {item.status === "pending" && (
                    <div className="flex flex-wrap items-center gap-2">
                      {url && item.approval_token ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => copy(item.approval_token!)}>Copy approval link</Button>
                          <Button size="sm" variant="ghost" asChild><a href={url} target="_blank" rel="noreferrer">Open approval</a></Button>
                        </>
                      ) : <span className="text-sm text-muted-foreground">Link expired. Withdraw it and create a new one.</span>}
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => withdraw(item.id)}>Withdraw</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="link" className="px-0" asChild><Link to="/dashboard/retainers">Open billing review</Link></Button>
      </section>
      <p role="status" className="sr-only">{notice}</p>
      {notice && <p aria-hidden="true" className="text-sm text-muted-foreground">{notice}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
