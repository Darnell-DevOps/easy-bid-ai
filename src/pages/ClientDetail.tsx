import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Mail, Building2, FileText, DollarSign, Plus } from "lucide-react";

interface ClientInfo {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
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

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: c } = await supabase.from("clients").select("*").eq("id", id!).single();
      const { data: p } = await supabase
        .from("proposals")
        .select("id, service_type, budget, created_at, status, client_paid, invoice_content")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      setClient(c);
      setProposals(p || []);
      setLoading(false);
    };
    fetch();
  }, [id]);

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

  const statusColor = (s: string) => {
    if (s === "accepted") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (s === "rejected") return "bg-destructive/10 text-destructive border-destructive/20";
    return "bg-accent/10 text-accent border-accent/20";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <button onClick={() => navigate("/dashboard/clients")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </button>

        {/* Client header */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-accent">{client.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1">
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
            </div>
          </div>
        </div>

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
                ${totalRevenue >= 1000 ? `${(totalRevenue / 1000).toFixed(1)}k` : totalRevenue.toLocaleString()}
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

        {/* Proposals list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Proposals</h2>
            <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/new")}>
              <Plus className="w-4 h-4 mr-1" /> New Proposal
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
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                          Paid
                        </Badge>
                      )}
                      <Badge variant="outline" className={`${statusColor(p.status)} text-xs`}>
                        {p.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
