import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Inbox, Copy, Check, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { publicClientConfig } from "@/config/public-client-config";

const INBOUND_DOMAIN = "leads.closesync.io"; // user-facing display domain

export default function InboundEmailSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savingNotify, setSavingNotify] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_inbound_aliases")
        .select("slug, inbound_secret, notify_digest")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setSlug(data.slug);
        setSecret(data.inbound_secret);
        setNotify(!!data.notify_digest);
      }
      setLoading(false);
    };
    void load();
  }, []);

  const fullAddress = slug ? `leads-${slug}@${INBOUND_DOMAIN}` : "";

  const copy = async () => {
    if (!fullAddress) return;
    await navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    toast({ title: "Address copied" });
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleNotify = async (next: boolean) => {
    setNotify(next);
    setSavingNotify(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("user_inbound_aliases")
        .update({ notify_digest: next })
        .eq("user_id", user.id);
    }
    setSavingNotify(false);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
            <Inbox className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground">Inbound lead address</h2>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-accent/30 text-accent">
                Beta
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Forward enquiries to this address — we'll create the lead and draft an AI reply.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="h-20 rounded-md bg-muted/40 animate-pulse" />
        ) : !slug ? (
          <p className="text-sm text-muted-foreground">No inbound address yet. Refresh in a moment.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Your unique address</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input value={fullAddress} readOnly className="font-mono text-sm" />
                <Button onClick={copy} variant="outline" size="sm" className="gap-2 shrink-0">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1.5">
                <Sparkles className="w-3 h-3 text-accent mt-0.5 shrink-0" />
                Anything sent here becomes a new lead with an AI-drafted reply ready in your{" "}
                <a href="/dashboard/leads" className="text-accent hover:underline">Lead Assistant</a>.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
              <div className="space-y-0.5">
                <p className="text-sm text-foreground">Daily digest</p>
                <p className="text-[11px] text-muted-foreground">
                  Get a once-a-day summary of new leads emailed to your account address.
                </p>
              </div>
              <Switch checked={notify} onCheckedChange={toggleNotify} disabled={savingNotify} />
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              How to wire this up
            </button>

            {showAdvanced && (
              <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground space-y-3 leading-relaxed">
                <p>
                  Inbound email needs an external service to receive mail and post it to our webhook.
                  We support any provider that can POST a parsed email payload (SendGrid Inbound Parse,
                  Postmark Inbound, Cloudflare Email Workers, Mailgun Routes, etc.).
                </p>
                <div>
                  <p className="font-semibold text-foreground mb-1">Webhook URL</p>
                  <code className="block bg-background border border-border rounded px-2 py-1.5 break-all">
                    {`${publicClientConfig.supabaseUrl}/functions/v1/inbound-email-webhook`}
                  </code>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">Expected payload (any of these field names)</p>
                  <code className="block bg-background border border-border rounded px-2 py-1.5 whitespace-pre">
{`{
  "to": "${fullAddress}",
  "from": "Jane <jane@example.com>",
  "subject": "Quick question",
  "text": "Plain text body",
  "html": "<p>Optional HTML</p>",
  "secret": "(optional, see below)"
}`}
                  </code>
                </div>
                {secret && (
                  <div>
                    <p className="font-semibold text-foreground mb-1">Required shared secret</p>
                    <code className="block bg-background border border-border rounded px-2 py-1.5 break-all font-mono">
                      {secret}
                    </code>
                    <p className="mt-1.5">
                      Send this either as a <code>secret</code> field in the body or as an{" "}
                      <code>X-Inbound-Secret</code> header. Requests without an exact match are rejected.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
