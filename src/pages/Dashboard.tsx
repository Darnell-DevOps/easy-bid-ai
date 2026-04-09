import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText } from "lucide-react";

interface Proposal {
  id: string;
  client_name: string;
  company_name: string;
  service_type: string;
  created_at: string;
}

export default function Dashboard() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProposals = async () => {
      const { data } = await supabase
        .from("proposals")
        .select("id, client_name, company_name, service_type, created_at")
        .order("created_at", { ascending: false });
      setProposals(data || []);
      setLoading(false);
    };
    fetchProposals();
  }, []);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Proposals</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage your proposals</p>
        </div>
        <Link to="/dashboard/new">
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
            <Plus className="w-4 h-4" /> New Proposal
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-foreground mb-1">No proposals yet</h3>
            <p className="text-sm text-muted-foreground mb-6">Create your first proposal in under 2 minutes</p>
            <Link to="/dashboard/new">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
                <Plus className="w-4 h-4" /> Create Proposal
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => (
            <Link key={p.id} to={`/dashboard/proposal/${p.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{p.client_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {p.company_name} · {p.service_type}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
