import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { SmartField, FieldResponses } from "@/lib/form-fields";

interface Props {
  field: SmartField;
  value: string | string[] | boolean | undefined;
  onChange: (v: string | string[] | boolean) => void;
}

export default function SmartFieldRenderer({ field, value, onChange }: Props) {
  const id = field.id;
  const opts = field.options || [];

  switch (field.type) {
    case "long_text":
      return (
        <Textarea
          id={id}
          placeholder={field.placeholder}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[90px]"
        />
      );
    case "select":
      return (
        <Select value={(value as string) || ""} onValueChange={onChange as (v: string) => void}>
          <SelectTrigger><SelectValue placeholder={field.placeholder || "Select…"} /></SelectTrigger>
          <SelectContent>
            {opts.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "radio":
      return (
        <RadioGroup
          value={(value as string) || ""}
          onValueChange={onChange as (v: string) => void}
          className="space-y-2"
        >
          {opts.map((o) => (
            <div key={o} className="flex items-center gap-2">
              <RadioGroupItem value={o} id={`${id}-${o}`} />
              <Label htmlFor={`${id}-${o}`} className="font-normal cursor-pointer">{o}</Label>
            </div>
          ))}
        </RadioGroup>
      );
    case "multi_select": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">
          {opts.map((o) => {
            const checked = arr.includes(o);
            return (
              <div key={o} className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-${o}`}
                  checked={checked}
                  onCheckedChange={(c) => {
                    const next = c ? [...arr, o] : arr.filter((x) => x !== o);
                    onChange(next);
                  }}
                />
                <Label htmlFor={`${id}-${o}`} className="font-normal cursor-pointer">{o}</Label>
              </div>
            );
          })}
        </div>
      );
    }
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={id}
            checked={value === true || value === "yes"}
            onCheckedChange={(c) => onChange(c === true)}
          />
          <Label htmlFor={id} className="font-normal cursor-pointer">
            {field.placeholder || field.label}
          </Label>
        </div>
      );
    default: {
      const inputType =
        field.type === "email" ? "email" :
        field.type === "url" ? "url" :
        field.type === "date" ? "date" :
        field.type === "number" ? "number" :
        field.type === "phone" ? "tel" : "text";
      return (
        <Input
          id={id}
          type={inputType}
          placeholder={field.placeholder}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
  }
}
