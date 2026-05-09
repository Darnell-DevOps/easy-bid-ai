import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  FileText,
  DollarSign,
  Plus,
  Trash2,
  Sparkles,
  Pencil,
  Save,
  X,
  MessageSquare,
  Gauge,
  Lightbulb,
  ArrowRight,
  MoreVertical,
  Send,
  Receipt,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import ClientBriefCard from "@/components/ai/ClientBriefCard";
import ReplyDrafterDialog from "@/components/ai/ReplyDrafterDialog";

interface ClientInfo {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  service_requested: string | null;
  project_description: string | null;
  budget: string | null;
  timeline: string | null;
  goals: string | null;
  status: string;
  is_active: boolean;
  lead_quality: string | null;
  ai_recommendation: string | null;
  lead_source: string | null;
  original_lead_message: string | null;
  created_at: string;
}

interface Proposal {
  id: string;
  service_type: string;
  budget: string;
  created_at: string;
  status: string;
  client_paid: boolean;
  invoice_content: string | null;
}

const STATUS_OPTIONS = ["New", "Qualified", "Proposal Sent", "Won", "Lost"];

const statusStyle = (s: string) => {
  switch (s) {
    case "New":
      return "bg-accent/10 text-accent border-accent/20";
    case "Qualified":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "Proposal Sent":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "Won":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "Lost":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const proposalStatusStyle = (status: string, paid: boolean) => {
  if (paid) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  switch (status?.toLowerCase()) {
    case "draft":
      return "bg-muted text-muted-foreground border-border";
    case "sent":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "accepted":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "rejected":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-accent/10 text-accent border-accent/20";
  }
};

const descriptiveProposalStatus = (status: string, paid: boolean) => {
  if (paid) return "Paid";
  switch (status?.toLowerCase()) {
    case "draft":
      return "Draft • Not sent";
    case "sent":
      return "Sent • Awaiting response";
    case "accepted":
      return "Accepted • Awaiting payment";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<ClientInfo>>({});
  const [replyOpen, setReplyOpen] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data: c } = await supabase.from("clients").select("*").eq("id", id!).single();
      const { data: p } = await supabase
        .from("proposals")
        .select("id, service_type, budget, created_at, status, client_paid, invoice_content")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      setClient(c as ClientInfo);
      setProposals(p || []);
      setLoading(false);
    };
    fetch();
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    if (!client) return;
    const prev = client.status;
    setClient({ ...client, status: newStatus });
    const { error } = await supabase
      .from("clients")
      .update({ status: newStatus })
      .eq("id", client.id);
    if (error) {
      setClient({ ...client, status: prev });
      toast({ title: "Could not update status", variant: "destructive" });
    } else {
      toast({ title: "Status updated", description: `Now: ${newStatus}` });
    }
  };

  const startEdit = () => {
    if (!client) return;
    setEdit({ ...client });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEdit({});
  };

  const saveEdit = async () => {
    if (!client) return;
    setSavingEdit(true);
    const payload = {
      name: edit.name?.trim() || client.name,
      email: edit.email?.toString().trim() || null,
      phone: edit.phone?.toString().trim() || null,
      company: edit.company?.toString().trim() || null,
      service_requested: edit.service_requested?.toString().trim() || null,
      project_description: edit.project_description?.toString().trim() || null,
      budget: edit.budget?.toString().trim() || null,
      timeline: edit.timeline?.toString().trim() || null,
      goals: edit.goals?.toString().trim() || null,
    };
    const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
    } else {
      setClient({ ...client, ...payload } as ClientInfo);
      setEditing(false);
      toast({ title: "Client updated" });
    }
    setSavingEdit(false);
  };

  const deleteClient = async () => {
    if (!client) return;
    setDeleting(true);
    await supabase.from("proposals").delete().eq("client_id", client.id);
    await supabase.from("clients").delete().eq("id", client.id);
    toast({
      title: "Client deleted",
      description: "Client and all associated data have been permanently removed.",
    });
    navigate("/dashboard/clients");
  };

  const generateProposal = () => {
    if (!client) return;
    navigate("/dashboard/new", {
      state: {
        prefillFromClient: {
          client_name: client.name,
          company_name: client.company || "",
          service_type: client.service_requested || "",
          project_scope: client.project_description || "",
          budget: client.budget || "",
          timeline: client.timeline || "",
          notes: "",
          goals: client.goals || "",
          original_lead_message: client.original_lead_message || "",
          lead_quality: client.lead_quality || "",
          ai_recommendation: client.ai_recommendation || "",
          client_id: client.id,
        },
      },
    });
  };

  const totalRevenue = proposals
    .filter((p) => p.client_paid)
    .reduce((acc, p) => acc + (parseFloat(p.budget?.replace(/[^0-9.]/g, "") || "0") || 0), 0);

  const invoiceCount = proposals.filter((p) => p.invoice_content).length;
  const acceptedCount = proposals.filter(
    (p) => p.status?.toLowerCase() === "accepted" || p.client_paid,
  ).length;
  const acceptedUnpaidCount = proposals.filter(
    (p) => p.status?.toLowerCase() === "accepted" && !p.client_paid,
  ).length;
  const hasAcceptedUnpaid = acceptedUnpaidCount > 0;

  // Dynamic CTA based on proposal state
  const heroAction = useMemo(() => {
    if (!client) return null;
    const draft = proposals.find((p) => p.status?.toLowerCase() === "draft");
    const acceptedUnpaid = proposals.find(
      (p) => p.status?.toLowerCase() === "accepted" && !p.client_paid,
    );
    const paid = proposals.find((p) => p.client_paid && p.invoice_content);

    if (paid) {
      return {
        label: "View Invoice",
        Icon: Receipt,
        onClick: () => navigate(`/dashboard/proposal/${paid.id}`),
        title: "Deal closed — payment received",
        subtitle: "View the invoice or download a copy for your records",
        variant: "success" as const,
      };
    }
    if (acceptedUnpaid) {
      return {
        label: "Request Payment",
        Icon: CreditCard,
        onClick: () => navigate(`/dashboard/proposal/${acceptedUnpaid.id}`),
        title: "Proposal accepted — get paid now",
        subtitle: "Send the invoice and collect payment in minutes",
        variant: "primary" as const,
      };
    }
    if (draft) {
      return {
        label: "Finish & Send Proposal",
        Icon: Send,
        onClick: () => navigate(`/dashboard/proposal/${draft.id}`),
        title: "You have a draft ready to send",
        subtitle: "Finish and send it to close the deal",
        variant: "primary" as const,
      };
    }
    return {
      label: "Generate Proposal → Close Deal",
      Icon: Sparkles,
      onClick: generateProposal,
      title: "Ready to close this client?",
      subtitle: "Generate and send a proposal in minutes to secure the deal",
      variant: "primary" as const,
    };
  }, [client, proposals]);

  // Detect missing intake details
  const intakeMissing = useMemo(() => {
    if (!client) return false;
    const filled = [
      client.service_requested,
      client.budget,
      client.timeline,
      client.project_description,
    ].filter((v) => v && v.toString().trim().length > 0).length;
    return filled < 2;
  }, [client]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Client not found.</p>
      </DashboardLayout>
    );
  }

  const isLowQuality = client.lead_quality === "Low";

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <button
          onClick={() => navigate("/dashboard/clients")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </button>

        {/* Client header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-accent">
                {client.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
              <div className="flex flex-wrap gap-3 mt-1">
                {client.company && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5" /> {client.company}
                  </span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" /> {client.email}
                  </span>
                )}
                {client.phone && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" /> {client.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={client.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10" aria-label="More actions">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={startEdit} className="gap-2">
                  <Pencil className="w-3.5 h-3.5" /> Edit details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete client
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* HERO — Primary CTA */}
        {heroAction && (
          <Card
            className={`relative overflow-hidden ${
              heroAction.variant === "success"
                ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-emerald-500/5"
                : "border-accent/30 bg-gradient-to-br from-accent/15 via-card to-purple/15"
            }`}
          >
            <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                {client.lead_quality === "High" && heroAction.variant === "primary" && !hasAcceptedUnpaid && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> High-quality lead — act now
                  </p>
                )}
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  {heroAction.title}
                </h2>
                <p className="text-sm text-muted-foreground">{heroAction.subtitle}</p>
              </div>
              <Button
                onClick={heroAction.onClick}
                size="lg"
                className={`gap-2 h-13 px-6 text-base font-semibold flex-shrink-0 transition-all duration-300 hover:scale-[1.03] ${
                  heroAction.variant === "success"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:brightness-110 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50"
                    : "bg-gradient-to-r from-accent to-purple text-white hover:brightness-110 shadow-lg shadow-accent/30 hover:shadow-accent/60"
                }`}
              >
                <heroAction.Icon className="w-5 h-5" /> {heroAction.label}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* AI Client Brief */}
        <ClientBriefCard clientId={client.id} />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3.5 text-center">
              <FileText className="w-5 h-5 text-accent mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground leading-tight">{proposals.length}</p>
              <p className="text-xs text-muted-foreground">
                Proposals{acceptedCount > 0 && ` (${acceptedCount} accepted)`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3.5 text-center">
              <DollarSign className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground leading-tight">
                $
                {totalRevenue >= 1000
                  ? `${(totalRevenue / 1000).toFixed(1)}k`
                  : totalRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasAcceptedUnpaid ? "Revenue · collect payment" : "Revenue collected"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3.5 text-center">
              <FileText className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground leading-tight">{invoiceCount}</p>
              <p className="text-xs text-muted-foreground">Invoices</p>
            </CardContent>
          </Card>
        </div>

        {/* Proposals list — moved higher */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Proposals</h2>
            <Button size="sm" variant="ghost" onClick={generateProposal} className="gap-2 text-xs text-muted-foreground hover:text-foreground h-8 px-2.5">
              <Plus className="w-3.5 h-3.5" /> New Proposal
            </Button>
          </div>

          {proposals.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No proposals yet</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Generate your first proposal to start closing this deal.
                </p>
                <Button
                  onClick={generateProposal}
                  size="sm"
                  className="gap-2 bg-gradient-to-r from-accent to-purple text-white hover:brightness-110 shadow-sm shadow-accent/20"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Generate Proposal
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {proposals.map((p) => {
                const status = p.status?.toLowerCase();
                const quickAction =
                  status === "draft"
                    ? { label: "Finish & Send", Icon: Send }
                    : status === "accepted" && !p.client_paid
                    ? { label: "Request Payment", Icon: CreditCard }
                    : null;
                return (
                  <Card
                    key={p.id}
                    className="group cursor-pointer transition-all duration-200 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/15 hover:-translate-y-0.5 hover:bg-accent/[0.04]"
                    onClick={() => navigate(`/dashboard/proposal/${p.id}`)}
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-6">
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
                          <FileText className="w-5 h-5 text-accent" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {p.service_type}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            {p.budget && (
                              <>
                                <span className="font-medium text-foreground/80">{p.budget}</span>
                                <span className="text-muted-foreground/50">•</span>
                              </>
                            )}
                            <span>{new Date(p.created_at).toLocaleDateString()}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge
                          variant="outline"
                          className={`${proposalStatusStyle(p.status, p.client_paid)} text-xs whitespace-nowrap`}
                        >
                          {descriptiveProposalStatus(p.status, p.client_paid)}
                        </Badge>
                        {quickAction && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/dashboard/proposal/${p.id}`);
                            }}
                            className="h-7 px-2.5 text-xs gap-1.5 border-accent/30 text-accent hover:bg-accent/10 hover:text-accent"
                          >
                            <quickAction.Icon className="w-3 h-3" /> {quickAction.label}
                          </Button>
                        )}
                        <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-1 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Lead Summary — only if this client came through the Lead Assistant */}
        {(client.original_lead_message || client.lead_quality || client.ai_recommendation || client.lead_source) && (
          <Card className="glass-card border-accent/20">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" /> Lead Summary
                </h2>
                {client.lead_source && (
                  <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-xs">
                    Source: {client.lead_source}
                  </Badge>
                )}
              </div>
              <div className="h-px bg-border" />

              {/* Low-quality lead CTA — de-emphasized when payment is the priority */}
              {isLowQuality && (
                <div
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3 ${
                    hasAcceptedUnpaid
                      ? "border-border/40 bg-muted/20"
                      : "border-amber-500/20 bg-amber-500/[0.04]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        hasAcceptedUnpaid ? "text-muted-foreground" : "text-amber-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        This lead looks low quality
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Add more details or qualify the lead before sending another proposal.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startEdit}
                    className={`gap-2 flex-shrink-0 ${
                      hasAcceptedUnpaid
                        ? ""
                        : "border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                    }`}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Qualify this lead
                  </Button>
                </div>
              )}

              {client.original_lead_message && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Original lead message
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReplyOpen(true)}
                      className="h-7 px-2.5 text-xs gap-1.5 border-accent/30 text-accent hover:bg-accent/10 hover:text-accent"
                    >
                      <Sparkles className="w-3 h-3" /> Draft AI reply
                    </Button>
                  </div>
                  <div className="rounded-lg bg-muted/40 border border-border/50 p-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {client.original_lead_message}
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                {client.lead_quality && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                      <Gauge className="w-3 h-3" /> AI lead quality
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        client.lead_quality === "High"
                          ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                          : client.lead_quality === "Medium"
                          ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                          : "bg-rose-500/15 text-rose-600 border-rose-500/30"
                      }
                    >
                      {client.lead_quality} Quality Lead
                    </Badge>
                  </div>
                )}
                {client.ai_recommendation && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" /> AI recommendation
                    </div>
                    <p className="text-sm font-medium text-foreground">{client.ai_recommendation}</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Captured {new Date(client.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Intake details / edit form */}
        <Card className="glass-card">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Intake Details
              </h2>
              {!editing ? (
                <Button variant="outline" size="sm" onClick={startEdit} className="gap-2">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={cancelEdit} className="gap-2">
                    <X className="w-3.5 h-3.5" /> Cancel
                  </Button>
                  <Button size="sm" onClick={saveEdit} disabled={savingEdit} className="gap-2">
                    <Save className="w-3.5 h-3.5" /> {savingEdit ? "Saving…" : "Save"}
                  </Button>
                </div>
              )}
            </div>
            <div className="h-px bg-border" />

            {editing ? (
              <div className="space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <Label>Client Name</Label>
                    <Input
                      value={edit.name || ""}
                      onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={edit.email || ""}
                      onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={edit.phone || ""}
                      onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Company</Label>
                    <Input
                      value={edit.company || ""}
                      onChange={(e) => setEdit({ ...edit, company: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Service Requested</Label>
                    <Input
                      value={edit.service_requested || ""}
                      onChange={(e) =>
                        setEdit({ ...edit, service_requested: e.target.value })
                      }
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Budget</Label>
                    <Input
                      value={edit.budget || ""}
                      onChange={(e) => setEdit({ ...edit, budget: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Timeline</Label>
                    <Input
                      value={edit.timeline || ""}
                      onChange={(e) => setEdit({ ...edit, timeline: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
                <div>
                  <Label>Project Description</Label>
                  <Textarea
                    rows={4}
                    value={edit.project_description || ""}
                    onChange={(e) =>
                      setEdit({ ...edit, project_description: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Goals</Label>
                  <Textarea
                    rows={4}
                    value={edit.goals || ""}
                    onChange={(e) => setEdit({ ...edit, goals: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>
            ) : intakeMissing ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-5">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Add project details to improve proposal quality
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The more we know about scope, budget, and timeline, the stronger the proposal.
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={startEdit} className="gap-2 flex-shrink-0">
                  <Pencil className="w-3.5 h-3.5" /> Edit Details
                </Button>
              </div>
            ) : (
              <div className="space-y-5 text-sm">
                <DetailRow label="Service Requested" value={client.service_requested} />
                <DetailRow label="Budget" value={client.budget} />
                <DetailRow label="Timeline" value={client.timeline} />
                <DetailRow
                  label="Project Description"
                  value={client.project_description}
                  multiline
                />
                <DetailRow label="Goals" value={client.goals} multiline />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete confirmation (triggered from dropdown menu in header) */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {client.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this client and all associated proposals
                and invoices. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteClient}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {client.original_lead_message && (
          <ReplyDrafterDialog
            open={replyOpen}
            onOpenChange={setReplyOpen}
            message={client.original_lead_message}
            clientName={client.name}
            clientEmail={client.email}
            scenario="incoming lead message"
            defaultTone="warm"
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function DetailRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string | null;
  multiline?: boolean;
}) {
  return (
    <div className={multiline ? "" : "grid sm:grid-cols-3 gap-2"}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`text-sm text-foreground sm:col-span-2 ${
          multiline ? "mt-1 whitespace-pre-wrap" : ""
        }`}
      >
        {value || <span className="text-muted-foreground italic">Not provided</span>}
      </p>
    </div>
  );
}
