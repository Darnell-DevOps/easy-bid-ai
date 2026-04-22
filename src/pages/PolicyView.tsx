import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, RefreshCw, Save, AlertTriangle, Pencil, Eye } from "lucide-react";

interface Policy {
  id: string;
  business_name: string;
  business_type: string;
  country: string;
  policy_type: string;
  services_offered: string | null;
  payment_methods: string | null;
  refund_rules: string | null;
  data_collection: string | null;
  special_requirements: string | null;
  content: string;
}

function renderMarkdown(md: string) {
  // Lightweight markdown -> HTML for headings, bold, lists, paragraphs.
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${line.replace(/^### /, "")}</h3>`);
    } else if (/^## /.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${line.replace(/^## /, "")}</h2>`);
    } else if (/^# /.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h1>${line.replace(/^# /, "")}</h1>`);
    } else if (/^[-*] /.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${line.replace(/^[-*] /, "")}</li>`);
    } else if (line.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("");
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${line}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

export default function PolicyView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data, error } = await supabase.from("policies").select("*").eq("id", id).maybeSingle();
      if (error) return toast.error(error.message);
      if (!data) return toast.error("Policy not found");
      setPolicy(data as Policy);
      setContent(data.content);
    })();
  }, [id]);

  const handleSave = async () => {
    if (!policy) return;
    setSaving(true);
    const { error } = await supabase.from("policies").update({ content }).eq("id", policy.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(false);
    setPolicy({ ...policy, content });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  const handleDownload = () => {
    if (!policy) return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${policy.business_name}-${policy.policy_type}.txt`.replace(/\s+/g, "-").toLowerCase();
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegenerate = async () => {
    if (!policy) return;
    if (!confirm("Regenerate this policy? Current content will be replaced.")) return;
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-policy", {
        body: {
          business_name: policy.business_name,
          business_type: policy.business_type,
          country: policy.country,
          policy_type: policy.policy_type,
          services_offered: policy.services_offered,
          payment_methods: policy.payment_methods,
          refund_rules: policy.refund_rules,
          data_collection: policy.data_collection,
          special_requirements: policy.special_requirements,
        },
      });
      if (error) throw error;
      const newContent = (data as { content?: string })?.content;
      if (!newContent) throw new Error("No content returned");
      const { error: upErr } = await supabase.from("policies").update({ content: newContent }).eq("id", policy.id);
      if (upErr) throw upErr;
      setContent(newContent);
      setPolicy({ ...policy, content: newContent });
      toast.success("Policy regenerated");
    } catch (e: any) {
      toast.error(e?.message ?? "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  if (!policy) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Loading…</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/policies")} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to policies
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{policy.business_name}</h1>
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary">{policy.policy_type}</Badge>
            <Badge variant="outline">{policy.country}</Badge>
            <Badge variant="outline">{policy.business_type}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="w-4 h-4 mr-2" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" /> Download
          </Button>
          <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
            <RefreshCw className={`w-4 h-4 mr-2 ${regenerating ? "animate-spin" : ""}`} />
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>
          {editing ? (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save"}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-4 h-4 mr-2" /> Edit
            </Button>
          )}
        </div>
      </div>

      <Alert className="mb-6 border-destructive/30 bg-destructive/5">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <AlertDescription className="text-sm">
          This policy is generated by AI and may not fully comply with all legal requirements.
          Please review with a qualified legal professional before using.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="p-8">
          {editing ? (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[600px] font-mono text-sm"
            />
          ) : (
            <article
              className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h2:mt-8 prose-h2:mb-3 prose-h3:mt-6 prose-h3:mb-2 prose-p:leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}
        </CardContent>
      </Card>

      {!editing && (
        <p className="text-xs text-muted-foreground mt-4 flex items-center gap-2">
          <Eye className="w-3 h-3" /> Preview rendered from AI markdown output.
        </p>
      )}
    </DashboardLayout>
  );
}
