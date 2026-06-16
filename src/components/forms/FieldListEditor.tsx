import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, Trash2, Plus, Sparkles, GripVertical } from "lucide-react";
import {
  ALL_FIELD_TYPES, FIELD_TYPE_LABELS, newFieldId,
  type SmartField, type ConditionOperator,
} from "@/lib/form-fields";
import AiGenerateFieldsDialog from "./AiGenerateFieldsDialog";

interface Props {
  fields: SmartField[];
  onChange: (fields: SmartField[]) => void;
  context?: "onboarding" | "lead";
}

const OPERATORS: { value: ConditionOperator; label: string; needsValue: boolean }[] = [
  { value: "equals", label: "equals", needsValue: true },
  { value: "not_equals", label: "does not equal", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "is_empty", label: "is empty", needsValue: false },
  { value: "is_not_empty", label: "is not empty", needsValue: false },
];

export default function FieldListEditor({ fields, onChange, context = "onboarding" }: Props) {
  const [aiOpen, setAiOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const update = (idx: number, patch: Partial<SmartField>) => {
    const next = fields.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= fields.length) return;
    const next = fields.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = fields.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const add = () => {
    const f: SmartField = {
      id: newFieldId(),
      label: "New question",
      type: "short_text",
      group: "Details",
    };
    onChange([...fields, f]);
    setExpanded(f.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Form fields ({fields.length})</Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setAiOpen(true)} className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Generate with AI
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={add} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add field
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {fields.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
            No fields yet. Add one or use <span className="text-foreground font-medium">Generate with AI</span>.
          </div>
        )}

        {fields.map((field, idx) => {
          const isOpen = expanded === field.id;
          const needsOptions = field.type === "select" || field.type === "radio" || field.type === "multi_select";
          return (
            <div key={field.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 p-2.5">
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                <Input
                  value={field.label}
                  onChange={(e) => update(idx, { label: e.target.value })}
                  className="h-8 text-sm flex-1"
                  placeholder="Field label"
                />
                <Select value={field.type} onValueChange={(v) => update(idx, { type: v as SmartField["type"] })}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_FIELD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5 px-1">
                  <Switch
                    checked={!!field.required}
                    onCheckedChange={(v) => update(idx, { required: v })}
                  />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Req</span>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(idx, -1)}>
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(idx, 1)}>
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-rose-500 hover:text-rose-600" onClick={() => remove(idx)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpanded(isOpen ? null : field.id)}>
                  {isOpen ? "Hide" : "Options"}
                </Button>
              </div>

              {isOpen && (
                <div className="border-t border-border p-3 space-y-3 bg-muted/20">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Group / section</Label>
                      <Input
                        value={field.group || ""}
                        onChange={(e) => update(idx, { group: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Details"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Placeholder</Label>
                      <Input
                        value={field.placeholder || ""}
                        onChange={(e) => update(idx, { placeholder: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Help text</Label>
                    <Input
                      value={field.helpText || ""}
                      onChange={(e) => update(idx, { helpText: e.target.value })}
                      className="h-8 text-sm"
                      placeholder="Optional hint shown below the field"
                    />
                  </div>

                  {needsOptions && (
                    <div className="space-y-1">
                      <Label className="text-xs">Options (one per line)</Label>
                      <Textarea
                        value={(field.options || []).join("\n")}
                        onChange={(e) =>
                          update(idx, {
                            options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        rows={3}
                        className="text-sm font-mono"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">Conditional display</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">Show when</span>
                      <Select
                        value={field.condition?.fieldId || "__none__"}
                        onValueChange={(v) =>
                          update(idx, {
                            condition: v && v !== "__none__"
                              ? { fieldId: v, operator: field.condition?.operator || "equals", value: field.condition?.value || "" }
                              : null,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Always show" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Always show</SelectItem>
                          {fields.filter((_, i) => i !== idx).map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.condition?.fieldId && (
                        <>
                          <Select
                            value={field.condition.operator}
                            onValueChange={(v) =>
                              update(idx, {
                                condition: { ...field.condition!, operator: v as ConditionOperator },
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {OPERATORS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {OPERATORS.find((o) => o.value === field.condition!.operator)?.needsValue && (
                            <Input
                              value={field.condition.value || ""}
                              onChange={(e) =>
                                update(idx, {
                                  condition: { ...field.condition!, value: e.target.value },
                                })
                              }
                              className="h-8 text-sm w-[160px]"
                              placeholder="value"
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AiGenerateFieldsDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        context={context}
        onGenerated={(generated, mode) => {
          if (mode === "replace") onChange(generated);
          else onChange([...fields, ...generated]);
        }}
      />
    </div>
  );
}
