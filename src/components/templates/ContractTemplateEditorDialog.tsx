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
import { CONTRACT_TYPES, type ContractType } from "@/lib/contracts";
import {
  CONTRACT_ACCENT_OPTIONS,
  CONTRACT_ICON_OPTIONS,
  EMPTY_CONTRACT_FORM,
  templateToContractForm,
  type ContractTemplateFormValues,
  type MergedContractTemplate,
} from "@/lib/contract-templates";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template?: MergedContractTemplate;
  initial?: Partial<ContractTemplateFormValues>;
  forceCreate?: boolean;
  onSaved?: () => void;
}

export default function ContractTemplateEditorDialog({
  open,
  onOpenChange,
  template,
  initial,
  forceCreate,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<ContractTemplateFormValues>(EMPTY_CONTRACT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setForm({ ...templateToContractForm(template), ...(initial || {}) });
    } else {
      setForm({ ...EMPTY_CONTRACT_FORM, ...(initial || {}) });
    }
  }, [open, template, initial]);

  const setField = <K extends keyof ContractTemplateFormValues>(k: K, v: ContractTemplateFormValues[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isOverrideEdit = !!template && template.source === "builtin" && !forceCreate;
  const isCustomEdit = !!template?.rowId && !forceCreate && template.source !== "builtin";
  const titleText = isOverrideEdit
    ? `Customize "${template?.name}"`
    : isCustomEdit
    ? `Edit "${template?.name}"`
    : "Create contract template";

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
        contract_type: form.contract_type,
        service_type: form.service_type.trim() || null,
        best_for: form.best_for.trim() || null,
        default_scope: form.default_scope,
        default_timeline: form.default_timeline,
        default_budget: form.default_budget,
        default_payment_terms: form.default_payment_terms,
        extra_clauses: form.extra_clauses,
        icon: form.icon,
        accent: form.accent,
      };

      if (isCustomEdit && template?.rowId) {
        const { error } = await supabase
          .from("contract_templates")
          .update(payload)
          .eq("id", template.rowId);
        if (error) throw error;
      } else if (isOverrideEdit && template?.id) {
        const { error } = await supabase
          .from("contract_templates")
          .upsert(
            { ...payload, builtin_id: template.id, source: "builtin_override" },
            { onConflict: "user_id,builtin_id" }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contract_templates")
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
            Set the defaults that will pre-fill the New Contract form when this template is chosen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ct-name">Template name</Label>
              <Input id="ct-name" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Boutique Web Design Contract" />
            </div>
            <div className="space-y-1.5">
              <Label>Contract type</Label>
              <Select value={form.contract_type} onValueChange={(v) => setField("contract_type", v as ContractType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Short description</Label>
            <Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={2} />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Service type</Label>
              <Input value={form.service_type} onChange={(e) => setField("service_type", e.target.value)} placeholder="e.g. Web Design" />
            </div>
            <div className="space-y-1.5">
              <Label>Best for</Label>
              <Input value={form.best_for} onChange={(e) => setField("best_for", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tone (icon)</Label>
              <Select value={form.icon} onValueChange={(v) => setField("icon", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_ICON_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Colour</Label>
            <Select value={form.accent} onValueChange={(v) => setField("accent", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTRACT_ACCENT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Default scope</Label>
            <Textarea value={form.default_scope} onChange={(e) => setField("default_scope", e.target.value)} rows={4} />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Default timeline</Label>
              <Input value={form.default_timeline} onChange={(e) => setField("default_timeline", e.target.value)} placeholder="e.g. 4 weeks" />
            </div>
            <div className="space-y-1.5">
              <Label>Default fee</Label>
              <Input value={form.default_budget} onChange={(e) => setField("default_budget", e.target.value)} placeholder="e.g. £4,500" />
            </div>
            <div className="space-y-1.5">
              <Label>Payment terms</Label>
              <Input value={form.default_payment_terms} onChange={(e) => setField("default_payment_terms", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Additional clauses (markdown — incorporated into the contract)</Label>
            <Textarea value={form.extra_clauses} onChange={(e) => setField("extra_clauses", e.target.value)} rows={5} placeholder="- Hosting and domains are the Client's responsibility..." />
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
