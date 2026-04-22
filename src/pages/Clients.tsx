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
}

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
    return clients
      .filter((c) => {
        if (statusFilter !== "All" && c.status !== statusFilter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.service_requested?.toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, search, statusFilter]);

  const getLetter = (name: string) => {
    const ch = name?.trim().charAt(0).toUpperCase() || "#";
    return /[A-Z]/.test(ch) ? ch : "#";
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Client[]>();
    filtered.forEach((c) => {
      const l = getLetter(c.name);
      if (!map.has(l)) map.set(l, []);
      map.get(l)!.push(c);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");
  const availableLetters = new Set(grouped.map(([l]) => l));

  const scrollToLetter = (letter: string) => {
    const el = document.getElementById(`client-section-${letter}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
              Manage leads and clients in one place
            </p>
          </div>
          <Button
            onClick={() => navigate("/dashboard/clients/new")}
            className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:opacity-90 gap-2"
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
          <Card>
            <CardContent className="p-10 text-center">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">
                No clients yet. Add your first one to get started.
              </p>
              <Button
                onClick={() => navigate("/dashboard/clients/new")}
                className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:opacity-90 gap-2"
              >
                <Plus className="w-4 h-4" /> Add New Client
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
          <div className="relative flex gap-2">
            <Card className="overflow-hidden flex-1 min-w-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Client</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead className="hidden lg:table-cell">Service</TableHead>
                      <TableHead className="hidden lg:table-cell">Budget</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grouped.map(([letter, items]) => (
                      <React.Fragment key={`group-${letter}`}>
                        <TableRow
                          id={`client-section-${letter}`}
                          className="hover:bg-transparent bg-muted/30 scroll-mt-20"
                        >
                          <TableCell
                            colSpan={7}
                            className="py-2 text-xs font-semibold text-accent uppercase tracking-wider"
                          >
                            {letter}
                          </TableCell>
                        </TableRow>
                        {items.map((c) => (
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
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {c.name}
                                  </p>
                                  {c.company && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {c.company}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {c.email || "—"}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                              {c.service_requested || "—"}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                              {c.budget || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${statusStyle(c.status)} text-xs`}>
                                {c.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              {new Date(c.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/dashboard/clients/${c.id}`);
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-accent hover:text-accent"
                                  onClick={(e) => goGenerate(c, e)}
                                >
                                  <Sparkles className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Alphabetical index (iPhone Contacts style) */}
            <div className="sticky top-4 self-start flex flex-col items-center py-2 px-1 rounded-full bg-card/60 border border-border/50 backdrop-blur-sm">
              {ALPHABET.map((letter) => {
                const enabled = availableLetters.has(letter);
                return (
                  <button
                    key={letter}
                    disabled={!enabled}
                    onClick={() => scrollToLetter(letter)}
                    className={`text-[10px] leading-tight font-semibold w-5 h-4 flex items-center justify-center rounded transition-colors ${
                      enabled
                        ? "text-accent hover:bg-accent/10 cursor-pointer"
                        : "text-muted-foreground/30 cursor-default"
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
