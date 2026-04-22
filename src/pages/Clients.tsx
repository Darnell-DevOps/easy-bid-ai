import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Plus, Search, Sparkles, Lightbulb, Activity, ArrowRight } from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string | null;
  service_requested: string | null;
  budget: string | null;
  status: string;
  created_at: string;
  is_active: boolean;
  company: string | null;
  project_description: string | null;
  goals: string | null;
  timeline: string | null;
  phone: string | null;
  lead_quality: string | null;
  lead_source: string | null;
  ai_recommendation: string | null;
}

const qualityBadgeStyle = (q: string | null) => {
  if (q === "High") return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  if (q === "Medium") return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  if (q === "Low") return "bg-rose-500/15 text-rose-600 border-rose-500/30";
  return "";
};

const STATUS_OPTIONS = ["All", "New", "Qualified", "Proposal Sent", "Won", "Lost"];

const statusStyle = (status: string) => {
  switch (status) {
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

const Empty = ({ children }: { children?: React.ReactNode }) => (
  <span className="text-muted-foreground/60">{children ?? "—"}</span>
);

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      setClients((data as Client[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.service_requested?.toLowerCase().includes(q)
      );
    });
  }, [clients, search, statusFilter]);

  // Best candidate for "Create Proposal" CTA on the banner
  const topCandidate = useMemo(() => {
    if (clients.length === 0) return null;
    return (
      clients.find((c) => c.lead_quality === "High" && c.status !== "Won" && c.status !== "Lost") ||
      clients.find((c) => c.status === "Qualified") ||
      clients.find((c) => c.status === "New") ||
      null
    );
  }, [clients]);

  // Dynamic insight based on data
  const insight = useMemo(() => {
    if (clients.length === 0) return null;
    const readyForProposal = clients.filter(
      (c) => c.status === "Qualified" || c.status === "New",
    ).length;
    const highQuality = clients.filter((c) => c.lead_quality === "High").length;
    const lowQuality = clients.filter((c) => c.lead_quality === "Low").length;

    if (highQuality > 0) {
      return `${highQuality} high-quality ${highQuality === 1 ? "lead" : "leads"} ready for a proposal — send one to get paid`;
    }
    if (readyForProposal > 0) {
      return `${readyForProposal} ${readyForProposal === 1 ? "client" : "clients"} ready for a proposal — send one to get paid`;
    }
    if (lowQuality > 0) {
      return `${lowQuality} low-quality ${lowQuality === 1 ? "lead" : "leads"} detected — focus on qualified ones first`;
    }
    return "Select a client to create a proposal and get paid faster";
  }, [clients]);

  const goGenerate = (c: Client, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigate("/dashboard/new", {
      state: {
        prefillFromClient: {
          client_name: c.name,
          company_name: c.company || "",
          service_type: c.service_requested || "",
          project_scope: c.project_description || "",
          budget: c.budget || "",
          timeline: c.timeline || "",
          notes: c.goals ? `Client goals: ${c.goals}` : "",
          client_id: c.id,
        },
      },
    });
  };

  // Recent activity = 5 most recent clients
  const recentActivity = useMemo(() => clients.slice(0, 5), [clients]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Clients{!loading && clients.length > 0 && (
                <span className="text-muted-foreground font-medium"> ({clients.length})</span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage leads and clients in one place. Click a row to open their profile.
            </p>
          </div>
          <Button
            onClick={() => navigate("/dashboard/clients/new")}
            size="lg"
            className="gap-2 h-12 px-6 text-base bg-gradient-to-r from-accent to-purple text-white hover:brightness-110 shadow-lg shadow-accent/25"
          >
            <Plus className="w-5 h-5" />
            Add New Client
          </Button>
        </div>

        {/* Guidance / insight banner */}
        {!loading && insight && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-accent/20 bg-gradient-to-r from-accent/10 to-purple/5 px-4 py-3.5">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 text-accent" />
              </div>
              <p className="text-sm text-foreground/90">{insight}</p>
            </div>
            {topCandidate && (
              <Button
                size="sm"
                onClick={() => goGenerate(topCandidate)}
                className="gap-1.5 bg-gradient-to-r from-accent to-purple text-white hover:brightness-110 shadow-sm shadow-accent/20 flex-shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Create Proposal
              </Button>
            )}
          </div>
        )}

        {/* Filters */}
        {clients.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or service…"
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-48">
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
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
                <Users className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No clients yet
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Add a client to start generating proposals and getting paid.
              </p>
              <Button
                onClick={() => navigate("/dashboard/clients/new")}
                size="lg"
                className="bg-gradient-to-r from-accent to-purple text-white hover:brightness-110 gap-2 shadow-lg shadow-accent/20"
              >
                <Plus className="w-4 h-4" /> Add Client
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No clients match your filters.
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Lead Quality</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const subtext = c.company || c.service_requested;
                    return (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer transition-colors hover:bg-accent/5"
                        onClick={() => navigate(`/dashboard/clients/${c.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-semibold text-accent">
                                {c.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                              {subtext && (
                                <p className="text-xs text-muted-foreground truncate">{subtext}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${statusStyle(c.status)} text-xs`}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {c.lead_quality ? (
                            <Badge
                              variant="outline"
                              className={`${qualityBadgeStyle(c.lead_quality)} text-xs`}
                            >
                              {c.lead_quality}
                            </Badge>
                          ) : (
                            <Empty />
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={(e) => goGenerate(c, e)}
                            className="gap-1.5 bg-gradient-to-r from-accent to-purple text-white hover:brightness-110 shadow-sm shadow-accent/20"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Create Proposal
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {/* Recent client activity */}
        {!loading && recentActivity.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Recent Client Activity
                  </h3>
                </div>
              </div>
              <div className="space-y-3">
                {recentActivity.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/dashboard/clients/${c.id}`)}
                    className="w-full flex items-center justify-between gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-accent/5 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground"> added as a client</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
