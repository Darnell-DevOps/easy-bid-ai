import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Loader2, Download, FileText, ExternalLink, User, Briefcase, Pencil,
  CheckCircle2, Send, BellRing,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import FieldListEditor from "@/components/forms/FieldListEditor";
import {
  groupFields,
  onboardingProgress,
  onboardingStatusLabel,
  type OnboardingFormRow,
} from "@/lib/onboarding";
import { parseFilePayload, parseFilePayloads, type FilePayload, type SmartField } from "@/lib/form-fields";
import { useToast } from "@/hooks/use-toast";
import { getPrimaryCustomDomain, buildPublicUrl } from "@/lib/customDomain";

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function OnboardingResponseDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [form, setForm] = useState<OnboardingFormRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editedFields, setEditedFields] = useState<SmartField[]>([]);
  const [saving, setSaving] = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);
  const [sending, setSending] = useState(false);
  const [reminding, setReminding] = useState(false);

  const openEditor = () => {
    if (!form) return;
    setEditedFields(JSON.parse(JSON.stringify(form.fields)) as SmartField[]);
    setEditOpen(true);
  };

  const saveFields = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase
      .from("onboarding_forms")
      .update({ fields: editedFields as any })
      .eq("id", form.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setForm({ ...form, fields: editedFields });
    setEditOpen(false);
    toast({ title: "Questions updated" });
  };

  const markReviewed = async () => {
    if (!form) return;
    setMarkingReviewed(true);
    const { error } = await supabase.rpc("onboarding_mark_reviewed" as any, { _form_id: form.id });
    setMarkingReviewed(false);
    if (error) {
      toast({ title: "Could not mark reviewed", description: error.message, variant: "destructive" });
      return;
    }
    setForm({ ...form, reviewed_at: new Date().toISOString() });
    toast({ title: "Marked as reviewed" });
  };

  const buildOnboardingUrl = async (): Promise<string> => {
    if (!form) return "";
    const { domain, useForForms } = await getPrimaryCustomDomain(form.user_id);
    return buildPublicUrl({
      customDomain: useForForms ? domain : null,
      path: `/onboard/${form.access_token}`,
    });
  };

  const sendOnboarding = async (kind: "welcome" | "reminder") => {
    if (!form) return;
    if (!form.client_email) {
      toast({ title: "No client email on file", description: "Add a client email before sending.", variant: "destructive" });
      return;
    }
    const setBusy = kind === "welcome" ? setSending : setReminding;
    setBusy(true);
    try {
      const url = await buildOnboardingUrl();
      const templateName = kind === "welcome" ? "onboarding-welcome" : "onboarding-reminder";
      const idempotencyKey =
        kind === "welcome"
          ? `onboarding-welcome-${form.id}`
          : `onboarding-remind-manual-${form.id}-${new Date().toISOString().slice(0, 10)}`;
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          templateName,
          recipientEmail: form.client_email,
          userId: form.user_id,
          idempotencyKey,
          data: { client_name: form.client_name, onboarding_link: url },
        },
      });
      const ok = (data as any)?.ok === true;
      if (error || !ok) {
        const reason =
          (data as any)?.suppressed ? "Recipient is suppressed"
          : (data as any)?.error || (error as any)?.message || "Send failed";
        toast({ title: "Send failed", description: reason, variant: "destructive" });
        return;
      }
      const now = new Date().toISOString();
      if (kind === "welcome") {
        await supabase.from("onboarding_forms").update({ sent_at: now }).eq("id", form.id).is("sent_at", null);
        setForm({ ...form, sent_at: form.sent_at ?? now });
        toast({
          title: (data as any)?.deduped ? "Already sent" : "Onboarding sent",
          description: (data as any)?.deduped ? "This welcome email was already delivered." : undefined,
        });
      } else {
        await supabase.from("onboarding_forms").update({ reminded_at: now }).eq("id", form.id);
        setForm({ ...form, reminded_at: now });
        toast({
          title: (data as any)?.deduped ? "Reminder already sent today" : "Reminder sent",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      const { data } = await supabase
        .from("onboarding_forms")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!alive) return;
      setForm(((data as unknown) as OnboardingFormRow) || null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  const download = async (payload: FilePayload) => {
    try {
      setDownloadingPath(payload.path);
      const { data, error } = await supabase.functions.invoke("form-upload-signed-read", {
        body: { path: payload.path },
      });
      if (error || !(data as any)?.url) {
        toast({ title: "Download failed", description: (error as any)?.message || "Could not sign URL", variant: "destructive" });
        return;
      }
      window.open((data as any).url, "_blank", "noopener");
    } finally {
      setDownloadingPath(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!form) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/dashboard/onboarding"><ArrowLeft className="w-3.5 h-3.5" /> Back to onboarding</Link>
          </Button>
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Onboarding form not found.</CardContent></Card>
        </div>
      </DashboardLayout>
    );
  }

  const progress = onboardingProgress({ fields: form.fields, responses: form.responses });
  const grouped = groupFields(form.fields);
  const statusTone =
    form.status === "completed" ? "border-emerald-500/40 text-emerald-500"
    : form.status === "in_progress" ? "border-blue-500/40 text-blue-500"
    : "border-amber-500/40 text-amber-500";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/dashboard/onboarding"><ArrowLeft className="w-3.5 h-3.5" /> Back to onboarding</Link>
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            {form.client_id && (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link to={`/dashboard/clients/${form.client_id}`}><User className="w-3.5 h-3.5" /> View client</Link>
              </Button>
            )}
            {form.proposal_id && (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link to={`/dashboard/proposal/${form.proposal_id}`}><Briefcase className="w-3.5 h-3.5" /> View proposal</Link>
              </Button>
            )}
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a href={`/onboard/${form.access_token}`} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3.5 h-3.5" /> Open client form
              </a>
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={openEditor}>
              <Pencil className="w-3.5 h-3.5" /> Edit questions
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-xl">{form.client_name || "Client"}</CardTitle>
                {!form.client_id && form.client_name && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted/60 font-normal mt-1">
                    Client deleted
                  </Badge>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {form.service_type || "Project"}
                  {form.client_email ? ` · ${form.client_email}` : ""}
                </p>
              </div>
              <Badge variant="outline" className={`text-[11px] ${statusTone}`}>
                {onboardingStatusLabel(form.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div><span className="text-foreground font-medium">Created:</span> {new Date(form.created_at).toLocaleString()}</div>
              <div><span className="text-foreground font-medium">Started:</span> {form.started_at ? new Date(form.started_at).toLocaleString() : "—"}</div>
              <div><span className="text-foreground font-medium">Completed:</span> {form.completed_at ? new Date(form.completed_at).toLocaleString() : "—"}</div>
            </div>
          </CardContent>
        </Card>

        {grouped.map((g) => (
          <Card key={g.group}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">{g.group}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {g.fields.map((field) => {
                const raw = form.responses?.[field.id];
                if (field.type === "file") {
                  const renderRow = (payload: FilePayload, key: string) => (
                    <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
                      <div className="w-9 h-9 rounded-md bg-purple/15 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-purple" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{payload.name}</p>
                        <p className="text-[11px] text-muted-foreground">{formatBytes(payload.size)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => download(payload)}
                        disabled={downloadingPath === payload.path}
                      >
                        {downloadingPath === payload.path
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Download className="w-3.5 h-3.5" />}
                        Download
                      </Button>
                    </div>
                  );
                  if (field.multiple) {
                    const list = parseFilePayloads(raw);
                    return (
                      <div key={field.id} className="space-y-1.5">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{field.label}</p>
                        {list.length > 0 ? (
                          <div className="space-y-2">
                            {list.map((p, idx) => renderRow(p, `${p.path}-${idx}`))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">Not uploaded yet</p>
                        )}
                      </div>
                    );
                  }
                  const payload = parseFilePayload(raw);
                  return (
                    <div key={field.id} className="space-y-1.5">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{field.label}</p>
                      {payload ? renderRow(payload, payload.path) : (
                        <p className="text-sm text-muted-foreground italic">Not uploaded yet</p>
                      )}
                    </div>
                  );
                }
                const display = raw == null || (typeof raw === "string" && !raw.trim())
                  ? null
                  : Array.isArray(raw) ? raw.join(", ") : String(raw);
                return (
                  <div key={field.id} className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{field.label}</p>
                    {display ? (
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">{display}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No answer yet</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit onboarding questions</DialogTitle>
            <DialogDescription>
              {form.status === "completed"
                ? "This client has already completed onboarding — they won't be prompted again unless they revisit the link."
                : "The client will see these updated questions next time they open their onboarding link."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <FieldListEditor
              fields={editedFields}
              onChange={setEditedFields}
              context="onboarding"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveFields} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
