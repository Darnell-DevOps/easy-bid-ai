import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Receipt, FileText, Loader2, Globe, Mail, Phone, AlertCircle } from "lucide-react";

type BusinessInfo = {
  legal_name: string;
  trading_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state_region: string;
  postcode: string;
  country: string;
  registration_number: string;
  vat_number: string;
  tax_number: string;
  business_email: string;
  business_phone: string;
  website_url: string;
  business_description: string;
  default_proposal_expiry_days: number;
  default_currency: string;
  default_payment_terms: string;
  default_invoice_due_days: number;
  default_invoice_grace_days: number;
  default_tax_rate: string;
  default_tax_mode: "none" | "exclusive" | "inclusive";
};

const EMPTY: BusinessInfo = {
  legal_name: "",
  trading_name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state_region: "",
  postcode: "",
  country: "",
  registration_number: "",
  vat_number: "",
  tax_number: "",
  business_email: "",
  business_phone: "",
  website_url: "",
  business_description: "",
  default_proposal_expiry_days: 30,
  default_currency: "USD",
  default_payment_terms: "net_14",
  default_invoice_due_days: 14,
  default_invoice_grace_days: 7,
  default_tax_rate: "",
};

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "SEK", "NOK", "DKK", "JPY"];
const PAYMENT_TERMS = [
  { value: "due_immediately", label: "Due immediately" },
  { value: "net_7", label: "Net 7" },
  { value: "net_14", label: "Net 14" },
  { value: "net_30", label: "Net 30" },
  { value: "net_60", label: "Net 60" },
];
const EXPIRY_OPTIONS = [7, 14, 30, 60];

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const urlRe = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/i;
const phoneRe = /^[+()\d\s.\-]{6,}$/;

function validate(d: BusinessInfo) {
  const errs: Partial<Record<keyof BusinessInfo, string>> = {};
  if (d.business_email && !emailRe.test(d.business_email)) errs.business_email = "Enter a valid email address";
  if (d.website_url && !urlRe.test(d.website_url)) errs.website_url = "Enter a valid URL";
  if (d.business_phone && !phoneRe.test(d.business_phone)) errs.business_phone = "Enter a valid phone number";
  if (d.default_tax_rate) {
    const n = Number(d.default_tax_rate);
    if (Number.isNaN(n) || n < 0 || n > 100) errs.default_tax_rate = "Must be 0–100";
  }
  return errs;
}

