import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, DollarSign, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ClientWithStats {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  is_active: boolean;
  proposalCount: number;
  totalValue: number;
}

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data: clientsData } = await supabase.from("clients").select("*").order("name");
      const { data: proposals } = await supabase.from("proposals").select("client_id, budget, client_paid, status");

      const mapped = (clientsData || []).map((c: any) => {
        const clientProposals = (proposals || []).filter((p: any) => p.client_id === c.id);
        const totalValue = clientProposals
          .filter((p: any) => p.client_paid)
          .reduce((acc: number, p: any) => acc + (parseFloat(p.budget?.replace(/[^0-9.]/g, "") || "0") || 0), 0);
        return {
          id: c.id,
          name: c.name,
          company: c.company,
          email: c.email,
          is_active: c.is_active ?? true,
          proposalCount: clientProposals.length,
          totalValue,
        };
      });
      setClients(mapped);
      setLoading(false);
    };
    fetch();
  }, []);

  const filteredClients = useMemo(() => {
    return showInactive ? clients : clients.filter((c) => c.is_active);
  }, [clients, showInactive]);

  const inactiveCount = useMemo(() => clients.filter((c) => !c.is_active).length, [clients]);

  const grouped = useMemo(() => {
    const groups: Record<string, ClientWithStats[]> = {};
    filteredClients.forEach((c) => {
      const letter = c.name.charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredClients]);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const topClients = useMemo(() => {
    return [...clients].sort((a, b) => b.totalValue - a.totalValue).slice(0, 3);
  }, [clients]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clients</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""}
            </p>
          </div>
          {inactiveCount > 0 && (
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border"
            >
              {showInactive ? "Hide inactive" : `Show inactive (${inactiveCount})`}
            </button>
          )}
        </div>

        {!loading && topClients.length > 0 && topClients.some(c => c.totalValue > 0) && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Top Clients</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {topClients.map((c) => (
                <Card key={c.id} className="hover:border-accent/20 transition-colors cursor-pointer" onClick={() => navigate(`/dashboard/clients/${c.id}`)}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-accent">{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.proposalCount} proposal{c.proposalCount !== 1 ? "s" : ""}</p>
                    </div>
                    {c.totalValue > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-emerald-400">
                        <DollarSign className="w-3 h-3" />
                        {c.totalValue >= 1000 ? `${(c.totalValue / 1000).toFixed(1)}k` : c.totalValue}
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : clients.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No clients yet. Create a proposal to add your first client.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-4">
            {/* Main list */}
            <div className="flex-1 space-y-1">
              {grouped.map(([letter, group]) => (
                <div key={letter}>
                  <div className="sticky top-0 z-10 px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase bg-background/95 backdrop-blur-sm border-b border-border/50">
                    {letter}
                  </div>
                  {group.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => navigate(`/dashboard/clients/${client.id}`)}
                      className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-secondary/50 transition-colors text-left group border-b border-border/30 ${!client.is_active ? "opacity-50" : ""}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${client.is_active ? "bg-accent/10" : "bg-muted"}`}>
                        <span className={`text-sm font-semibold ${client.is_active ? "text-accent" : "text-muted-foreground"}`}>{client.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                          {!client.is_active && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">Inactive</Badge>
                          )}
                        </div>
                        {client.company && (
                          <p className="text-xs text-muted-foreground truncate">{client.company}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="w-3 h-3" />
                          {client.proposalCount}
                        </div>
                        {client.totalValue > 0 && (
                          <div className="flex items-center gap-1 text-xs text-emerald-400">
                            <DollarSign className="w-3 h-3" />
                            {client.totalValue >= 1000
                              ? `${(client.totalValue / 1000).toFixed(1)}k`
                              : client.totalValue.toLocaleString()}
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Alphabet sidebar */}
            <div className="hidden sm:flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-muted-foreground sticky top-0 self-start">
              {alphabet.map((l) => {
                const hasClients = grouped.some(([letter]) => letter === l);
                return (
                  <button
                    key={l}
                    onClick={() => {
                      const el = document.querySelector(`[data-letter="${l}"]`);
                      el?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={`w-5 h-5 flex items-center justify-center rounded-sm transition-colors ${
                      hasClients ? "text-accent hover:bg-accent/10" : "text-muted-foreground/30"
                    }`}
                    disabled={!hasClients}
                  >
                    {l}
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
