import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Loader2, CheckCircle2, ExternalLink, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Settings {
  whatsapp_from: string | null;
  enabled: boolean;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  auto_proposal_reminders: boolean;
  auto_payment_reminders: boolean;
  auto_contract_reminders: boolean;
  auto_onboarding_reminders: boolean;
}

const EMPTY: Settings = {
  whatsapp_from: "",
  enabled: false,
  twilio_account_sid: "",
  twilio_auth_token: "",
  auto_proposal_reminders: false,
  auto_payment_reminders: false,
  auto_contract_reminders: false,
  auto_onboarding_reminders: false,
};

function maskToken(t: string | null | undefined): string {
  if (!t) return "";
  if (t.length <= 6) return "•".repeat(t.length);
  return `${t.slice(0, 3)}${"•".repeat(Math.max(0, t.length - 6))}${t.slice(-3)}`;
}

export default function WhatsAppSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(EMPTY);
  const [showToken, setShowToken] = useState(false);
  const [tokenDirty, setTokenDirty] = useState(false);

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

  const configured =
    !!settings.whatsapp_from &&
    !!settings.twilio_account_sid &&
    !!settings.twilio_auth_token;

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) {
      setSaving(false);
      return;
    }
    // Don't overwrite the stored token with the masked placeholder if user didn't change it.
    const payload: any = { ...settings, user_id: u.user.id };
    if (!tokenDirty) delete payload.twilio_auth_token;
    const { error } = await supabase
      .from("whatsapp_settings" as any)
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    } else {
      setTokenDirty(false);
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

  const tokenDisplay = tokenDirty
    ? settings.twilio_auth_token || ""
    : showToken
      ? settings.twilio_auth_token || ""
      : maskToken(settings.twilio_auth_token);

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-foreground">WhatsApp (Twilio)</h3>
              {settings.enabled && configured ? (
                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                </Badge>
              ) : (
                <Badge variant="outline">Not configured</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Bring your own Twilio account to send WhatsApp messages from the app. Click-to-chat (wa.me) links keep
              working without any setup — these settings are only needed for in-app and automated sends.
            </p>
            <a
              href="https://console.twilio.com/us1/account/keys-credentials/api-keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-2"
            >
              Find your Twilio credentials <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tw-sid">Twilio Account SID</Label>
            <Input
              id="tw-sid"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={settings.twilio_account_sid || ""}
              onChange={(e) => setSettings({ ...settings, twilio_account_sid: e.target.value.trim() })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tw-token">Auth Token</Label>
            <div className="relative">
              <Input
                id="tw-token"
                type={showToken || tokenDirty ? "text" : "password"}
                placeholder="Your Twilio Auth Token"
                value={tokenDisplay}
                onFocus={() => {
                  if (!tokenDirty) {
                    setTokenDirty(true);
                    setSettings({ ...settings, twilio_auth_token: "" });
                  }
                }}
                onChange={(e) => {
                  setTokenDirty(true);
                  setSettings({ ...settings, twilio_auth_token: e.target.value });
                }}
              />
              {!tokenDirty && settings.twilio_auth_token && (
                <button
                  type="button"
                  onClick={() => setShowToken((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showToken ? "Hide token" : "Show token"}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Stored only for your account. Used server-side to call Twilio.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wa-from">Twilio WhatsApp sender</Label>
          <Input
            id="wa-from"
            placeholder="+14155238886"
            value={settings.whatsapp_from || ""}
            onChange={(e) => setSettings({ ...settings, whatsapp_from: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Your approved Twilio WhatsApp number in E.164 format. Sandbox numbers also work for testing.
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
            disabled={!configured && !settings.enabled}
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
