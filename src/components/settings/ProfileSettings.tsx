import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Mail, Sun, Moon, Save, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import { z } from "zod";

const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "SEK", label: "SEK — Swedish Krona" },
  { code: "NOK", label: "NOK — Norwegian Krone" },
  { code: "DKK", label: "DKK — Danish Krone" },
  { code: "ZAR", label: "ZAR — South African Rand" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "INR", label: "INR — Indian Rupee" },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "sv", label: "Swedish" },
];

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

const profileSchema = z.object({
  first_name: z.string().trim().max(60, "Too long").optional().or(z.literal("")),
  last_name: z.string().trim().max(60, "Too long").optional().or(z.literal("")),
  business_name: z.string().trim().max(120, "Too long").optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(30, "Too long")
    .regex(/^[+\d\s()\-.]*$/, "Invalid phone")
    .optional()
    .or(z.literal("")),
  website: z
    .string()
    .trim()
    .max(200, "Too long")
    .refine(
      (v) => !v || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(v),
      "Invalid website URL",
    )
    .optional()
    .or(z.literal("")),
  timezone: z.string().min(1),
  default_currency: z.string().min(3).max(3),
  language: z.string().min(2).max(5),
});

type ProfileForm = z.infer<typeof profileSchema>;

const EMPTY: ProfileForm = {
  first_name: "",
  last_name: "",
  business_name: "",
  phone: "",
  website: "",
  timezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      : "UTC",
  default_currency: "USD",
  language: "en",
};

export default function ProfileSettings() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initial, setInitial] = useState<ProfileForm>(EMPTY);
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileForm, string>>>({});

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setEmail(user.email || "");

      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const next: ProfileForm = data
        ? {
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            business_name: data.business_name || "",
            phone: data.phone || "",
            website: data.website || "",
            timezone: data.timezone || EMPTY.timezone,
            default_currency: data.default_currency || "USD",
            language: data.language || "en",
          }
        : EMPTY;
      setInitial(next);
      setForm(next);
      setLoading(false);
    };
    load();
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial],
  );

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSave = async () => {
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof ProfileForm, string>> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path[0] as keyof ProfileForm;
        if (k) fieldErrors[k] = i.message;
      });
      setErrors(fieldErrors);
      toast({
        title: "Please fix the highlighted fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const payload = {
      user_id: user.id,
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      business_name: form.business_name || null,
      phone: form.phone || null,
      website: form.website || null,
      timezone: form.timezone,
      default_currency: form.default_currency,
      language: form.language,
    };

    const { error } = await supabase
      .from("user_profiles")
      .upsert(payload, { onConflict: "user_id" });

    setSaving(false);

    if (error) {
      toast({
        title: "Couldn't save profile",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setInitial(form);
    toast({
      title: "Profile saved",
      description: "Your details will be used across proposals, contracts and emails.",
    });
  };

  const handleDiscard = () => {
    setForm(initial);
    setErrors({});
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Loading your profile…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-5">
          <div>
            <Label className="text-xs text-muted-foreground">Email address</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{email || "—"}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              To change your sign-in email, head to Security.
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="First name"
              value={form.first_name || ""}
              onChange={(v) => set("first_name", v)}
              error={errors.first_name}
              placeholder="Alex"
            />
            <Field
              label="Last name"
              value={form.last_name || ""}
              onChange={(v) => set("last_name", v)}
              error={errors.last_name}
              placeholder="Morgan"
            />
          </div>

          <Field
            label="Business name"
            value={form.business_name || ""}
            onChange={(v) => set("business_name", v)}
            error={errors.business_name}
            placeholder="Acme Studio"
            hint="Used on proposals, contracts and invoices"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Phone number"
              value={form.phone || ""}
              onChange={(v) => set("phone", v)}
              error={errors.phone}
              placeholder="+1 555 123 4567"
            />
            <Field
              label="Website"
              value={form.website || ""}
              onChange={(v) => set("website", v)}
              error={errors.website}
              placeholder="https://acme.com"
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Timezone</Label>
              <Select
                value={form.timezone}
                onValueChange={(v) => set("timezone", v)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Default currency</Label>
              <Select
                value={form.default_currency}
                onValueChange={(v) => set("default_currency", v)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Language</Label>
              <Select
                value={form.language}
                onValueChange={(v) => set("language", v)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-xs text-muted-foreground">Appearance</Label>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Moon className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Sun className="w-4 h-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {theme === "dark" ? "Dark mode" : "Light mode"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {theme === "dark"
                      ? "Easier on the eyes in low light"
                      : "Bright, clean interface for daytime use"}
                  </p>
                </div>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                aria-label="Toggle dark mode"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      <div
        className={`sticky bottom-4 z-20 transition-all ${
          dirty ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-card/95 backdrop-blur px-4 py-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <AlertCircle className="w-4 h-4 text-accent" />
            You have unsaved changes
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={saving}>
              Discard
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1.5 ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
      />
      {error ? (
        <p className="text-xs text-destructive mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      ) : null}
    </div>
  );
}
