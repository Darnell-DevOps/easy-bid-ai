import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Globe, Plus, Trash2, RefreshCw, Copy, CheckCircle2, AlertTriangle, Star, Loader2 } from "lucide-react";

interface DomainRow {
  id: string;
  domain: string;
  verification_token: string;
  verified: boolean;
  verified_at: string | null;
  is_primary: boolean;
  use_for_portal: boolean;
  use_for_forms: boolean;
  last_checked_at: string | null;
  last_check_error: string | null;
}

const APP_HOST = typeof window !== "undefined" ? window.location.hostname : "";

function isValidDomain(d: string) {
  return /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/.test(d.trim());
}

export default function DomainSettings() {
  const { toast } = useToast();
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("custom_domains" as any)
      .select("*")
      .order("created_at", { ascending: true });
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addDomain = async () => {
    const domain = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!isValidDomain(domain)) {
      toast({ title: "Invalid domain", description: "Enter a domain like portal.acme.com", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setAdding(true);
    const { error } = await supabase.from("custom_domains" as any).insert({
      user_id: user.id, domain,
    });
    setAdding(false);
    if (error) {
      toast({ title: "Could not add domain", description: error.message, variant: "destructive" });
      return;
    }
    setNewDomain("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this domain?")) return;
    await supabase.from("custom_domains" as any).delete().eq("id", id);
    load();
  };

  const setPrimary = async (id: string) => {
    await supabase.from("custom_domains" as any).update({ is_primary: true }).eq("id", id);
    load();
  };

  const toggle = async (id: string, field: "use_for_portal" | "use_for_forms", value: boolean) => {
    await supabase.from("custom_domains" as any).update({ [field]: value }).eq("id", id);
    setRows(r => r.map(x => x.id === id ? { ...x, [field]: value } : x));
  };

  const verify = async (id: string) => {
    setVerifyingId(id);
    const { data, error } = await supabase.functions.invoke("verify-custom-domain", { body: { id } });
    setVerifyingId(null);
    if (error) {
      toast({ title: "Verification failed", description: error.message, variant: "destructive" });
      load();
      return;
    }
    if ((data as any)?.verified) {
      toast({ title: "Domain verified", description: "Your DNS TXT record is in place." });
    } else {
      toast({ title: "Not verified yet", description: "DNS hasn't propagated, or the TXT record isn't visible.", variant: "destructive" });
    }
    load();
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Custom domains</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Serve your client portal and lead forms from your own domain (e.g. <code className="text-foreground">portal.acme.com</code>).
                Add a domain, point DNS, and we'll use it in every link we generate for you.
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Add a new domain</Label>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="portal.yourcompany.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addDomain(); }}
              />
              <Button onClick={addDomain} disabled={adding || !newDomain.trim()} className="gap-2">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Subdomains work best (e.g. <code>portal.acme.com</code>, <code>app.acme.com</code>). Apex domains may require ALIAS/ANAME support at your DNS provider.
            </p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading domains…</CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No custom domains yet.</CardContent></Card>
      ) : (
        rows.map((row) => {
          const txtHost = `_closesync.${row.domain}`;
          return (
            <Card key={row.id}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground truncate">{row.domain}</h4>
                      {row.verified ? (
                        <Badge variant="outline" className="gap-1 text-emerald-500 border-emerald-500/40">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500/40">
                          <AlertTriangle className="w-3 h-3" /> Pending verification
                        </Badge>
                      )}
                      {row.is_primary && (
                        <Badge className="gap-1"><Star className="w-3 h-3" /> Primary</Badge>
                      )}
                    </div>
                    {row.last_check_error && (
                      <p className="text-xs text-destructive mt-1">{row.last_check_error}</p>
                    )}
                    {row.verified_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Verified {new Date(row.verified_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => verify(row.id)} disabled={verifyingId === row.id}>
                      {verifyingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      {row.verified ? "Re-check" : "Verify"}
                    </Button>
                    {row.verified && !row.is_primary && (
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => setPrimary(row.id)}>
                        <Star className="w-3.5 h-3.5" /> Make primary
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(row.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">DNS setup</p>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-2 items-center">
                      <span className="text-muted-foreground">Type</span>
                      <code className="text-foreground">CNAME</code>
                      <span />
                      <span className="text-muted-foreground">Host</span>
                      <code className="text-foreground break-all">{row.domain}</code>
                      <Button size="sm" variant="ghost" onClick={() => copy(row.domain, "Host")}><Copy className="w-3 h-3" /></Button>
                      <span className="text-muted-foreground">Points to</span>
                      <code className="text-foreground break-all">{APP_HOST}</code>
                      <Button size="sm" variant="ghost" onClick={() => copy(APP_HOST, "Target")}><Copy className="w-3 h-3" /></Button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 text-xs">
                    <p className="text-muted-foreground">Then add this TXT record to prove ownership:</p>
                    <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-2 items-center">
                      <span className="text-muted-foreground">Type</span>
                      <code className="text-foreground">TXT</code>
                      <span />
                      <span className="text-muted-foreground">Host</span>
                      <code className="text-foreground break-all">{txtHost}</code>
                      <Button size="sm" variant="ghost" onClick={() => copy(txtHost, "TXT host")}><Copy className="w-3 h-3" /></Button>
                      <span className="text-muted-foreground">Value</span>
                      <code className="text-foreground break-all">{row.verification_token}</code>
                      <Button size="sm" variant="ghost" onClick={() => copy(row.verification_token, "TXT value")}><Copy className="w-3 h-3" /></Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    DNS changes can take a few minutes to propagate. Click <strong>Verify</strong> once the records are live.
                    SSL certificates issue automatically after verification (typically within a few minutes).
                  </p>
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-border">
                    <Switch checked={row.use_for_portal} onCheckedChange={(v) => toggle(row.id, "use_for_portal", v)} />
                    <div>
                      <p className="text-sm font-medium text-foreground">Client portal</p>
                      <p className="text-xs text-muted-foreground">Use this domain for proposal & portal links.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-border">
                    <Switch checked={row.use_for_forms} onCheckedChange={(v) => toggle(row.id, "use_for_forms", v)} />
                    <div>
                      <p className="text-sm font-medium text-foreground">Lead forms</p>
                      <p className="text-xs text-muted-foreground">Use this domain for public form URLs.</p>
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
