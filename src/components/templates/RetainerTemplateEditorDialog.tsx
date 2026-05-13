import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  EMPTY_RETAINER_FORM,
  RETAINER_ACCENT_OPTIONS,
  RETAINER_ICON_OPTIONS,
  templateToRetainerForm,
  type MergedRetainerTemplate,
  type RetainerTemplateFormValues,
} from "@/lib/retainer-templates";
import { CURRENCIES } from "@/lib/retainers";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template?: MergedRetainerTemplate;
  initial?: Partial<RetainerTemplateFormValues>;
  forceCreate?: boolean;
  onSaved?: () => void;
}

export default function RetainerTemplateEditorDialog({
  open,
  onOpenChange,
  template,
  initial,
  forceCreate,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<RetainerTemplateFormValues>(EMPTY_RETAINER_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setForm({ ...templateToRetainerForm(template), ...(initial || {}) });
    } else {
      setForm({ ...EMPTY_RETAINER_FORM, ...(initial || {}) });
    }
  }, [open, template, initial]);

  const setField = <K extends keyof RetainerTemplateFormValues>(k: K, v: RetainerTemplateFormValues[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isOverrideEdit = !!template && template.source === "builtin" && !forceCreate;
  const isCustomEdit = !!template?.rowId && !forceCreate && template.source !== "builtin";
  const titleText = isOverrideEdit
    ? `Customize "${template?.name}"`
    : isCustomEdit
    ? `Edit "${template?.name}"`
    : "Create retainer template";

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const amountNum = parseFloat(form.default_amount || "0");
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Not signed in");

      const payload: any = {
        user_id: userId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        service_type: form.service_type.trim() || null,
        best_for: form.best_for.trim() || null,
        default_amount_cents: Math.round(amountNum * 100),
        default_currency: form.default_currency,
        default_interval: form.default_interval,
        default_custom_days:
          form.default_interval === "custom"
            ? Math.max(1, parseInt(form.default_custom_days || "30"))
            : null,
        default_bullets: form.default_bullets,
        notes: form.notes,
        icon: form.icon,
        accent: form.accent,
      };

      if (isCustomEdit && template?.rowId) {
        const { error } = await supabase
          .from("retainer_templates" as any)
          .update(payload)
          .eq("id", template.rowId);
        if (error) throw error;
      } else if (isOverrideEdit && template?.id) {
        const { error } = await supabase
          .from("retainer_templates" as any)
          .upsert(
            { ...payload, builtin_id: template.id, source: "builtin_override" },
            { onConflict: "user_id,builtin_id" }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("retainer_templates" as any)
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
            Set the defaults that will pre-fill the New Retainer form when this template is chosen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Template name</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Premium SEO Retainer" />
            </div>
            <div className="space-y-1.5">
              <Label>Service type</Label>
              <Input value={form.service_type} onChange={(e) => setField("service_type", e.target.value)} placeholder="e.g. SEO" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Short description</Label>
            <Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={2} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <Select value={form.icon} onValueChange={(v) => setField("icon", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RETAINER_ICON_OPTIONS.map((o) => (
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
                  {RETAINER_ACCENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Best for</Label>
            <Input value={form.best_for} onChange={(e) => setField("best_for", e.target.value)} placeholder="e.g. Agencies & studios" />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Default amount</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={form.default_amount}
                onChange={(e) => setField("default_amount", e.target.value)}
                placeholder="750"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.default_currency} onValueChange={(v) => setField("default_currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select
                value={form.default_interval}
                onValueChange={(v) => setField("default_interval", v as RetainerTemplateFormValues["default_interval"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="custom">Custom (days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.default_interval === "custom" && (
            <div className="space-y-1.5">
              <Label>Every X days</Label>
              <Input
                type="number"
                value={form.default_custom_days}
                onChange={(e) => setField("default_custom_days", e.target.value)}
                min={1}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>What's included (one item per line)</Label>
            <Textarea
              value={form.default_bullets}
              onChange={(e) => setField("default_bullets", e.target.value)}
              rows={5}
              placeholder="Monthly strategy session\n8 reserved hours\nMonthly performance report"
            />
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
