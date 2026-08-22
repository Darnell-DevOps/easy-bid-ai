import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Palette, Save, ShieldCheck, Mail } from "lucide-react";

export interface Branding {
  business_name: string;
  logo_url: string;
  brand_color: string;
  default_sender_name: string;
  default_sign_off: string;
  reply_to_email: string;
}

const EMPTY: Branding = {
  business_name: "",
  logo_url: "",
  brand_color: "#3b82f6",
  default_sender_name: "",
  default_sign_off: "",
  reply_to_email: "",
};

export default function BrandingCard({ onSaved }: { onSaved?: (b: Branding) => void }) {
  const { toast } = useToast();
  const [branding, setBranding] = useState<Branding>(EMPTY);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [replyToInput, setReplyToInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase
      .from("business_branding")
      .select("*")
      .eq("user_id", u.user.id)
      .maybeSingle();
    const d = data as any;
    if (d) {
      setBranding({
        business_name: d.business_name || "",
        logo_url: d.logo_url || "",
        brand_color: d.brand_color || "#3b82f6",
        default_sender_name: d.default_sender_name || "",
        default_sign_off: d.default_sign_off || "",
        reply_to_email: d.reply_to_verified_email || "",
      });
      setVerifiedEmail(d.reply_to_verified_email || null);
      setPendingEmail(d.reply_to_pending_email || null);
      setReplyToInput(d.reply_to_pending_email || d.reply_to_verified_email || u.user.email || "");
    } else {
      setBranding({ ...EMPTY });
      setReplyToInput(u.user.email || "");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveBranding = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(false); return; }
    // Save everything except reply_to_email (verification-only).
    const { reply_to_email: _ignore, ...rest } = branding;
    const { error } = await supabase
      .from("business_branding")
      .upsert({ user_id: u.user.id, ...rest }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save branding", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Branding saved" });
    onSaved?.(branding);
  };

  const requestVerification = async () => {
    const email = replyToInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setVerifying(true);
    const { data, error } = await supabase.functions.invoke("verify-reply-to", {
      body: { action: "request", email },
    });
    setVerifying(false);
    if (error || (data as any)?.error) {
      toast({ title: "Couldn't send verification", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Verification email sent", description: `Check ${email} and click the link to verify.` });
    await load();
  };

  if (loading) {
    return (
      <Card><CardContent className="p-8 flex justify-center" role="status" aria-live="polite">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading email branding</span>
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2"><Palette className="w-4 h-4 text-accent" aria-hidden="true" /> Business branding</h3>
            <p className="text-xs text-muted-foreground mt-1">Used across all client-facing emails sent on your behalf.</p>
          </div>
          <Button size="sm" onClick={saveBranding} disabled={saving} aria-busy={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />} Save
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field id="branding-business-name" label="Business name" v={branding.business_name} on={(v) => setBranding({ ...branding, business_name: v })} placeholder="Acme Studio" />
          <Field id="branding-sender-name" label="Sender display name" v={branding.default_sender_name} on={(v) => setBranding({ ...branding, default_sender_name: v })} placeholder="Alex from Acme" />
          <Field id="branding-logo-url" label="Logo URL" v={branding.logo_url} on={(v) => setBranding({ ...branding, logo_url: v })} placeholder="https://..." />
          <div role="group" aria-labelledby="branding-colour-label">
            <span id="branding-colour-label" className="text-xs font-medium">Brand colour</span>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                id="branding-colour-picker"
                type="color"
                aria-label="Choose brand colour"
                value={branding.brand_color}
                onChange={(e) => setBranding({ ...branding, brand_color: e.target.value })}
                className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer"
              />
              <Input id="branding-colour-value" aria-label="Brand colour hex value" value={branding.brand_color} onChange={(e) => setBranding({ ...branding, brand_color: e.target.value })} />
            </div>
          </div>
          <Field id="branding-sign-off" label="Default sign-off" v={branding.default_sign_off} on={(v) => setBranding({ ...branding, default_sign_off: v })} placeholder="Talk soon," />
        </div>

        {/* Reply-to verification block */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 text-accent mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Reply-to email</h4>
                <div role="status" aria-live="polite">
                  {verifiedEmail ? (
                    <Badge variant="secondary" className="gap-1 text-[10px]"><ShieldCheck className="w-3 h-3" aria-hidden="true" /> Verified</Badge>
                  ) : pendingEmail ? (
                    <Badge variant="outline" className="text-[10px]">Pending verification</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Not set</Badge>
                  )}
                </div>
              </div>
              <p id="branding-reply-to-help" className="text-xs text-muted-foreground mt-1">
                Emails are sent from <code className="text-foreground">notify@closesync.io</code> — when a client hits Reply, the message lands in your verified inbox below.
              </p>
            </div>
          </div>
          {verifiedEmail && (
            <p className="text-xs"><span className="text-muted-foreground">Currently verified:</span> <span className="font-medium">{verifiedEmail}</span></p>
          )}
          {pendingEmail && pendingEmail !== verifiedEmail && (
            <p className="text-xs"><span className="text-muted-foreground">Awaiting confirmation at:</span> <span className="font-medium">{pendingEmail}</span></p>
          )}
          <div className="flex gap-2">
            <Label htmlFor="branding-reply-to" className="sr-only">Reply-to email address</Label>
            <Input
              id="branding-reply-to"
              type="email"
              autoComplete="email"
              aria-describedby="branding-reply-to-help"
              placeholder="you@business.com"
              value={replyToInput}
              onChange={(e) => setReplyToInput(e.target.value)}
            />
            <Button onClick={requestVerification} disabled={verifying} aria-busy={verifying} className="gap-2 shrink-0">
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="w-4 h-4" aria-hidden="true" />}
              {verifiedEmail && replyToInput.trim().toLowerCase() === verifiedEmail ? "Resend" : "Send verification"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ id, label, v, on, placeholder }: { id: string; label: string; v: string; on: (s: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} className="mt-1.5" value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
