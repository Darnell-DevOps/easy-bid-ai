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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import AiGenerateFieldsDialog from "@/components/forms/AiGenerateFieldsDialog";
import type { SmartField } from "@/lib/form-fields";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  EMPTY_ONBOARDING_FORM,
  ONBOARDING_ACCENT_OPTIONS,
  ONBOARDING_ICON_OPTIONS,
  parseDeadlinesText,
  parseFieldsText,
  parseFileRequestsText,
  templateToOnboardingForm,
  type MergedOnboardingTemplate,
  type OnboardingTemplateFormValues,
} from "@/lib/onboarding-templates";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template?: MergedOnboardingTemplate;
  initial?: Partial<OnboardingTemplateFormValues>;
  forceCreate?: boolean;
  onSaved?: () => void;
}

export default function OnboardingTemplateEditorDialog({
  open,
  onOpenChange,
  template,
  initial,
  forceCreate,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<OnboardingTemplateFormValues>(EMPTY_ONBOARDING_FORM);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const fieldsToText = (fields: SmartField[]): string =>
    fields
      .map((f) => {
        const parts = [f.label, f.type];
        if (f.required) parts.push("required");
        return parts.join(" | ");
      })
      .join("\n");

  const handleAiGenerated = (fields: SmartField[], mode: "append" | "replace") => {
    const generated = fieldsToText(fields);
    setForm((prev) => ({
      ...prev,
      fields_text:
        mode === "replace" || !prev.fields_text.trim()
          ? generated
          : `${prev.fields_text.trimEnd()}\n${generated}`,
    }));
  };

  useEffect(() => {
    if (!open) return;
    if (template) {
      setForm({ ...templateToOnboardingForm(template), ...(initial || {}) });
    } else {
      setForm({ ...EMPTY_ONBOARDING_FORM, ...(initial || {}) });
    }
  }, [open, template, initial]);

  const setField = <K extends keyof OnboardingTemplateFormValues>(
    k: K,
    v: OnboardingTemplateFormValues[K],
  ) => setForm((f) => ({ ...f, [k]: v }));

  const isOverrideEdit = !!template && template.source === "builtin" && !forceCreate;
  const isCustomEdit = !!template?.rowId && !forceCreate && template.source !== "builtin";
  const titleText = isOverrideEdit
    ? `Customize "${template?.name}"`
    : isCustomEdit
    ? `Edit "${template?.name}"`
    : "Create onboarding template";

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

      const payload: any = {
        user_id: userId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        service_type: form.service_type.trim() || null,
        best_for: form.best_for.trim() || null,
        intro: form.intro,
        fields: parseFieldsText(form.fields_text),
        file_requests: parseFileRequestsText(form.file_requests_text),
        deadlines: parseDeadlinesText(form.deadlines_text),
        notes: form.notes,
        icon: form.icon,
        accent: form.accent,
      };

      if (isCustomEdit && template?.rowId) {
        const { error } = await supabase
          .from("onboarding_templates" as any)
          .update(payload)
          .eq("id", template.rowId);
        if (error) throw error;
      } else if (isOverrideEdit && template?.id) {
        const { error } = await supabase
          .from("onboarding_templates" as any)
          .upsert(
            { ...payload, builtin_id: template.id, source: "builtin_override" },
            { onConflict: "user_id,builtin_id" },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("onboarding_templates" as any)
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
            Edit the questions, file requests, deadlines and kickoff message. Saved templates
            appear in the gallery.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Template name</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Service type</Label>
              <Input
                value={form.service_type}
                onChange={(e) => setField("service_type", e.target.value)}
                placeholder="e.g. Web Design"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Short description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <Select value={form.icon} onValueChange={(v) => setField("icon", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ONBOARDING_ICON_OPTIONS.map((o) => (
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
                  {ONBOARDING_ACCENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Best for</Label>
            <Input
              value={form.best_for}
              onChange={(e) => setField("best_for", e.target.value)}
              placeholder="e.g. Designers & studios"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kickoff instructions (shown at the top of the form)</Label>
            <Textarea
              value={form.intro}
              onChange={(e) => setField("intro", e.target.value)}
              rows={3}
              placeholder="Welcome — share the details below and we'll book a kickoff call this week."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Onboarding questions</Label>
            <p className="text-[11px] text-muted-foreground">
              One per line. Format: <code>Question label | type | required</code>. Type is one of
              short_text, long_text, url, email, date, select. The "required" flag is optional.
            </p>
            <Textarea
              value={form.fields_text}
              onChange={(e) => setField("fields_text", e.target.value)}
              rows={6}
              className="font-mono text-xs"
              placeholder={"Top 3 goals for this project | long_text | required\nPreferred launch date | date"}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Files to request</Label>
            <p className="text-[11px] text-muted-foreground">
              One per line. Format: <code>File label — short description</code>. The em dash and
              description are optional.
            </p>
            <Textarea
              value={form.file_requests_text}
              onChange={(e) => setField("file_requests_text", e.target.value)}
              rows={4}
              className="font-mono text-xs"
              placeholder={"Brand logo & lockups — SVG or high-res PNG\nPage copy / content"}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Suggested deadlines</Label>
            <p className="text-[11px] text-muted-foreground">
              One per line. Format: <code>Milestone label | days after kickoff</code>.
            </p>
            <Textarea
              value={form.deadlines_text}
              onChange={(e) => setField("deadlines_text", e.target.value)}
              rows={4}
              className="font-mono text-xs"
              placeholder={"Kickoff call scheduled | 3\nAll assets shared | 7\nDesign sign-off | 28"}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Internal notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={2}
            />
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
