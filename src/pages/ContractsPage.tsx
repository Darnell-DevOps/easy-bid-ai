import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { CONTRACT_TYPES, contractTypeLabel, type ContractRow } from "@/lib/contracts";
import { useToast } from "@/hooks/use-toast";
import { sendEmail } from "@/lib/email";
import {
  FileSignature,
  Plus,
  ExternalLink,
  Copy,
  CheckCircle2,
  Clock,
  Eye,
  Send,
  Loader2,
  Trash2,
  Sparkles,
} from "lucide-react";
import type { MergedContractTemplate } from "@/lib/contract-templates";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-accent/15 text-accent",
  viewed: "bg-purple/15 text-purple",
  signed: "bg-purple/15 text-purple",
  executed: "bg-emerald-500/15 text-emerald-500",
};

export default function ContractsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);

  // Create form
  const [contractType, setContractType] = useState("service_agreement");
  const [proposalId, setProposalId] = useState<string>("none");
  const [proposals, setProposals] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState<string>("none");
  const [providerName, setProviderName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [scope, setScope] = useState("");
  const [timeline, setTimeline] = useState("");
  const [budget, setBudget] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("50% deposit, 50% on completion");
  const [extraClauses, setExtraClauses] = useState("");

  const useTemplate = (t: MergedContractTemplate) => {
    setContractType(t.contract_type);
    setServiceType(t.service_type || "");
    setScope(t.default_scope || "");
    setTimeline(t.default_timeline || "");
    setBudget(t.default_budget || "");
    setPaymentTerms(t.default_payment_terms || "50% deposit, 50% on completion");
    setExtraClauses(t.extra_clauses || "");
    setOpenCreate(true);
  };

  const fetchData = async () => {
    setLoading(true);
    const [{ data: c }, { data: p }, { data: cl }] = await Promise.all([
      supabase.from("contracts").select("*").order("created_at", { ascending: false }),
      supabase
        .from("proposals")
        .select("id, client_id, client_name, company_name, service_type, project_scope, timeline, budget, amount_cents, currency, status, accepted_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("id, name, email, company")
        .order("name", { ascending: true }),
    ]);
    setContracts((c as any) || []);
    setProposals(p || []);
    setClients(cl || []);
    setLoading(false);

    // pre-fill provider name from auth
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setProviderName((user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Apply contract template or client prefill passed via navigation state
  useEffect(() => {
    const state = (location.state as any) || {};
    const tpl = state.contractTemplate as MergedContractTemplate | undefined;
    const prefill = state.prefillClient as
      | { id: string; name?: string; email?: string | null; company?: string | null }
      | undefined;
    if (tpl) {
      useTemplate(tpl);
    }
    if (prefill) {
      setClientId(prefill.id);
      setClientName(prefill.name || "");
      setClientEmail(prefill.email || "");
      setCompanyName(prefill.company || "");
      setOpenCreate(true);
    }
    if (tpl || prefill) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const stats = useMemo(() => {
    const pending = contracts.filter((c) => c.status !== "executed" && c.status !== "signed").length;
    const signed = contracts.filter((c) => c.status === "signed" || c.status === "executed").length;
    const awaiting = contracts.filter((c) => c.status === "sent" || c.status === "viewed").length;
    return { pending, signed, awaiting };
  }, [contracts]);

  const pickClient = (id: string) => {
    setClientId(id);
    if (id === "none") return;
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setClientName(c.name || "");
    setClientEmail(c.email || "");
    setCompanyName(c.company || "");
  };

  const fillFromProposal = (id: string) => {
    setProposalId(id);
    if (id === "none") return;
    const p = proposals.find((x) => x.id === id);
    if (!p) return;
    setClientName(p.client_name || "");
    setCompanyName(p.company_name || "");
    setServiceType(p.service_type || "");
    setScope(p.project_scope || "");
    setTimeline(p.timeline || "");
    setBudget(p.budget || "");
    if (p.client_id) setClientId(p.client_id);
  };

  const handleCreate = async () => {
    if (!clientName.trim() || !serviceType.trim()) {
      toast({ title: "Missing details", description: "Client name and service are required.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // Pull owner's policies for auto-attach
      const { data: policies } = await supabase
        .from("policies")
        .select("policy_type, content")
        .eq("user_id", user.id);
      const policiesText = (policies || [])
        .map((p: any) => `### ${p.policy_type}\n${p.content}`)
        .join("\n\n");

      const { data, error } = await supabase.functions.invoke("generate-contract", {
        body: {
          contract_type: contractType,
          provider_name: providerName,
          client_name: clientName,
          company_name: companyName,
          service_type: serviceType,
          project_scope: scope,
          timeline,
          budget,
          payment_terms: paymentTerms,
          extra_clauses: extraClauses,
          policies_text: policiesText,
          effective_date: new Date().toISOString().slice(0, 10),
        },
      });
      if (error) throw error;

      const proposal = proposalId !== "none" ? proposals.find((x) => x.id === proposalId) : null;
      const insertRow: any = {
        user_id: user.id,
        proposal_id: proposalId !== "none" ? proposalId : null,
        client_id: clientId !== "none" ? clientId : (proposal?.client_id ?? null),
        contract_type: contractType,
        title: data?.title || contractTypeLabel(contractType),
        body: data?.body || "",
        client_name: clientName,
        client_email: clientEmail || null,
        company_name: companyName || null,
        amount_cents: proposal?.amount_cents ?? null,
        currency: proposal?.currency ?? "USD",
        status: "draft",
      };
      const { data: inserted, error: insErr } = await supabase
        .from("contracts")
        .insert(insertRow)
        .select()
        .single();
      if (insErr) throw insErr;

      toast({
        title: "Contract created",
        description: data?.usedTemplate ? "Generated from template." : "AI-drafted contract ready.",
      });
      setOpenCreate(false);
      resetForm();
      await fetchData();
      navigate(`/dashboard/contracts/${inserted.id}`);
    } catch (e: any) {
      toast({ title: "Failed to create contract", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setContractType("service_agreement");
    setProposalId("none");
    setClientId("none");
    setClientName("");
    setClientEmail("");
    setCompanyName("");
    setServiceType("");
    setScope("");
    setTimeline("");
    setBudget("");
    setPaymentTerms("50% deposit, 50% on completion");
    setExtraClauses("");
  };

  const copySigningLink = async (token: string) => {
    const url = `${window.location.origin}/sign/${token}`;
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Signing link copied to clipboard." });
  };

  const markSent = async (c: ContractRow) => {
    const { error } = await supabase
      .from("contracts")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
      return;
    }
    if (c.client_email) {
      void sendEmail({
        templateName: "contract-signature-reminder",
        recipientEmail: c.client_email,
        userId: c.user_id,
        idempotencyKey: `contract-sent-${c.id}`,
        data: {
          from_name: c.company_name || "Your contact",
          title: c.title,
          url: `${window.location.origin}/sign/${c.signing_token}`,
        },
      });
    }
    await copySigningLink(c.signing_token);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contract permanently?")) return;
    const { error } = await supabase.from("contracts").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    fetchData();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileSignature className="w-6 h-6 text-accent" />
              Contracts
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate, send and e-sign professional client agreements.
            </p>
          </div>
          <Button onClick={() => setOpenCreate(true)} className="gap-2 bg-gradient-to-r from-accent to-purple text-white">
            <Plus className="w-4 h-4" /> New Contract
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Pending" value={stats.pending} icon={Clock} accent="text-accent" />
          <StatCard label="Awaiting Signature" value={stats.awaiting} icon={Send} accent="text-purple" />
          <StatCard label="Signed" value={stats.signed} icon={CheckCircle2} accent="text-emerald-500" />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : contracts.length === 0 ? (
              <div className="p-12 text-center">
                <FileSignature className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No contracts yet</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Generate your first contract — auto-filled from a proposal or built from scratch.
                </p>
                <Button onClick={() => setOpenCreate(true)} className="gap-2">
                  <Sparkles className="w-4 h-4" /> Create Contract
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {contracts.map((c) => (
                  <li key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-muted/30 transition-colors">
                    <Link to={`/dashboard/contracts/${c.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                        <Badge className={`${STATUS_STYLES[c.status] || "bg-muted"} font-medium border-0`}>
                          {c.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {c.client_name}{c.company_name ? ` · ${c.company_name}` : ""} · {contractTypeLabel(c.contract_type)}
                      </p>
                    </Link>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copySigningLink(c.signing_token)}>
                        <Copy className="w-3.5 h-3.5" /> Link
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" asChild>
                        <a href={`/sign/${c.signing_token}`} target="_blank" rel="noreferrer">
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </a>
                      </Button>
                      {c.status === "draft" && (
                        <Button size="sm" className="gap-1.5" onClick={() => markSent(c)}>
                          <Send className="w-3.5 h-3.5" /> Send
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Contract</DialogTitle>
            <DialogDescription>
              Choose a template, optionally pull details from an accepted proposal, and we'll draft it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Contract type</Label>
                <Select value={contractType} onValueChange={setContractType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Auto-fill from proposal</Label>
                <Select value={proposalId} onValueChange={fillFromProposal}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {proposals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.client_name} — {p.service_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Link to client</Label>
              <Select value={clientId} onValueChange={pickClient}>
                <SelectTrigger><SelectValue placeholder="No linked client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked client</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.company ? ` — ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Linking shows this contract on the client's profile alongside their proposals, retainers and bookings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Your name / business</Label>
                <Input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="Your business name" />
              </div>
              <div>
                <Label>Client name *</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div>
                <Label>Client email</Label>
                <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </div>
              <div>
                <Label>Client company</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Service / project *</Label>
              <Input value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
            </div>

            <div>
              <Label>Scope</Label>
              <Textarea rows={3} value={scope} onChange={(e) => setScope(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Timeline</Label>
                <Input value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="e.g. 4 weeks" />
              </div>
              <div>
                <Label>Total fee</Label>
                <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. £4,500" />
              </div>
            </div>

            <div>
              <Label>Payment terms</Label>
              <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
            </div>

            <p className="text-xs text-muted-foreground">
              Your saved policies will be automatically attached as additional clauses.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2 bg-gradient-to-r from-accent to-purple text-white">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: any; accent: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center ${accent}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
