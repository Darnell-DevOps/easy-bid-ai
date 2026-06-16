import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Copy, ExternalLink, CheckCircle2, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  templateToOnboardingFields,
  type MergedOnboardingTemplate,
} from "@/lib/onboarding-templates";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function computePrefill(
  fields: { id: string; label: string }[],
  intake: Record<string, string> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!intake) return out;
  const labelSlugMap: Record<string, string> = {};
  for (const k of Object.keys(intake)) labelSlugMap[k] = String(intake[k] ?? "");
  for (const f of fields) {
    if (intake[f.id] != null && intake[f.id] !== "") {
      out[f.id] = String(intake[f.id]);
      continue;
    }
    const slug = slugify(f.label);
    if (labelSlugMap[slug] != null && labelSlugMap[slug] !== "") {
      out[f.id] = labelSlugMap[slug];
    }
  }
  return out;
}

interface ClientLite {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  intake_responses?: Record<string, string> | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: MergedOnboardingTemplate | null;
}

export default function CreateOnboardingFromTemplateDialog({
  open,
  onOpenChange,
  template,
}: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientId, setClientId] = useState("__new__");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [usePrefill, setUsePrefill] = useState(true);

  useEffect(() => {
    if (!open) return;
    setClientId("__new__");
    setClientName("");
    setClientEmail("");
    setCreatedToken(null);
    setCreatedId(null);
    setUsePrefill(true);
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, email, company, intake_responses")
        .order("name");
      setClients((data as ClientLite[]) || []);
    })();
  }, [open]);

  const onPickClient = (id: string) => {
    setClientId(id);
    if (id === "__new__") {
      setClientName("");
      setClientEmail("");
      return;
    }
    const c = clients.find((x) => x.id === id);
    if (c) {
      setClientName(c.name);
      setClientEmail(c.email || "");
    }
  };

  const selectedClient = clientId !== "__new__" ? clients.find((c) => c.id === clientId) : null;
  const intake = selectedClient?.intake_responses || null;
  const fieldsForPreview = template ? templateToOnboardingFields(template) : [];
  const prefillPreview = computePrefill(fieldsForPreview, intake);
  const prefillCount = Object.keys(prefillPreview).length;

  const handleCreate = async () => {
    if (!template) return;
    if (!clientName.trim()) {
      toast({ title: "Client name required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      toast({ title: "Not signed in", variant: "destructive" });
      setSubmitting(false);
      return;
    }
    const fields = templateToOnboardingFields(template);
    const prefill = usePrefill ? computePrefill(fields, intake) : {};
    const appliedCount = Object.keys(prefill).length;
    const nowIso = new Date().toISOString();
    const { data, error } = await (supabase.from("onboarding_forms") as any)
      .insert({
        user_id: userId,
        client_id: clientId !== "__new__" ? clientId : null,
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || null,
        service_type: template.service_type || null,
        fields,
        responses: prefill,
        status: appliedCount > 0 ? "in_progress" : "pending",
        started_at: appliedCount > 0 ? nowIso : null,
      })
      .select("id, access_token")
      .single();
    setSubmitting(false);
    if (error) {
      toast({
        title: "Couldn't create onboarding",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setCreatedToken(data.access_token);
    setCreatedId(data.id);
    toast({
      title: "Onboarding created",
      description: appliedCount > 0
        ? `${appliedCount} answer${appliedCount > 1 ? "s" : ""} pre-filled from lead intake.`
        : "Send the link to your client.",
    });
  };

  const link = createdToken ? `${window.location.origin}/onboard/${createdToken}` : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    toast({ title: "Link copied" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {createdToken ? "Onboarding ready" : `Create from "${template?.name}"`}
          </DialogTitle>
          <DialogDescription>
            {createdToken
              ? "Share this link with your client to start the onboarding."
              : "Pick or add a client. We'll build the onboarding from this template."}
          </DialogDescription>
        </DialogHeader>

        {!createdToken ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={onPickClient}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">+ New client</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.company ? `· ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Client name</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Sarah Johnson"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Client email (optional)</Label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="sarah@acme.com"
              />
            </div>
            {prefillCount > 0 && (
              <div className="rounded-lg border border-purple/30 bg-purple/5 p-3 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-purple shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium">Pre-fill from lead intake</Label>
                    <Switch checked={usePrefill} onCheckedChange={setUsePrefill} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {prefillCount} answer{prefillCount > 1 ? "s" : ""} from this client's lead form
                    {usePrefill ? " will be pre-filled." : " will be skipped."}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-xs text-foreground">
                {clientName}'s onboarding is ready. The link below works without a login.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Share this link</Label>
              <div className="flex gap-2">
                <Input value={link} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={copyLink}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!createdToken ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create onboarding
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
              <Button
                variant="outline"
                onClick={() => window.open(link, "_blank")}
                className="gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Preview
              </Button>
              <Button onClick={() => navigate("/dashboard/onboarding")}>
                Open onboarding dashboard
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
