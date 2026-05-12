import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Globe, ShieldCheck, RefreshCw, Trash2, Star, Plus, Copy, AlertCircle,
} from "lucide-react";

interface DnsRecord {
  record?: string;
  name?: string;
  type?: string;
  value?: string;
  ttl?: string | number;
  priority?: number;
  status?: string;
}
interface SendingDomain {
  id: string;
  domain: string;
  status: string;
  dns_records: DnsRecord[];
  default_from_local: string;
  is_default: boolean;
  verified_at: string | null;
  last_checked_at: string | null;
}

export default function SendingDomainsCard() {
  const { toast } = useToast();
  const [domains, setDomains] = useState<SendingDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("sending-domain-manage", { body: { action: "list" } });
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't load domains", description: error.message, variant: "destructive" });
      return;
    }
    setDomains(((data as any)?.domains as SendingDomain[]) || []);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    const d = newDomain.trim().toLowerCase();
    if (!d) return;
    setAdding(true);
    const { data, error } = await supabase.functions.invoke("sending-domain-manage", {
      body: { action: "add", domain: d },
    });
    setAdding(false);
    if (error || (data as any)?.error) {
      const code = (data as any)?.error;
      const msg = code === "already_added" ? "Domain already added" :
                  code === "invalid_domain" ? "Enter a valid domain (e.g. mail.acme.com)" :
                  error?.message || code || "Couldn't add domain";
      toast({ title: msg, variant: "destructive" });
      return;
    }
    setNewDomain("");
    toast({ title: "Domain added", description: "Add the DNS records below at your registrar, then click Verify." });
    load();
  };

  const check = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke("sending-domain-manage", { body: { action: "check", id } });
    setBusyId(null);
    if (error) { toast({ title: "Check failed", description: error.message, variant: "destructive" }); return; }
    const status = (data as any)?.domain?.status;
    toast({
      title: status === "verified" ? "Domain verified" : "Status updated",
      description: status === "verified"
        ? "You can now send client emails from this domain."
        : `Current status: ${status}. DNS may still be propagating.`,
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this domain? Emails will fall back to notify@closesync.io.")) return;
    setBusyId(id);
    await supabase.functions.invoke("sending-domain-manage", { body: { action: "remove", id } });
    setBusyId(null);
    load();
  };

  const setDefault = async (id: string) => {
    setBusyId(id);
    await supabase.functions.invoke("sending-domain-manage", { body: { action: "set_default", id } });
    setBusyId(null);
    load();
  };

  const setLocal = async (id: string, local: string) => {
    await supabase.functions.invoke("sending-domain-manage", { body: { action: "set_local", id, local } });
    load();
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent" /> Custom sending domain
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Send client emails from your own domain (e.g. <code className="text-foreground">hello@yourbusiness.com</code>) once DNS is verified.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="mail.yourbusiness.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} disabled={adding} className="gap-2 shrink-0">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add domain
          </Button>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : domains.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No custom domains yet.</p>
        ) : (
          <div className="space-y-4">
            {domains.map((d) => (
              <DomainRow key={d.id} d={d} busy={busyId === d.id} onCheck={() => check(d.id)} onRemove={() => remove(d.id)} onDefault={() => setDefault(d.id)} onLocal={(v) => setLocal(d.id, v)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DomainRow({ d, busy, onCheck, onRemove, onDefault, onLocal }: {
  d: SendingDomain; busy: boolean;
  onCheck: () => void; onRemove: () => void; onDefault: () => void; onLocal: (v: string) => void;
}) {
  const [local, setLocalState] = useState(d.default_from_local || "hello");
  const verified = d.status === "verified";
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{d.domain}</span>
            {verified ? (
              <Badge variant="secondary" className="gap-1 text-[10px]"><ShieldCheck className="w-3 h-3" /> Verified</Badge>
            ) : d.status === "failed" ? (
              <Badge variant="destructive" className="gap-1 text-[10px]"><AlertCircle className="w-3 h-3" /> Failed</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] capitalize">{(d.status || "pending").replace(/_/g, " ")}</Badge>
            )}
            {d.is_default && <Badge variant="outline" className="gap-1 text-[10px]"><Star className="w-3 h-3" /> Default</Badge>}
          </div>
          {verified && (
            <p className="text-xs text-muted-foreground mt-1">
              Sending as <code className="text-foreground">{local}@{d.domain}</code>
            </p>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" variant="outline" onClick={onCheck} disabled={busy} className="gap-1.5 h-8">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Verify
          </Button>
          {verified && !d.is_default && (
            <Button size="sm" variant="outline" onClick={onDefault} disabled={busy} className="gap-1.5 h-8">
              <Star className="w-3.5 h-3.5" /> Make default
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onRemove} disabled={busy} className="h-8 text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {verified && (
        <div className="flex items-end gap-2 pt-2 border-t border-border/50">
          <div className="flex-1">
            <Label className="text-xs">From address (local part)</Label>
            <Input className="mt-1.5" value={local} onChange={(e) => setLocalState(e.target.value)} placeholder="hello" />
          </div>
          <Button size="sm" variant="outline" onClick={() => onLocal(local)} className="h-9">Save</Button>
        </div>
      )}

      {!verified && d.dns_records?.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Add these DNS records at your domain registrar, then click <strong>Verify</strong>. Propagation can take a few minutes to a few hours.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="text-left">
                  <th className="py-1 pr-3">Type</th>
                  <th className="py-1 pr-3">Name</th>
                  <th className="py-1 pr-3">Value</th>
                  <th className="py-1">TTL</th>
                </tr>
              </thead>
              <tbody>
                {d.dns_records.map((r, i) => (
                  <tr key={i} className="border-t border-border/40 align-top">
                    <td className="py-1.5 pr-3 font-mono uppercase">{r.type || r.record}</td>
                    <td className="py-1.5 pr-3 font-mono break-all">{r.name}</td>
                    <td className="py-1.5 pr-3 font-mono break-all">
                      <CopyCell value={r.value || ""} />
                    </td>
                    <td className="py-1.5">{r.ttl || "Auto"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyCell({ value }: { value: string }) {
  const { toast } = useToast();
  return (
    <span className="inline-flex items-start gap-1.5">
      <span className="break-all">{value}</span>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => { navigator.clipboard.writeText(value); toast({ title: "Copied" }); }}
      >
        <Copy className="w-3 h-3" />
      </button>
    </span>
  );
}
