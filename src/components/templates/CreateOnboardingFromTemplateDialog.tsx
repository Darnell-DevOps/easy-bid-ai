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
import { Loader2, Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  templateToOnboardingFields,
  type MergedOnboardingTemplate,
} from "@/lib/onboarding-templates";

interface ClientLite {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
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

  useEffect(() => {
    if (!open) return;
    setClientId("__new__");
    setClientName("");
    setClientEmail("");
    setCreatedToken(null);
    setCreatedId(null);
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, email, company")
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
    const { data, error } = await (supabase.from("onboarding_forms") as any)
      .insert({
        user_id: userId,
        client_id: clientId !== "__new__" ? clientId : null,
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || null,
        service_type: template.service_type || null,
        fields,
        responses: {},
        status: "pending",
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
    toast({ title: "Onboarding created", description: "Send the link to your client." });
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
