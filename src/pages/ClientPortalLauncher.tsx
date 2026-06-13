import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Eye, Loader2, Search, Sparkles } from "lucide-react";

interface ProposalRow {
  id: string;
  service_type: string | null;
  client_name: string | null;
  status: string | null;
  updated_at: string;
}

const statusTone: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  viewed: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  accepted: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

export default function ClientPortalLauncher() {
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("proposals")
        .select("id, service_type, client_name, status, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50);
      setProposals((data as ProposalRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return proposals;
    return proposals.filter(
      (p) =>
        (p.client_name || "").toLowerCase().includes(q) ||
        (p.service_type || "").toLowerCase().includes(q),
    );
  }, [proposals, query]);

  const openPortal = (id: string) => {
    window.open(`/proposal/view/${id}`, "_blank", "noopener,noreferrer");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              Client Portal
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Open a client portal
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Preview the experience your clients see. Pick any proposal to open its portal in a new tab.
            </p>
          </div>
        </div>

        <Card className="border-border/60">
          <CardContent className="p-4 sm:p-5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by client or proposal…"
                className="pl-9 h-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center px-6">
                <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-3">
                  <Eye className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {proposals.length === 0 ? "No proposals yet" : "No matches"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  {proposals.length === 0
                    ? "Create your first proposal to share a client portal."
                    : "Try a different search term."}
                </p>
                {proposals.length === 0 && (
                  <Button asChild size="sm">
                    <Link to="/dashboard/new">Create Proposal</Link>
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {filtered.map((p) => {
                  const status = (p.status || "draft").toLowerCase();
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-4 px-4 sm:px-5 py-3.5 hover:bg-sidebar-accent/20 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground truncate">
                            {p.client_name || "Untitled client"}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${statusTone[status] || statusTone.draft}`}
                          >
                            {status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {p.service_type || "Proposal"} · Updated{" "}
                          {new Date(p.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPortal(p.id)}
                        className="flex-shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Open portal
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
