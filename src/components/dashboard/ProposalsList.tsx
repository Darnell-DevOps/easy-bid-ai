import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Search, MoreVertical, Eye, Pencil, Copy, Trash2, Calendar, Bell } from "lucide-react";
import StatusBadge from "@/components/proposal/StatusBadge";
import { getFollowUpScenario } from "@/lib/follow-up";

interface Proposal {
  id: string;
  client_name: string;
  company_name: string;
  service_type: string;
  created_at: string;
  status?: string | null;
  client_paid?: boolean;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  paid_at?: string | null;
}

const SERVICE_TYPES = [
  "All Services", "Marketing Strategy", "Brand Identity", "Web Design & Development",
  "SEO & Content", "Social Media Management", "Paid Advertising", "Consulting", "Other",
];

const DATE_FILTERS = [
  { label: "All Time", value: "all" },
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

interface ProposalsListProps {
  proposals: Proposal[];
  loading: boolean;
  onRefresh: () => void;
}

export default function ProposalsList({ proposals, loading, onRefresh }: ProposalsListProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("All Services");
  const [dateFilter, setDateFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Proposal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    let result = proposals;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.client_name.toLowerCase().includes(q) || p.company_name.toLowerCase().includes(q));
    }
    if (serviceFilter !== "All Services") result = result.filter((p) => p.service_type === serviceFilter);
    if (dateFilter !== "all") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(dateFilter));
      result = result.filter((p) => new Date(p.created_at) >= cutoff);
    }
    return result;
  }, [proposals, search, serviceFilter, dateFilter]);

  const handleDuplicate = async (proposal: Proposal) => {
    try {
      const { data: original } = await supabase.from("proposals").select("*").eq("id", proposal.id).single();
      if (!original) throw new Error("Proposal not found");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("proposals").insert({
        user_id: user.id, client_name: `${original.client_name} (Copy)`, company_name: original.company_name,
        service_type: original.service_type, project_scope: original.project_scope, budget: original.budget,
        timeline: original.timeline, notes: original.notes, proposal_content: original.proposal_content,
        pricing_breakdown: original.pricing_breakdown, invoice_content: original.invoice_content,
      });
      if (error) throw error;
      toast({ title: "Proposal duplicated" });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Duplication failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("proposals").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Proposal deleted" });
      onRefresh();
    }
  };

  const hasActiveFilters = search.trim() || serviceFilter !== "All Services" || dateFilter !== "all";

  return (
    <div>
      {/* Filters */}
      {proposals.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by client or company..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>{SERVICE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full sm:w-[160px]"><Calendar className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>{DATE_FILTERS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : proposals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No proposals yet</h3>
            <p className="text-sm text-muted-foreground mb-8 max-w-sm">Create your first proposal in under 2 minutes.</p>
            <Link to="/dashboard/new">
              <Button className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:brightness-110 gap-2 px-8 h-12 text-base">
                <Plus className="w-4 h-4" /> Create Your First Proposal
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="w-8 h-8 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-foreground mb-1">No matching proposals</h3>
            <p className="text-sm text-muted-foreground mb-4">Try adjusting your search or filters.</p>
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setServiceFilter("All Services"); setDateFilter("all"); }}>Clear Filters</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Card key={p.id} className="hover:shadow-md hover:border-accent/20 transition-all cursor-pointer group" onClick={() => navigate(`/dashboard/proposal/${p.id}`)}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-foreground text-sm truncate">{p.client_name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{p.company_name} · {p.service_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {getFollowUpScenario(p) !== "none" && (
                    <span
                      className="hidden sm:inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-500 text-[10px] font-medium px-2 py-0.5"
                      title="Follow-up needed"
                    >
                      <Bell className="w-3 h-3" /> Follow up
                    </span>
                  )}
                  <StatusBadge status={p.status} paid={p.client_paid} descriptive className="hidden sm:inline-flex" />
                  <span className="text-xs text-muted-foreground hidden md:block">{new Date(p.created_at).toLocaleDateString()}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => navigate(`/dashboard/proposal/${p.id}`)}><Eye className="w-4 h-4 mr-2" /> View</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/dashboard/proposal/${p.id}`)}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(p)}><Copy className="w-4 h-4 mr-2" /> Duplicate</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(p)}><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && proposals.length > 0 && hasActiveFilters && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground mt-4 text-center">Showing {filtered.length} of {proposals.length}</p>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the proposal for <span className="font-medium text-foreground">{deleteTarget?.client_name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
