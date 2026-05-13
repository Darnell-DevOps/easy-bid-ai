import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ACCENT_OPTIONS,
  EMPTY_FORM,
  ICON_OPTIONS,
  type MergedTemplate,
  type TemplateFormValues,
  templateToForm,
} from "@/lib/proposal-templates";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When editing an existing built-in (override) or custom template. */
  template?: MergedTemplate;
  /** Initial values when creating from a proposal. */
  initial?: Partial<TemplateFormValues>;
  /** When duplicating, force creating a new row (no rowId). */
  forceCreate?: boolean;
  onSaved?: () => void;
}

export default function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  initial,
  forceCreate,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<TemplateFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setForm({ ...templateToForm(template), ...(initial || {}) });
    } else {
      setForm({ ...EMPTY_FORM, ...(initial || {}) });
    }
  }, [open, template, initial]);

  const setField = <K extends keyof TemplateFormValues>(k: K, v: TemplateFormValues[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isOverrideEdit = !!template && template.source === "builtin" && !forceCreate;
  const isCustomEdit = !!template?.rowId && !forceCreate && template.source !== "builtin";
  const titleText = isOverrideEdit
    ? `Customize "${template?.name}"`
    : isCustomEdit
    ? `Edit "${template?.name}"`
    : "Create proposal template";

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Not signed in");

      const payload = {
        user_id: userId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        service_type: form.service_type.trim() || null,
        best_for: form.best_for.trim() || null,
        deal_size: form.deal_size.trim() || null,
        tone: form.tone,
        default_goals: form.default_goals.trim() || null,
        default_deliverables: form.default_deliverables.trim() || null,
        project_scope: form.project_scope,
        budget: form.budget,
        timeline: form.timeline,
        notes: form.notes,
        icon: form.icon,
        accent: form.accent,
      };

      if (isCustomEdit && template?.rowId) {
        const { error } = await supabase
          .from("proposal_templates")
          .update(payload)
          .eq("id", template.rowId);
        if (error) throw error;
      } else if (isOverrideEdit && template?.id) {
        // Upsert into builtin override
        const { error } = await supabase
          .from("proposal_templates")
          .upsert(
            { ...payload, builtin_id: template.id, source: "builtin_override" },
            { onConflict: "user_id,builtin_id" }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("proposal_templates")
          .insert({ ...payload, source: "custom" });
        if (error) throw error;
      }

      toast({ title: "Template saved" });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not save template", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
          <DialogDescription>
            Set the defaults that will pre-fill the New Proposal form when this template is chosen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Template name</Label>
              <Input id="t-name" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. SEO Retainer Pitch" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-service">Service type</Label>
              <Input id="t-service" value={form.service_type} onChange={(e) => setField("service_type", e.target.value)} placeholder="e.g. SEO & Content" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Short description</Label>
            <Textarea id="t-desc" value={form.description} onChange={(e) => setField("description", e.target.value)} rows={2} placeholder="One sentence describing what this template covers." />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <Select value={form.icon} onValueChange={(v) => setField("icon", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Colour</Label>
              <Select value={form.accent} onValueChange={(v) => setField("accent", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select value={form.tone} onValueChange={(v) => setField("tone", v as TemplateFormValues["tone"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="persuasive">Persuasive</SelectItem>
                  <SelectItem value="concise">Concise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Best for</Label>
              <Input value={form.best_for} onChange={(e) => setField("best_for", e.target.value)} placeholder="e.g. Agencies & Studios" />
            </div>
            <div className="space-y-1.5">
              <Label>Typical deal size</Label>
              <Input value={form.deal_size} onChange={(e) => setField("deal_size", e.target.value)} placeholder="e.g. £1K–£5K" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Default goals</Label>
            <Textarea value={form.default_goals} onChange={(e) => setField("default_goals", e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Default deliverables</Label>
            <Textarea value={form.default_deliverables} onChange={(e) => setField("default_deliverables", e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Project scope</Label>
            <Textarea value={form.project_scope} onChange={(e) => setField("project_scope", e.target.value)} rows={3} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Default budget</Label>
              <Input value={form.budget} onChange={(e) => setField("budget", e.target.value)} placeholder="e.g. £1,500" />
            </div>
            <div className="space-y-1.5">
              <Label>Default timeline</Label>
              <Input value={form.timeline} onChange={(e) => setField("timeline", e.target.value)} placeholder="e.g. 3 weeks" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Internal notes</Label>
            <Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
