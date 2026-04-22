import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Plus, Trash2, Shield, Lock, RotateCcw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Policy {
  id: string;
  business_name: string;
  policy_type: string;
  country: string;
  created_at: string;
}

const SUGGESTED = [
  { type: "Terms & Conditions", description: "Set the rules customers agree to when using your service.", icon: FileText, accent: "from-accent to-purple" },
  { type: "Privacy Policy", description: "Be transparent about how you collect and handle data.", icon: Lock, accent: "from-blue-500 to-cyan-500" },
  { type: "Refund Policy", description: "Make refund expectations clear and reduce disputes.", icon: RotateCcw, accent: "from-emerald-500 to-teal-500" },
];

export default function Policies() {
  const navigate = useNavigate();
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
        <Button asChild variant={policies.length === 0 ? "outline" : "default"}>
          <Link to="/dashboard/policies/new">
            <Plus className="w-4 h-4 mr-2" />
            Generate New Policy
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : policies.length === 0 ? (
        <div className="space-y-6">
          <div className="text-center max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Pick a policy to generate</h3>
            <p className="text-sm text-muted-foreground">
              Pre-built starting points — fully customised by AI for your business.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {SUGGESTED.map((s) => (
              <Card
                key={s.type}
                className="group hover:shadow-lg hover:border-accent/30 transition-all cursor-pointer"
                onClick={() => navigate(`/dashboard/policies/new?type=${encodeURIComponent(s.type)}`)}
              >
                <CardContent className="p-5 flex flex-col h-full">
                  <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${s.accent} flex items-center justify-center mb-4 shadow-md`}>
                    <s.icon className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="font-semibold text-foreground text-sm mb-1">{s.type}</h4>
                  <p className="text-xs text-muted-foreground mb-4 flex-1">{s.description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 group-hover:border-accent/40 group-hover:text-accent transition-colors"
                  >
                    Generate <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
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
