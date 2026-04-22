import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Policy {
  id: string;
  business_name: string;
  policy_type: string;
  country: string;
  created_at: string;
}

export default function Policies() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("policies")
      .select("id, business_name, policy_type, country, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setPolicies(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this policy?")) return;
    const { error } = await supabase.from("policies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Policy deleted");
    setPolicies((p) => p.filter((x) => x.id !== id));
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Policies</h1>
          <p className="text-muted-foreground mt-1">
            Generate professional business policies with AI.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/policies/new">
            <Plus className="w-4 h-4 mr-2" />
            Generate New Policy
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : policies.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No policies yet.</p>
            <Button asChild>
              <Link to="/dashboard/policies/new">
                <Plus className="w-4 h-4 mr-2" />
                Generate your first policy
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {policies.map((p) => (
            <Card key={p.id} className="hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">
                    <Link to={`/dashboard/policies/${p.id}`} className="hover:underline">
                      {p.business_name}
                    </Link>
                  </CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary">{p.policy_type}</Badge>
                    <Badge variant="outline">{p.country}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "MMM d, yyyy")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(p.id)}
                    aria-label="Delete policy"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
