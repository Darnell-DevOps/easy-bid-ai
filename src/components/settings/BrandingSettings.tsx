import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Save, Upload, Trash2, RotateCcw, Palette, FileText, FileSignature,
  Image as ImageIcon, LayoutGrid, Receipt, CalendarDays, ClipboardList, Sparkles,
} from "lucide-react";

interface BrandingState {
  business_name: string;
  tagline: string;
  logo_url: string;
  favicon_url: string;
  brand_color: string;
  brand_secondary_color: string;
  welcome_message: string;
  show_logo_on_proposals: boolean;
  show_logo_on_contracts: boolean;
  show_logo_on_invoices: boolean;
  show_logo_on_portal: boolean;
  show_logo_on_onboarding: boolean;
  proposal_cover_show_name: boolean;
  proposal_cover_show_tagline: boolean;
  proposal_cover_show_date: boolean;
  contract_cover_show_name: boolean;
  contract_cover_show_title: boolean;
  contract_cover_show_details: boolean;
}

const DEFAULTS: BrandingState = {
  business_name: "",
  tagline: "",
  logo_url: "",
  favicon_url: "",
  brand_color: "#7c3aed",
  brand_secondary_color: "#0ea5e9",
  welcome_message: "Welcome to our client portal. We're excited to work with you.",
  show_logo_on_proposals: true,
  show_logo_on_contracts: true,
  show_logo_on_invoices: true,
  show_logo_on_portal: true,
  show_logo_on_onboarding: true,
  proposal_cover_show_name: true,
  proposal_cover_show_tagline: false,
  proposal_cover_show_date: true,
  contract_cover_show_name: true,
  contract_cover_show_title: true,
  contract_cover_show_details: true,
};

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export default function BrandingSettings() {
  const { toast } = useToast();
  const [state, setState] = useState<BrandingState>(DEFAULTS);
  const [initial, setInitial] = useState<BrandingState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase
      .from("business_branding")
      .select("*")
      .eq("user_id", u.user.id)
      .maybeSingle();
    const d = data as any;
    const next: BrandingState = d ? { ...DEFAULTS, ...Object.fromEntries(
      Object.keys(DEFAULTS).map((k) => [k, d[k] ?? (DEFAULTS as any)[k]])
    ) } as BrandingState : { ...DEFAULTS };
    setState(next);
    setInitial(next);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(initial), [state, initial]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const uploadImage = async (
    file: File,
    kind: "logo" | "favicon",
  ): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return null;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image must be under 2MB", variant: "destructive" });
      return null;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${u.user.id}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("branding-logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return null;
    }
    const { data: signed, error: sErr } = await supabase.storage
      .from("branding-logos")
      .createSignedUrl(path, TEN_YEARS);
    if (sErr || !signed) {
      toast({ title: "Couldn't generate URL", description: sErr?.message, variant: "destructive" });
      return null;
    }
    return signed.signedUrl;
  };

  const handleLogo = async (file: File) => {
    setUploadingLogo(true);
    const url = await uploadImage(file, "logo");
    setUploadingLogo(false);
    if (url) { setState({ ...state, logo_url: url }); toast({ title: "Logo uploaded — remember to save" }); }
  };
  const handleFavicon = async (file: File) => {
    setUploadingFavicon(true);
    const url = await uploadImage(file, "favicon");
    setUploadingFavicon(false);
    if (url) { setState({ ...state, favicon_url: url }); toast({ title: "Favicon uploaded — remember to save" }); }
  };

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(false); return; }
    const { error } = await supabase
      .from("business_branding")
      .upsert({ user_id: u.user.id, ...state }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save branding", description: error.message, variant: "destructive" });
      return;
    }
    setInitial(state);
    toast({ title: "Branding saved", description: "Applied across all client-facing experiences." });
  };

  const discard = () => setState(initial);
  const resetDefaults = () => setState({ ...DEFAULTS, business_name: state.business_name });

  if (loading) {
    return (
      <Card><CardContent className="p-12 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  const update = <K extends keyof BrandingState>(k: K, v: BrandingState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-4">
      {dirty && (
        <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 backdrop-blur">
          <p className="text-sm font-medium">You have unsaved branding changes.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={discard}>Discard</Button>
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        {/* ===== Editor column ===== */}
        <div className="space-y-4">
          {/* Identity */}
          <Card>
            <CardContent className="p-6 space-y-6">
              <SectionHeader
                icon={<Sparkles className="w-4 h-4 text-accent" />}
                title="Brand identity"
                subtitle="Flows automatically into every client touchpoint."
                action={
                  <Button size="sm" variant="outline" onClick={resetDefaults} className="gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> Reset to default
                  </Button>
                }
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Business name</Label>
                  <Input className="mt-1.5" value={state.business_name}
                    onChange={(e) => update("business_name", e.target.value)} placeholder="Acme Studio" />
                </div>
                <div>
                  <Label className="text-xs">Tagline <span className="text-muted-foreground">(optional)</span></Label>
                  <Input className="mt-1.5" value={state.tagline}
                    onChange={(e) => update("tagline", e.target.value)} placeholder="Design that converts." />
                </div>
              </div>

              {/* Logo + Favicon */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AssetUpload
                  label="Business logo"
                  hint="PNG, JPG or SVG · max 2MB"
                  value={state.logo_url}
                  uploading={uploadingLogo}
                  inputRef={logoRef}
                  onPick={handleLogo}
                  onRemove={() => update("logo_url", "")}
                />
                <AssetUpload
                  label="Favicon"
                  hint="Square PNG or ICO · max 2MB"
                  value={state.favicon_url}
                  uploading={uploadingFavicon}
                  inputRef={faviconRef}
                  onPick={handleFavicon}
                  onRemove={() => update("favicon_url", "")}
                  square
                />
              </div>
            </CardContent>
          </Card>

          {/* Colours */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <SectionHeader
                icon={<Palette className="w-4 h-4 text-accent" />}
                title="Brand colours"
                subtitle="Applied to client portal, proposals, onboarding & booking pages — never the admin UI."
              />
              <div className="grid grid-cols-2 gap-4">
                <ColorField label="Primary colour" value={state.brand_color}
                  onChange={(v) => update("brand_color", v)} />
                <ColorField label="Secondary colour" value={state.brand_secondary_color}
                  onChange={(v) => update("brand_secondary_color", v)} />
              </div>
            </CardContent>
          </Card>

          {/* Welcome message */}
          <Card>
            <CardContent className="p-6 space-y-3">
              <SectionHeader
                icon={<LayoutGrid className="w-4 h-4 text-accent" />}
                title="Client welcome message"
                subtitle="Shown inside the client portal and onboarding area."
              />
              <Textarea
                rows={3}
                value={state.welcome_message}
                onChange={(e) => update("welcome_message", e.target.value)}
                placeholder="Welcome to our client portal. We're excited to work with you."
              />
            </CardContent>
          </Card>

          {/* Logo visibility */}
          <Card>
            <CardContent className="p-6 space-y-1">
              <SectionHeader
                icon={<ImageIcon className="w-4 h-4 text-accent" />}
                title="Where to show your logo"
                subtitle="Toggle per surface."
              />
              <div className="mt-3 divide-y divide-border">
                <ToggleRow label="Proposals" checked={state.show_logo_on_proposals}
                  onChange={(v) => update("show_logo_on_proposals", v)} />
                <ToggleRow label="Contracts" checked={state.show_logo_on_contracts}
                  onChange={(v) => update("show_logo_on_contracts", v)} />
                <ToggleRow label="Invoices" checked={state.show_logo_on_invoices}
                  onChange={(v) => update("show_logo_on_invoices", v)} />
                <ToggleRow label="Client portal" checked={state.show_logo_on_portal}
                  onChange={(v) => update("show_logo_on_portal", v)} />
                <ToggleRow label="Onboarding pages" checked={state.show_logo_on_onboarding}
                  onChange={(v) => update("show_logo_on_onboarding", v)} />
              </div>
            </CardContent>
          </Card>

          {/* Cover settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6 space-y-1">
                <SectionHeader
                  icon={<FileText className="w-4 h-4 text-accent" />}
                  title="Proposal cover"
                  compact
                />
                <div className="mt-3 divide-y divide-border">
                  <ToggleRow label="Show logo" checked={state.show_logo_on_proposals}
                    onChange={(v) => update("show_logo_on_proposals", v)} />
                  <ToggleRow label="Show company name" checked={state.proposal_cover_show_name}
                    onChange={(v) => update("proposal_cover_show_name", v)} />
                  <ToggleRow label="Show tagline" checked={state.proposal_cover_show_tagline}
                    onChange={(v) => update("proposal_cover_show_tagline", v)} />
                  <ToggleRow label="Show creation date" checked={state.proposal_cover_show_date}
                    onChange={(v) => update("proposal_cover_show_date", v)} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 space-y-1">
                <SectionHeader
                  icon={<FileSignature className="w-4 h-4 text-accent" />}
                  title="Contract cover"
                  compact
                />
                <div className="mt-3 divide-y divide-border">
                  <ToggleRow label="Show logo" checked={state.show_logo_on_contracts}
                    onChange={(v) => update("show_logo_on_contracts", v)} />
                  <ToggleRow label="Show company name" checked={state.contract_cover_show_name}
                    onChange={(v) => update("contract_cover_show_name", v)} />
                  <ToggleRow label="Show contract title" checked={state.contract_cover_show_title}
                    onChange={(v) => update("contract_cover_show_title", v)} />
                  <ToggleRow label="Show company details" checked={state.contract_cover_show_details}
                    onChange={(v) => update("contract_cover_show_details", v)} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={discard} disabled={!dirty}>Discard</Button>
            <Button onClick={save} disabled={!dirty || saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save branding
            </Button>
          </div>
        </div>

        {/* ===== Preview column ===== */}
        <div className="xl:sticky xl:top-2 self-start">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Live preview</h3>
                  <p className="text-xs text-muted-foreground mt-1">How your branding appears to clients.</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Real-time</Badge>
              </div>
              <Tabs defaultValue="proposal">
                <TabsList className="grid grid-cols-6 w-full h-auto">
                  <PreviewTab value="proposal" icon={<FileText className="w-3.5 h-3.5" />} label="Proposal" />
                  <PreviewTab value="contract" icon={<FileSignature className="w-3.5 h-3.5" />} label="Contract" />
                  <PreviewTab value="portal" icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Portal" />
                  <PreviewTab value="invoice" icon={<Receipt className="w-3.5 h-3.5" />} label="Invoice" />
                  <PreviewTab value="booking" icon={<CalendarDays className="w-3.5 h-3.5" />} label="Booking" />
                  <PreviewTab value="onboarding" icon={<ClipboardList className="w-3.5 h-3.5" />} label="Onboard" />
                </TabsList>
                <TabsContent value="proposal" className="mt-4"><ProposalCoverPreview b={state} /></TabsContent>
                <TabsContent value="contract" className="mt-4"><ContractCoverPreview b={state} /></TabsContent>
                <TabsContent value="portal" className="mt-4"><PortalPreview b={state} /></TabsContent>
                <TabsContent value="invoice" className="mt-4"><InvoicePreview b={state} /></TabsContent>
                <TabsContent value="booking" className="mt-4"><BookingPreview b={state} /></TabsContent>
                <TabsContent value="onboarding" className="mt-4"><OnboardingPreview b={state} /></TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function SectionHeader({ icon, title, subtitle, action, compact }: {
  icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode; compact?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className={compact ? "text-sm font-semibold flex items-center gap-2" : "text-lg font-semibold flex items-center gap-2"}>
          {icon} {title}
        </h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2 mt-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded border border-border bg-transparent cursor-pointer" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-sm" />
      </div>
    </div>
  );
}

function AssetUpload({
  label, hint, value, uploading, inputRef, onPick, onRemove, square,
}: {
  label: string; hint: string; value: string; uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onPick: (f: File) => void; onRemove: () => void; square?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-2 flex items-center gap-3">
        <div className={`${square ? "h-14 w-14" : "h-16 w-16"} rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0`}>
          {value ? <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
            : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="flex gap-2 flex-wrap">
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}
              disabled={uploading} className="gap-1.5">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {value ? "Replace" : "Upload"}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" onClick={onRemove}
                className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
        </div>
      </div>
    </div>
  );
}

function PreviewTab({ value, icon, label }: { value: string; icon: React.ReactNode; label: string }) {
  return (
    <TabsTrigger value={value} className="flex flex-col gap-0.5 py-1.5 text-[10px]">
      {icon}{label}
    </TabsTrigger>
  );
}

/* ---------------- Previews ---------------- */

function LogoMark({ b, size = 36 }: { b: BrandingState; size?: number }) {
  if (b.logo_url) return <img src={b.logo_url} alt="logo" style={{ height: size, maxWidth: size * 3, objectFit: "contain" }} />;
  const initials = (b.business_name || "Your Brand").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      height: size, width: size, borderRadius: 8,
      background: `linear-gradient(135deg, ${b.brand_color}, ${b.brand_secondary_color})`,
      color: "white", display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.4,
    }}>{initials}</div>
  );
}

function PreviewShell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border overflow-hidden bg-white text-slate-900">{children}</div>;
}

function ProposalCoverPreview({ b }: { b: BrandingState }) {
  return (
    <PreviewShell>
      <div className="px-6 py-8" style={{ background: `linear-gradient(135deg, ${b.brand_color}, ${b.brand_secondary_color})` }}>
        <div className="flex items-start justify-between text-white">
          <div className="space-y-3">
            {b.show_logo_on_proposals && <LogoMark b={b} size={40} />}
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-80">Proposal</div>
              {b.proposal_cover_show_name && (
                <div className="text-xl font-semibold">{b.business_name || "Your Brand"}</div>
              )}
              {b.proposal_cover_show_tagline && b.tagline && (
                <div className="text-xs opacity-80 mt-0.5">{b.tagline}</div>
              )}
            </div>
          </div>
          {b.proposal_cover_show_date && (
            <div className="text-right text-xs opacity-80">
              <div>Prepared</div>
              <div className="font-medium text-white">{new Date().toLocaleDateString()}</div>
            </div>
          )}
        </div>
      </div>
      <div className="p-5 space-y-3">
        <h4 className="text-lg font-semibold">Website redesign — Phase 1</h4>
        <p className="text-sm text-slate-600">Prepared for Jamie Rivera</p>
        <button className="w-full py-2.5 rounded-md text-white text-sm font-semibold" style={{ background: b.brand_color }}>
          Accept proposal
        </button>
      </div>
    </PreviewShell>
  );
}

function ContractCoverPreview({ b }: { b: BrandingState }) {
  return (
    <PreviewShell>
      <div className="px-6 py-6 border-b-2" style={{ borderColor: b.brand_color }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {b.show_logo_on_contracts && <LogoMark b={b} size={36} />}
            <div>
              {b.contract_cover_show_title && (
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Services agreement</div>
              )}
              {b.contract_cover_show_name && (
                <div className="font-semibold">{b.business_name || "Your Brand"}</div>
              )}
            </div>
          </div>
          <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded"
            style={{ background: `${b.brand_secondary_color}20`, color: b.brand_secondary_color }}>
            Awaiting signature
          </span>
        </div>
      </div>
      <div className="p-5 space-y-2 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">1. Scope of work</p>
        <p className="text-slate-600 leading-relaxed">
          The Provider agrees to deliver the services outlined in the attached proposal between the parties listed below…
        </p>
        {b.contract_cover_show_details && (
          <div className="grid grid-cols-2 gap-3 pt-3 text-[11px]">
            <div className="border-t pt-2">
              <div className="text-slate-500">Provider</div>
              <div className="font-medium text-slate-900">{b.business_name || "Your Brand"}</div>
              {b.tagline && <div className="text-slate-500">{b.tagline}</div>}
            </div>
            <div className="border-t pt-2">
              <div className="text-slate-500">Client</div>
              <div className="font-medium text-slate-900">Jamie Rivera</div>
            </div>
          </div>
        )}
      </div>
    </PreviewShell>
  );
}

function PortalPreview({ b }: { b: BrandingState }) {
  return (
    <PreviewShell>
      <div className="px-5 py-4 flex items-center justify-between border-b"
        style={{ background: `linear-gradient(135deg, ${b.brand_color}10, ${b.brand_secondary_color}10)` }}>
        <div className="flex items-center gap-3">
          {b.show_logo_on_portal && <LogoMark b={b} size={28} />}
          <span className="font-semibold text-sm">{b.business_name || "Your Brand"}</span>
        </div>
        <span className="text-[10px] text-slate-500">Client portal</span>
      </div>
      <div className="p-5 space-y-4">
        {b.welcome_message && (
          <div className="rounded-md p-3 text-sm"
            style={{ background: `${b.brand_color}10`, color: "#0f172a", borderLeft: `3px solid ${b.brand_color}` }}>
            {b.welcome_message}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {["Proposals", "Contracts", "Invoices", "Files"].map((l) => (
            <div key={l} className="rounded-md border border-slate-200 p-3 text-xs">
              <div className="font-semibold">{l}</div>
              <div className="text-slate-500 mt-1">2 items</div>
            </div>
          ))}
        </div>
        <button className="w-full py-2 rounded-md text-white text-sm font-semibold" style={{ background: b.brand_color }}>
          View latest update
        </button>
      </div>
    </PreviewShell>
  );
}

function InvoicePreview({ b }: { b: BrandingState }) {
  return (
    <PreviewShell>
      <div className="px-5 py-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          {b.show_logo_on_invoices && <LogoMark b={b} size={32} />}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Invoice · #INV-204</div>
            <div className="font-semibold text-sm">{b.business_name || "Your Brand"}</div>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-500">
          <div>Due</div><div className="font-semibold text-slate-900">{new Date(Date.now() + 12096e5).toLocaleDateString()}</div>
        </div>
      </div>
      <div className="p-5 space-y-3 text-sm">
        <div className="flex justify-between"><span>Discovery & strategy</span><span>$2,400</span></div>
        <div className="flex justify-between"><span>Design system</span><span>$1,800</span></div>
        <Separator />
        <div className="flex justify-between font-semibold">
          <span>Total</span><span style={{ color: b.brand_color }}>$4,200.00</span>
        </div>
        <button className="w-full mt-2 py-2.5 rounded-md text-white text-sm font-semibold" style={{ background: b.brand_color }}>
          Pay invoice
        </button>
      </div>
    </PreviewShell>
  );
}

function BookingPreview({ b }: { b: BrandingState }) {
  return (
    <PreviewShell>
      <div className="px-5 py-4 border-b flex items-center gap-3"
        style={{ background: `${b.brand_color}08` }}>
        <LogoMark b={b} size={32} />
        <div>
          <div className="font-semibold text-sm">{b.business_name || "Your Brand"}</div>
          <div className="text-[11px] text-slate-500">Book a discovery call · 30 min</div>
        </div>
      </div>
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {["9:00", "9:30", "10:00", "10:30", "11:00", "11:30"].map((t, i) => (
            <button key={t}
              className="py-2 rounded-md text-xs font-medium border"
              style={i === 2
                ? { background: b.brand_color, color: "white", borderColor: b.brand_color }
                : { borderColor: "#e2e8f0", color: "#334155" }}>
              {t}
            </button>
          ))}
        </div>
        <button className="w-full py-2.5 rounded-md text-white text-sm font-semibold" style={{ background: b.brand_color }}>
          Confirm booking
        </button>
      </div>
    </PreviewShell>
  );
}

function OnboardingPreview({ b }: { b: BrandingState }) {
  return (
    <PreviewShell>
      <div className="px-5 py-4 border-b flex items-center gap-3">
        {b.show_logo_on_onboarding && <LogoMark b={b} size={32} />}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Onboarding · Step 1 of 4</div>
          <div className="font-semibold text-sm">{b.business_name || "Your Brand"}</div>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {b.welcome_message && (
          <p className="text-sm text-slate-700">{b.welcome_message}</p>
        )}
        <div>
          <div className="text-xs text-slate-500 mb-1.5">Project goal</div>
          <div className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-400">Tell us what success looks like…</div>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full" style={{ width: "25%", background: `linear-gradient(90deg, ${b.brand_color}, ${b.brand_secondary_color})` }} />
        </div>
        <button className="w-full py-2.5 rounded-md text-white text-sm font-semibold" style={{ background: b.brand_color }}>
          Continue
        </button>
      </div>
    </PreviewShell>
  );
}
