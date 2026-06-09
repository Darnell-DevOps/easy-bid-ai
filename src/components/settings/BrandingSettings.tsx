import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Save, Upload, Trash2, RotateCcw, Palette, FileText, FileSignature, Mail, Image as ImageIcon,
} from "lucide-react";

interface BrandingState {
  business_name: string;
  logo_url: string;
  brand_color: string;
  brand_secondary_color: string;
  default_sender_name: string;
  email_signature: string;
}

const DEFAULTS: BrandingState = {
  business_name: "",
  logo_url: "",
  brand_color: "#7c3aed",
  brand_secondary_color: "#0ea5e9",
  default_sender_name: "",
  email_signature: "",
};

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export default function BrandingSettings() {
  const { toast } = useToast();
  const [state, setState] = useState<BrandingState>(DEFAULTS);
  const [initial, setInitial] = useState<BrandingState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase
      .from("business_branding")
      .select("*")
      .eq("user_id", u.user.id)
      .maybeSingle();
    const d = data as any;
    const next: BrandingState = d ? {
      business_name: d.business_name || "",
      logo_url: d.logo_url || "",
      brand_color: d.brand_color || DEFAULTS.brand_color,
      brand_secondary_color: d.brand_secondary_color || DEFAULTS.brand_secondary_color,
      default_sender_name: d.default_sender_name || "",
      email_signature: d.email_signature || "",
    } : { ...DEFAULTS };
    setState(next);
    setInitial(next);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(initial),
    [state, initial]
  );

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo must be under 2MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setUploading(false); return; }
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${u.user.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("branding-logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }
    const { data: signed, error: sErr } = await supabase.storage
      .from("branding-logos")
      .createSignedUrl(path, TEN_YEARS);
    setUploading(false);
    if (sErr || !signed) {
      toast({ title: "Couldn't generate logo URL", description: sErr?.message, variant: "destructive" });
      return;
    }
    setState({ ...state, logo_url: signed.signedUrl });
    toast({ title: "Logo uploaded — remember to save" });
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
    toast({ title: "Branding saved", description: "Applied to all future client documents and emails." });
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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        {/* Editor */}
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Palette className="w-4 h-4 text-accent" /> Brand identity
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Appears on every proposal, contract and email you send.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={resetDefaults} className="gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </Button>
            </div>

            {/* Logo */}
            <div>
              <Label className="text-xs">Company logo</Label>
              <div className="mt-2 flex items-center gap-4">
                <div className="h-20 w-20 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                  {state.logo_url ? (
                    <img src={state.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="gap-1.5"
                    >
                      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {state.logo_url ? "Replace" : "Upload"}
                    </Button>
                    {state.logo_url && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setState({ ...state, logo_url: "" })}
                        className="gap-1.5 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG or SVG · max 2MB · square works best.</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs">Business name</Label>
              <Input
                className="mt-1.5"
                value={state.business_name}
                onChange={(e) => setState({ ...state, business_name: e.target.value })}
                placeholder="Acme Studio"
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <ColorField
                label="Primary colour"
                value={state.brand_color}
                onChange={(v) => setState({ ...state, brand_color: v })}
              />
              <ColorField
                label="Secondary colour"
                value={state.brand_secondary_color}
                onChange={(v) => setState({ ...state, brand_secondary_color: v })}
              />
            </div>

            <div>
              <Label className="text-xs">Default sender name</Label>
              <Input
                className="mt-1.5"
                value={state.default_sender_name}
                onChange={(e) => setState({ ...state, default_sender_name: e.target.value })}
                placeholder="Alex from Acme"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Shown as the "From" name on outbound emails.</p>
            </div>

            <div>
              <Label className="text-xs">Email signature</Label>
              <Textarea
                rows={5}
                className="mt-1.5 font-mono text-sm"
                value={state.email_signature}
                onChange={(e) => setState({ ...state, email_signature: e.target.value })}
                placeholder={"Alex Rivera\nFounder, Acme Studio\nacme.studio · +1 555 123 4567"}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Appended to client-facing emails. Plain text — line breaks preserved.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" onClick={discard} disabled={!dirty}>Discard</Button>
              <Button onClick={save} disabled={!dirty || saving} className="gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
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
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="proposal" className="gap-1.5"><FileText className="w-3.5 h-3.5" />Proposal</TabsTrigger>
                <TabsTrigger value="contract" className="gap-1.5"><FileSignature className="w-3.5 h-3.5" />Contract</TabsTrigger>
                <TabsTrigger value="email" className="gap-1.5"><Mail className="w-3.5 h-3.5" />Email</TabsTrigger>
              </TabsList>
              <TabsContent value="proposal" className="mt-4">
                <ProposalPreview b={state} />
              </TabsContent>
              <TabsContent value="contract" className="mt-4">
                <ContractPreview b={state} />
              </TabsContent>
              <TabsContent value="email" className="mt-4">
                <EmailPreview b={state} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2 mt-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded border border-border bg-transparent cursor-pointer"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-sm" />
      </div>
    </div>
  );
}

/* ---------------- Previews ---------------- */

function LogoMark({ b, size = 36 }: { b: BrandingState; size?: number }) {
  if (b.logo_url) {
    return (
      <img
        src={b.logo_url}
        alt="logo"
        style={{ height: size, maxWidth: size * 3, objectFit: "contain" }}
      />
    );
  }
  const initials = (b.business_name || "Your Brand")
    .split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      style={{
        height: size, width: size, borderRadius: 8,
        background: `linear-gradient(135deg, ${b.brand_color}, ${b.brand_secondary_color})`,
        color: "white", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  );
}

function ProposalPreview({ b }: { b: BrandingState }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-white text-slate-900">
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${b.brand_color}, ${b.brand_secondary_color})` }}
      >
        <div className="flex items-center gap-3 text-white">
          <LogoMark b={b} />
          <div>
            <div className="text-xs uppercase tracking-wider opacity-80">Proposal</div>
            <div className="font-semibold">{b.business_name || "Your Brand"}</div>
          </div>
        </div>
        <div className="text-xs text-white/80">#2026-014</div>
      </div>
      <div className="p-5 space-y-3">
        <h4 className="text-lg font-semibold">Website redesign — Phase 1</h4>
        <p className="text-sm text-slate-600">Prepared for Jamie Rivera · Valid for 14 days</p>
        <div className="rounded-md border border-slate-200 p-3 text-sm flex items-center justify-between">
          <span>Discovery & strategy</span>
          <span className="font-semibold" style={{ color: b.brand_color }}>$2,400</span>
        </div>
        <button
          className="w-full py-2.5 rounded-md text-white text-sm font-semibold"
          style={{ background: b.brand_color }}
        >
          Accept proposal
        </button>
      </div>
    </div>
  );
}

function ContractPreview({ b }: { b: BrandingState }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-white text-slate-900">
      <div className="px-5 py-4 border-b-2 flex items-center justify-between" style={{ borderColor: b.brand_color }}>
        <div className="flex items-center gap-3">
          <LogoMark b={b} size={32} />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Services agreement</div>
            <div className="font-semibold text-sm">{b.business_name || "Your Brand"}</div>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold uppercase px-2 py-1 rounded"
          style={{ background: `${b.brand_secondary_color}20`, color: b.brand_secondary_color }}
        >
          Awaiting signature
        </span>
      </div>
      <div className="p-5 space-y-2 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">1. Scope of work</p>
        <p className="text-slate-600 leading-relaxed">
          The Provider agrees to deliver the services outlined in the attached proposal between the parties listed below…
        </p>
        <div className="grid grid-cols-2 gap-3 pt-3">
          <div className="border-t pt-2"><div className="text-[10px] text-slate-500">Provider</div><div className="font-medium">{b.default_sender_name || b.business_name || "You"}</div></div>
          <div className="border-t pt-2"><div className="text-[10px] text-slate-500">Client</div><div className="font-medium">Jamie Rivera</div></div>
        </div>
      </div>
    </div>
  );
}

function EmailPreview({ b }: { b: BrandingState }) {
  const sig = b.email_signature?.trim();
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-white text-slate-900">
      <div className="px-5 py-3 border-b bg-slate-50 text-xs text-slate-600 space-y-0.5">
        <div><span className="font-semibold text-slate-900">From:</span> {b.default_sender_name || b.business_name || "Your Brand"} &lt;notify@closesync.io&gt;</div>
        <div><span className="font-semibold text-slate-900">Subject:</span> Your proposal from {b.business_name || "Your Brand"}</div>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b">
          <LogoMark b={b} size={32} />
          <span className="font-semibold text-sm">{b.business_name || "Your Brand"}</span>
        </div>
        <p className="text-sm">Hi Jamie,</p>
        <p className="text-sm text-slate-700 leading-relaxed">
          Thanks for the chat earlier — I've put together a proposal covering everything we discussed. Take a look when you have a moment.
        </p>
        <button
          className="px-4 py-2 rounded-md text-white text-sm font-semibold"
          style={{ background: b.brand_color }}
        >
          View proposal
        </button>
        {sig ? (
          <div className="text-xs text-slate-600 whitespace-pre-line pt-3 border-t">{sig}</div>
        ) : (
          <div className="text-xs text-slate-400 pt-3 border-t italic">Your email signature will appear here.</div>
        )}
      </div>
    </div>
  );
}
