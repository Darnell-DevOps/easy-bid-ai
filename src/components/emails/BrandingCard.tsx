import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Palette, Save } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      const { data } = await supabase
        .from("business_branding")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (data) {
        setBranding({
          business_name: data.business_name || "",
          logo_url: data.logo_url || "",
          brand_color: data.brand_color || "#3b82f6",
          default_sender_name: data.default_sender_name || "",
          default_sign_off: data.default_sign_off || "",
          reply_to_email: data.reply_to_email || u.user.email || "",
        });
      } else {
        setBranding({ ...EMPTY, reply_to_email: u.user.email || "" });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(false); return; }
    const { error } = await supabase
      .from("business_branding")
      .upsert({ user_id: u.user.id, ...branding }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save branding", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Branding saved" });
    onSaved?.(branding);
  };

  if (loading) {
    return (
      <Card><CardContent className="p-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2"><Palette className="w-4 h-4 text-accent" /> Business branding</h3>
            <p className="text-xs text-muted-foreground mt-1">Used across all client-facing emails sent on your behalf.</p>
          </div>
          <Button size="sm" onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Business name" v={branding.business_name} on={(v) => setBranding({ ...branding, business_name: v })} placeholder="Acme Studio" />
          <Field label="Sender display name" v={branding.default_sender_name} on={(v) => setBranding({ ...branding, default_sender_name: v })} placeholder="Alex from Acme" />
          <Field label="Logo URL" v={branding.logo_url} on={(v) => setBranding({ ...branding, logo_url: v })} placeholder="https://..." />
          <div>
            <Label className="text-xs">Brand colour</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="color"
                value={branding.brand_color}
                onChange={(e) => setBranding({ ...branding, brand_color: e.target.value })}
                className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer"
              />
              <Input value={branding.brand_color} onChange={(e) => setBranding({ ...branding, brand_color: e.target.value })} />
            </div>
          </div>
          <Field label="Reply-to email" v={branding.reply_to_email} on={(v) => setBranding({ ...branding, reply_to_email: v })} placeholder="you@business.com" />
          <Field label="Default sign-off" v={branding.default_sign_off} on={(v) => setBranding({ ...branding, default_sign_off: v })} placeholder="Talk soon," />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, v, on, placeholder }: { label: string; v: string; on: (s: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="mt-1.5" value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
