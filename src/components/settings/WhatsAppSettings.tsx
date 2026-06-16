import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Settings {
  whatsapp_from: string | null;
  enabled: boolean;
  auto_proposal_reminders: boolean;
  auto_payment_reminders: boolean;
  auto_contract_reminders: boolean;
  auto_onboarding_reminders: boolean;
}

const EMPTY: Settings = {
  whatsapp_from: "",
  enabled: false,
  auto_proposal_reminders: false,
  auto_payment_reminders: false,
  auto_contract_reminders: false,
  auto_onboarding_reminders: false,
};

export default function WhatsAppSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(EMPTY);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return;
      const { data } = await supabase
        .from("whatsapp_settings" as any)
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (data) setSettings({ ...EMPTY, ...(data as any) });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return;
    const payload = { ...settings, user_id: u.user.id };
    const { error } = await supabase
      .from("whatsapp_settings" as any)
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "WhatsApp settings saved" });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-foreground">WhatsApp</h3>
              {settings.enabled && settings.whatsapp_from ? (
                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                </Badge>
              ) : (
                <Badge variant="outline">Not configured</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Send WhatsApp messages from your Twilio WhatsApp Business sender. Click-to-chat links via wa.me work
              without any setup — these settings are only needed for automated server-side sends.
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="wa-from">Twilio WhatsApp sender</Label>
          <Input
            id="wa-from"
            placeholder="+14155238886"
            value={settings.whatsapp_from || ""}
            onChange={(e) => setSettings({ ...settings, whatsapp_from: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Your approved Twilio WhatsApp number in E.164 format. Twilio sandbox numbers also work for testing.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Enable WhatsApp sending</p>
            <p className="text-xs text-muted-foreground">Required for any automated or in-app WhatsApp sends.</p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
          />
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Automated reminders
          </p>
          {[
            { key: "auto_proposal_reminders", label: "Proposal follow-ups" },
            { key: "auto_payment_reminders", label: "Payment / retainer reminders" },
            { key: "auto_contract_reminders", label: "Contract signing reminders" },
            { key: "auto_onboarding_reminders", label: "Onboarding reminders" },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between">
              <p className="text-sm text-foreground">{row.label}</p>
              <Switch
                checked={(settings as any)[row.key]}
                onCheckedChange={(v) => setSettings({ ...settings, [row.key]: v } as Settings)}
                disabled={!settings.enabled}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save WhatsApp settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
