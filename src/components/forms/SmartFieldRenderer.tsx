import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  parseFilePayload, serializeFilePayload,
  parseFilePayloads, serializeFilePayloads,
  type SmartField, type FieldResponses, type FilePayload,
} from "@/lib/form-fields";

interface FormContext {
  /** Onboarding access token (anon) */
  token?: string;
  /** Public lead form slug (anon) */
  slug?: string;
}

interface Props {
  field: SmartField;
  value: string | string[] | boolean | undefined;
  onChange: (v: string | string[] | boolean) => void;
  formContext?: FormContext;
}

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

const MULTI_CAP = 5;

function FileFieldInput({ field, value, onChange, formContext }: Props) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxBytes = (field.maxSizeMb || 20) * 1024 * 1024;
  const isMulti = !!field.multiple;

  const existingSingle: FilePayload | null = isMulti ? null : parseFilePayload(value);
  const existingList: FilePayload[] = isMulti ? parseFilePayloads(value) : [];

  const pick = () => inputRef.current?.click();

  const uploadOne = async (file: File): Promise<FilePayload | null> => {
    if (file.size > maxBytes) {
      toast({
        title: "File too large",
        description: `Max ${field.maxSizeMb || 20} MB.`,
        variant: "destructive",
      });
      return null;
    }
    if (!formContext?.token && !formContext?.slug) {
      toast({
        title: "Upload unavailable",
        description: "Form context is missing — please reload and try again.",
        variant: "destructive",
      });
      return null;
    }
    const { data, error } = await supabase.functions.invoke("form-upload-sign", {
      body: {
        token: formContext.token,
        slug: formContext.slug,
        field_id: field.id,
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size: file.size,
      },
    });
    if (error) throw error;
    const payload = data as { path: string; upload_url: string };
    if (!payload?.upload_url) throw new Error("No signed URL returned");

    const res = await fetch(payload.upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);

    return {
      path: payload.path,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
    };
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const final = await uploadOne(file);
      if (!final) return;
      if (isMulti) {
        onChange(serializeFilePayloads([...existingList, final]));
      } else {
        onChange(serializeFilePayload(final));
      }
    } catch (e: any) {
      toast({
        title: "Upload failed",
        description: e?.message || String(e),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clear = () => onChange("");
  const removeAt = (idx: number) => {
    const next = existingList.filter((_, i) => i !== idx);
    onChange(serializeFilePayloads(next));
  };

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept={field.accept}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
      }}
    />
  );

  if (isMulti) {
    const atCap = existingList.length >= MULTI_CAP;
    return (
      <div className="space-y-2">
        {hiddenInput}
        {existingList.map((p, idx) => (
          <div key={`${p.path}-${idx}`} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2.5">
            <FileText className="w-4 h-4 text-purple shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-foreground truncate">{p.name}</div>
              <div className="text-[11px] text-muted-foreground">{formatBytes(p.size)}</div>
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => removeAt(idx)} disabled={uploading} className="h-7 w-7">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={pick}
          disabled={uploading || atCap}
          className="w-full justify-start gap-2 h-10"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          {uploading ? "Uploading…" : atCap ? "Maximum reached" : (existingList.length === 0 ? (field.placeholder || "Add a file") : "Add another file")}
        </Button>
        <p className="text-[11px] text-muted-foreground">Up to {MULTI_CAP} files.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hiddenInput}
      {existingSingle ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2.5">
          <FileText className="w-4 h-4 text-purple shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground truncate">{existingSingle.name}</div>
            <div className="text-[11px] text-muted-foreground">{formatBytes(existingSingle.size)}</div>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={pick} disabled={uploading}>
            Replace
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={clear} disabled={uploading} className="h-7 w-7">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={pick}
          disabled={uploading}
          className="w-full justify-start gap-2 h-10"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          {uploading ? "Uploading…" : field.placeholder || "Choose a file"}
        </Button>
      )}
    </div>
  );
}

export default function SmartFieldRenderer({ field, value, onChange, formContext }: Props) {
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
    case "file":
      return <FileFieldInput field={field} value={value} onChange={onChange} formContext={formContext} />;
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

// Re-export so callers can import the type alongside the component
export type { FieldResponses };