export default function BusinessInformationSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<BusinessInfo>(EMPTY);
  const [initial, setInitial] = useState<BusinessInfo>(EMPTY);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data: row } = await supabase
        .from("business_branding")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (row) {
        const merged: BusinessInfo = {
          ...EMPTY,
          ...Object.fromEntries(
            Object.keys(EMPTY).map((k) => [k, (row as any)[k] ?? (EMPTY as any)[k]]),
          ) as BusinessInfo,
          default_tax_rate: (row as any).default_tax_rate?.toString() ?? "",
        };
        setData(merged);
        setInitial(merged);
      } else if (user.email) {
        const seed = { ...EMPTY, business_email: user.email };
        setData(seed);
        setInitial(seed);
      }
      setLoading(false);
    })();
  }, []);

  const errors = useMemo(() => validate(data), [data]);
  const dirty = useMemo(() => JSON.stringify(data) !== JSON.stringify(initial), [data, initial]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = <K extends keyof BusinessInfo>(k: K, v: BusinessInfo[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    if (!userId) return;
    if (Object.keys(errors).length) {
      toast({ title: "Please fix the highlighted fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      ...data,
      user_id: userId,
      default_tax_rate: data.default_tax_rate === "" ? null : Number(data.default_tax_rate),
    };
    const { error } = await supabase
      .from("business_branding")
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    setInitial(data);
    toast({ title: "Business information saved", description: "Your details will be used across CloseSync." });
  };

  if (loading) {
    return (
      <Card><CardContent className="p-10 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  const displayName = data.trading_name || data.legal_name || "Your Business";
  const addressLine = [data.address_line1, data.address_line2, data.city, data.state_region, data.postcode, data.country]
    .filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      {/* Business Details */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <SectionHeader icon={Building2} title="Business details" description="Legal name and address used on contracts and invoices." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Legal business name">
              <Input value={data.legal_name} onChange={(e) => set("legal_name", e.target.value)} placeholder="Acme Studio Ltd" />
            </Field>
            <Field label="Trading name" optional>
              <Input value={data.trading_name} onChange={(e) => set("trading_name", e.target.value)} placeholder="Acme" />
            </Field>
            <Field label="Address line 1" className="md:col-span-2">
              <Input value={data.address_line1} onChange={(e) => set("address_line1", e.target.value)} placeholder="123 Market Street" />
            </Field>
            <Field label="Address line 2" optional className="md:col-span-2">
              <Input value={data.address_line2} onChange={(e) => set("address_line2", e.target.value)} placeholder="Suite 400" />
            </Field>
            <Field label="City"><Input value={data.city} onChange={(e) => set("city", e.target.value)} /></Field>
            <Field label="State / County"><Input value={data.state_region} onChange={(e) => set("state_region", e.target.value)} /></Field>
            <Field label="Postcode / ZIP"><Input value={data.postcode} onChange={(e) => set("postcode", e.target.value)} /></Field>
            <Field label="Country"><Input value={data.country} onChange={(e) => set("country", e.target.value)} placeholder="United Kingdom" /></Field>
          </div>
        </CardContent>
      </Card>

      {/* Registration */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <SectionHeader icon={Receipt} title="Registration" description="Optional — shown on legal documents where required." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Company reg. number" optional>
              <Input value={data.registration_number} onChange={(e) => set("registration_number", e.target.value)} />
            </Field>
            <Field label="VAT number" optional>
              <Input value={data.vat_number} onChange={(e) => set("vat_number", e.target.value)} />
            </Field>
            <Field label="Tax number" optional>
              <Input value={data.tax_number} onChange={(e) => set("tax_number", e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <SectionHeader icon={Mail} title="Contact information" description="Visible to clients on proposals, invoices and the portal." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Business email" error={errors.business_email}>
              <Input type="email" value={data.business_email} onChange={(e) => set("business_email", e.target.value)} placeholder="hello@acme.com" />
            </Field>
            <Field label="Business phone" error={errors.business_phone}>
              <Input value={data.business_phone} onChange={(e) => set("business_phone", e.target.value)} placeholder="+1 555 123 4567" />
            </Field>
            <Field label="Website" className="md:col-span-2" error={errors.website_url}>
              <Input value={data.website_url} onChange={(e) => set("website_url", e.target.value)} placeholder="https://acme.com" />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <SectionHeader icon={FileText} title="Business description" description="Used by AI to generate proposals, onboarding and client copy." />
          <Textarea
            rows={5}
            value={data.business_description}
            onChange={(e) => set("business_description", e.target.value)}
            placeholder="We help SaaS founders ship beautiful product marketing sites…"
          />
        </CardContent>
      </Card>

      {/* Proposal defaults */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <SectionHeader icon={FileText} title="Default proposal details" description="Pre-fill values when you create a new proposal." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Default expiry">
              <Select
                value={String(data.default_proposal_expiry_days)}
                onValueChange={(v) => set("default_proposal_expiry_days", Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} days</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Default currency">
              <Select value={data.default_currency} onValueChange={(v) => set("default_currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Default payment terms">
              <Select value={data.default_payment_terms} onValueChange={(v) => set("default_payment_terms", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Invoice defaults */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <SectionHeader icon={Receipt} title="Invoice defaults" description="Used across invoices and retainers." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Default due (days)">
              <Input type="number" min={0} value={data.default_invoice_due_days}
                onChange={(e) => set("default_invoice_due_days", Number(e.target.value))} />
            </Field>
            <Field label="Late grace period (days)">
              <Input type="number" min={0} value={data.default_invoice_grace_days}
                onChange={(e) => set("default_invoice_grace_days", Number(e.target.value))} />
            </Field>
            <Field label="Default tax rate (%)" optional error={errors.default_tax_rate}>
              <Input type="number" min={0} max={100} step="0.01" value={data.default_tax_rate}
                onChange={(e) => set("default_tax_rate", e.target.value)} placeholder="20" />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card className="bg-card/60">
        <CardContent className="p-6 space-y-4">
          <SectionHeader icon={Globe} title="Live preview" description="How your details appear on client-facing documents." />
          <div className="rounded-lg border border-border bg-background p-5 text-sm">
            <div className="flex justify-between items-start gap-4 flex-wrap">
              <div>
                <p className="text-base font-semibold text-foreground">{displayName}</p>
                {data.legal_name && data.trading_name && data.legal_name !== data.trading_name && (
                  <p className="text-xs text-muted-foreground">Trading as {data.trading_name} · Legal name: {data.legal_name}</p>
                )}
                {addressLine && <p className="text-xs text-muted-foreground mt-1 max-w-md">{addressLine}</p>}
              </div>
              <div className="text-right text-xs text-muted-foreground space-y-0.5">
                {data.business_email && <p className="flex items-center gap-1.5 justify-end"><Mail className="w-3 h-3" />{data.business_email}</p>}
                {data.business_phone && <p className="flex items-center gap-1.5 justify-end"><Phone className="w-3 h-3" />{data.business_phone}</p>}
                {data.website_url && <p className="flex items-center gap-1.5 justify-end"><Globe className="w-3 h-3" />{data.website_url}</p>}
              </div>
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <PreviewStat label="Currency" value={data.default_currency} />
              <PreviewStat label="Payment terms" value={PAYMENT_TERMS.find(p => p.value === data.default_payment_terms)?.label ?? "—"} />
              <PreviewStat label="Proposal expiry" value={`${data.default_proposal_expiry_days} days`} />
              <PreviewStat label="Tax rate" value={data.default_tax_rate ? `${data.default_tax_rate}%` : "—"} />
            </div>
            {(data.registration_number || data.vat_number || data.tax_number) && (
              <p className="text-[11px] text-muted-foreground mt-4">
                {data.registration_number && <>Reg. {data.registration_number}  </>}
                {data.vat_number && <>· VAT {data.vat_number}  </>}
                {data.tax_number && <>· Tax {data.tax_number}</>}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save bar */}
      <div className="sticky bottom-4 z-10">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/95 backdrop-blur px-4 py-3 shadow-lg">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {dirty ? (
              <><AlertCircle className="w-3.5 h-3.5 text-accent" /> You have unsaved changes</>
            ) : (
              <>All changes saved</>
            )}
          </div>
          <div className="flex gap-2">
            {dirty && (
              <Button variant="ghost" size="sm" onClick={() => setData(initial)} disabled={saving}>
                Discard
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-accent" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function Field({
  label, children, optional, error, className,
}: { label: string; children: React.ReactNode; optional?: boolean; error?: string; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="flex items-center gap-2 text-xs font-medium text-foreground">
        {label}
        {optional && <Badge variant="outline" className="text-[10px] font-normal h-4 px-1.5">Optional</Badge>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}
