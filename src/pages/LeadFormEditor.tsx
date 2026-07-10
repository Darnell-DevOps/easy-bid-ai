import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, ExternalLink, Loader2, Save, Send, ShieldCheck } from "lucide-react";
import FieldListEditor from "@/components/forms/FieldListEditor";
import SmartFieldRenderer from "@/components/forms/SmartFieldRenderer";
import {
  groupSmartFields, isFieldVisible, type SmartField, type FieldResponses,
} from "@/lib/form-fields";

interface LeadFormRow {
  id: string;
  name: string;
  slug: string;
  title: string;
  description: string;
  fields: SmartField[];
  submit_label: string;
  success_message: string;
  redirect_url: string | null;
  is_active: boolean;
  submission_count: number;
  view_count: number;
}

export default function LeadFormEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<LeadFormRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<FieldResponses>({});

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data } = await supabase.from("lead_forms" as any).select("*").eq("id", id).maybeSingle();
      if (data) setForm(data as any);
      setLoading(false);
    })();
  }, [id]);

  const grouped = useMemo(() => (form ? groupSmartFields(form.fields || []) : []), [form]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase
      .from("lead_forms" as any)
      .update({
        name: form.name,
        slug: form.slug,
        title: form.title,
        description: form.description,
        fields: form.fields,
        submit_label: form.submit_label,
        success_message: form.success_message,
        redirect_url: form.redirect_url,
        is_active: form.is_active,
      })
      .eq("id", form.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
  };

  const copyLink = () => {
    if (!form) return;
    navigator.clipboard.writeText(`${window.location.origin}/f/${form.slug}`);
    toast({ title: "Public link copied" });
  };

  const copyEmbed = () => {
    if (!form) return;
    const code = `<iframe src="${window.location.origin}/f/${form.slug}?embed=1" style="width:100%;border:0;min-height:640px" loading="lazy"></iframe>`;
    navigator.clipboard.writeText(code);
    toast({ title: "Embed code copied" });
  };

  if (loading) {
    return <DashboardLayout><div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  }
  if (!form) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h1 className="text-xl font-semibold text-foreground">Form not found</h1>
          <Button asChild variant="outline" className="mt-4"><Link to="/dashboard/lead-forms">Back</Link></Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button asChild size="icon" variant="ghost"><Link to="/dashboard/lead-forms"><ArrowLeft className="w-4 h-4" /></Link></Button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">{form.name}</h1>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>/f/{form.slug}</span>
                <Badge variant={form.is_active ? "default" : "secondary"} className="text-[10px]">{form.is_active ? "Live" : "Off"}</Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5"><Copy className="w-3.5 h-3.5" />Copy link</Button>
            <Button variant="outline" size="sm" onClick={copyEmbed} className="gap-1.5"><Copy className="w-3.5 h-3.5" />Copy embed</Button>
            <Button variant="outline" size="sm" onClick={() => window.open(`/f/${form.slug}`, "_blank")} className="gap-1.5"><ExternalLink className="w-3.5 h-3.5" />Open</Button>
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <section className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Form settings</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Internal name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">URL slug</Label>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase() })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Public title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Submit button label</Label>
                  <Input value={form.submit_label} onChange={(e) => setForm({ ...form, submit_label: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Redirect URL (optional)</Label>
                  <Input placeholder="https://…" value={form.redirect_url || ""} onChange={(e) => setForm({ ...form, redirect_url: e.target.value || null })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Success message</Label>
                <Textarea rows={2} value={form.success_message} onChange={(e) => setForm({ ...form, success_message: e.target.value })} />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <div>
                  <Label className="text-xs">Form is live</Label>
                  <p className="text-[11px] text-muted-foreground">When off, the public link returns a "form unavailable" message.</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <FieldListEditor
                fields={form.fields || []}
                onChange={(fields) => setForm({ ...form, fields })}
                context="lead"
              />
            </section>
          </div>

          <div className="lg:col-span-2">
            <div className="sticky top-4 space-y-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Live preview</p>
              <div className="max-h-[80vh] overflow-y-auto">
                <div className="relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur p-6 overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
                  <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple/10 blur-3xl rounded-full pointer-events-none" />

                  <header className="relative mb-7">
                    <h3 className="text-xl font-bold text-foreground tracking-tight">{form.title || "Untitled"}</h3>
                    {form.description && (
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{form.description}</p>
                    )}
                  </header>

                  <div className="relative space-y-8">
                    {grouped.map((g, gi) => (
                      <section key={g.group} className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-accent/15 text-accent text-[11px] font-semibold">
                            {gi + 1}
                          </span>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-foreground/80 font-semibold">
                            {g.group}
                          </p>
                          <div className="flex-1 h-px bg-border/60" />
                        </div>
                        <div className="space-y-4">
                          {g.fields.map((f) => isFieldVisible(f, preview) && (
                            <div key={f.id} className="space-y-1.5">
                              <Label className="text-sm font-medium text-foreground">
                                {f.label}{f.required && <span className="text-rose-500 ml-1">*</span>}
                              </Label>
                              <div className="[&_input]:transition-all [&_textarea]:transition-all [&_input]:focus-visible:ring-2 [&_textarea]:focus-visible:ring-2 [&_input]:focus-visible:ring-accent/40 [&_textarea]:focus-visible:ring-accent/40">
                                <SmartFieldRenderer field={f} value={preview[f.id]} onChange={(v) => setPreview({ ...preview, [f.id]: v })} />
                              </div>
                              {f.helpText && <p className="text-[11px] text-muted-foreground">{f.helpText}</p>}
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>

                  <div className="relative mt-8 pt-6 border-t border-border/60 space-y-4">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-2 text-center">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80 flex-shrink-0" />
                      Submit your details and we'll prepare the next step for your project.
                    </p>
                    <Button
                      disabled
                      size="lg"
                      className="w-full gap-2 bg-accent text-accent-foreground font-semibold h-12"
                    >
                      <Send className="w-4 h-4" />
                      {form.submit_label || "Send Project Details"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
