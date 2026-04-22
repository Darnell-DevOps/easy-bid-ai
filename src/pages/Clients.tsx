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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Plus, Search, Eye, Sparkles } from "lucide-react";

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
  <span className="text-muted-foreground/60">{children ?? "Not set"}</span>
);

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

  const goGenerate = (c: Client, e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clients</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage leads and clients in one place. Click a row to open their profile.
            </p>
          </div>
          <Button
            onClick={() => navigate("/dashboard/clients/new")}
            variant="outline"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New Client
          </Button>
        </div>

        {/* Filters */}
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

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Add your first client to get started
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Save leads and client details in one place — then generate proposals in seconds.
              </p>
              <Button
                onClick={() => navigate("/dashboard/clients/new")}
                size="lg"
                className="bg-gradient-to-r from-accent to-purple text-white hover:brightness-110 gap-2 shadow-lg shadow-accent/20"
              >
                <Plus className="w-4 h-4" /> Add Your First Client
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
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Service</TableHead>
                    <TableHead className="hidden lg:table-cell">Budget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Lead Quality</TableHead>
                    <TableHead className="hidden xl:table-cell">Source</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
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
                            {c.company && (
                              <p className="text-xs text-muted-foreground truncate">{c.company}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {c.email || <Empty />}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {c.service_requested || <Empty />}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {c.budget || <Empty />}
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
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                        {c.lead_source || <Empty />}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider delayDuration={200}>
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/dashboard/clients/${c.id}`);
                                  }}
                                  aria-label="View client"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Client</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-accent hover:text-accent"
                                  onClick={(e) => goGenerate(c, e)}
                                  aria-label="Generate proposal"
                                >
                                  <Sparkles className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Generate Proposal</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
