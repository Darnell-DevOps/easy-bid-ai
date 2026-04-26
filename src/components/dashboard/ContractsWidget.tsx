import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { FileSignature, ArrowRight, CheckCircle2, Send, Eye } from "lucide-react";

interface ContractLite {
  id: string;
  title: string;
  client_name: string;
  status: string;
  signed_at: string | null;
}

const STATUS_ICON: Record<string, any> = {
  sent: Send,
  viewed: Eye,
  signed: CheckCircle2,
};

export default function ContractsWidget() {
  const [contracts, setContracts] = useState<ContractLite[]>([]);
  const [counts, setCounts] = useState({ pending: 0, signed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("contracts")
        .select("id, title, client_name, status, signed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      const list = (data as any[]) || [];
      setContracts(list.slice(0, 4));
      setCounts({
        pending: list.filter((c) => c.status === "sent" || c.status === "viewed").length,
        signed: list.filter((c) => c.status === "signed").length,
      });
      setLoading(false);
    };
    load();
  }, []);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Contracts</h3>
          </div>
          <Link to="/dashboard/contracts" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : contracts.length === 0 ? (
          <div className="text-xs text-muted-foreground py-3">
            <p>No contracts yet.</p>
            <Link to="/dashboard/contracts" className="text-accent hover:underline">
              Create your first contract →
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3 text-xs">
              <span className="inline-flex items-center gap-1 text-purple font-medium">
                <Send className="w-3 h-3" /> {counts.pending} awaiting
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                <CheckCircle2 className="w-3 h-3" /> {counts.signed} signed
              </span>
            </div>
            <ul className="space-y-2">
              {contracts.map((c) => {
                const Icon = STATUS_ICON[c.status] || FileSignature;
                return (
                  <li key={c.id}>
                    <Link
                      to={`/dashboard/contracts/${c.id}`}
                      className="flex items-center gap-2 p-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${c.status === "signed" ? "text-emerald-500" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{c.client_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{c.title} · {c.status}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
