import { useEffect, useState } from "react";
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
import { toast } from "@/hooks/use-toast";

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

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [edit, setEdit] = useState<Partial<ClientInfo>>({});

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
          notes: client.goals ? `Client goals: ${client.goals}` : "",
          client_id: client.id,
        },
      },
    });
  };

  const totalRevenue = proposals
    .filter((p) => p.client_paid)
    .reduce((acc, p) => acc + (parseFloat(p.budget?.replace(/[^0-9.]/g, "") || "0") || 0), 0);

  const invoiceCount = proposals.filter((p) => p.invoice_content).length;

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
            <Badge variant="outline" className={`${statusStyle(client.status)} text-xs`}>
              {client.status}
            </Badge>
          </div>
        </div>

        {/* Primary CTA */}
        <Card className="glass-card border-accent/20">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Ready to win this client?</p>
              <p className="text-xs text-muted-foreground">
                Generate a proposal pre-filled with their intake details.
              </p>
            </div>
            <Button
              onClick={generateProposal}
              className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:opacity-90 gap-2"
            >
              <Sparkles className="w-4 h-4" /> Generate Proposal
            </Button>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="w-5 h-5 text-accent mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{proposals.length}</p>
              <p className="text-xs text-muted-foreground">Proposals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">
                $
                {totalRevenue >= 1000
                  ? `${(totalRevenue / 1000).toFixed(1)}k`
                  : totalRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{invoiceCount}</p>
              <p className="text-xs text-muted-foreground">Invoices</p>
            </CardContent>
          </Card>
        </div>

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

        {/* Proposals list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Proposals</h2>
            <Button size="sm" variant="outline" onClick={generateProposal} className="gap-2">
              <Plus className="w-4 h-4" /> New Proposal
            </Button>
          </div>

          {proposals.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                No proposals yet for this client.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {proposals.map((p) => (
                <Card
                  key={p.id}
                  className="hover:border-accent/20 transition-colors cursor-pointer"
                  onClick={() => navigate(`/dashboard/proposal/${p.id}`)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.service_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()} · {p.budget}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.client_paid && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs"
                        >
                          Paid
                        </Badge>
                      )}
                      <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-xs">
                        {p.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <Card className="border-destructive/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Delete client</p>
              <p className="text-xs text-muted-foreground">
                Permanently removes this client and all their proposals.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              </AlertDialogTrigger>
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
          </CardContent>
        </Card>
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
