import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { newFieldId, type SmartField, ALL_FIELD_TYPES } from "@/lib/form-fields";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  context: "onboarding" | "lead";
  onGenerated: (fields: SmartField[], mode: "append" | "replace") => void;
}

export default function AiGenerateFieldsDialog({ open, onOpenChange, context, onGenerated }: Props) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<SmartField[] | null>(null);

  const run = async () => {
    if (!prompt.trim()) {
      toast({ title: "Describe the form", description: "Tell the AI what fields you need.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-form", {
        body: { prompt, context },
      });
      if (error) throw error;
      const fields = Array.isArray(data?.fields) ? (data.fields as any[]) : [];
      if (!fields.length) throw new Error("AI returned no fields");
      const normalized: SmartField[] = fields
        .map((f) => normalize(f))
        .filter(Boolean) as SmartField[];
      if (!normalized.length) throw new Error("AI returned invalid fields");
      setPreview(normalized);
    } catch (e: any) {
      toast({ title: "AI generation failed", description: e.message || String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const apply = (mode: "append" | "replace") => {
    if (!preview) return;
    onGenerated(preview, mode);
    setPreview(null);
    setPrompt("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setPreview(null); setPrompt(""); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple" /> Generate fields with AI
          </DialogTitle>
          <DialogDescription>
            Describe the form you need and AI will draft the fields. You can edit them afterward.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Describe your form</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder={
                context === "lead"
                  ? "e.g. A short intake form for new web design leads: name, email, company, what they need, budget range (under $5k / $5-15k / $15k+), preferred timeline."
                  : "e.g. Onboarding for a new branding client: company info, target audience, brand values, style references, existing assets, deadline."
              }
            />
          </div>

          {preview && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Preview · {preview.length} fields</p>
              <ul className="space-y-1 text-sm">
                {preview.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs w-32 truncate">{f.group || "Details"}</span>
                    <span className="text-foreground flex-1 truncate">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.type}{f.required ? " · req" : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          {!preview ? (
            <Button onClick={run} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => apply("append")}>Append</Button>
              <Button onClick={() => apply("replace")}>Replace</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function normalize(raw: any): SmartField | null {
  if (!raw || typeof raw !== "object") return null;
  const label = String(raw.label || "").trim();
  if (!label) return null;
  let type = String(raw.type || "short_text").trim() as SmartField["type"];
  if (!ALL_FIELD_TYPES.includes(type)) type = "short_text";
  const options = Array.isArray(raw.options) ? raw.options.map((o: any) => String(o)).filter(Boolean) : undefined;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newFieldId(),
    label,
    type,
    placeholder: raw.placeholder ? String(raw.placeholder) : undefined,
    helpText: raw.helpText ? String(raw.helpText) : undefined,
    required: !!raw.required,
    options,
    group: raw.group ? String(raw.group) : "Details",
  };
}
