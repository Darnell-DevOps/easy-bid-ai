import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Inbox, Copy, Check, Sparkles, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const INBOUND_DOMAIN = "leads.closesync.io";

export default function InboundAddressCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("user_inbound_aliases")
        .select("slug")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setSlug(data.slug);
      setLoading(false);
    };
    void load();
  }, []);

  const fullAddress = slug ? `leads-${slug}@${INBOUND_DOMAIN}` : "";

  const copy = async () => {
    if (!fullAddress) return;
    await navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    toast({ title: "Address copied", description: "Forward any enquiry here." });
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-accent/[0.06] via-card to-purple/[0.04]">
      <div
        aria-hidden
        className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl opacity-40 pointer-events-none"
        style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.35), transparent 70%)" }}
      />
      <CardContent className="relative p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center flex-shrink-0">
            <Inbox className="w-4.5 h-4.5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">Your unique lead address</h3>
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wider border-accent/30 text-accent"
              >
                Beta
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-accent" />
              Forward any enquiry here — we'll create the lead and draft an AI reply.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="h-10 rounded-md bg-muted/40 animate-pulse" />
        ) : !slug ? (
          <p className="text-sm text-muted-foreground">
            No inbound address yet. Refresh in a moment, or set one up in{" "}
            <Link to="/dashboard/settings?tab=integrations" className="text-accent hover:underline">
              Settings
            </Link>
            .
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <Input value={fullAddress} readOnly className="font-mono text-sm bg-background/60" />
            <Button onClick={copy} variant="outline" size="sm" className="gap-2 shrink-0">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button asChild variant="ghost" size="sm" className="gap-2 shrink-0 hidden sm:inline-flex">
              <Link to="/dashboard/settings?tab=integrations">
                <SettingsIcon className="w-3.5 h-3.5" />
                Configure
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
