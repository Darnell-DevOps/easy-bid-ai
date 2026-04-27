import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Copy, ArrowRight, Loader2, ExternalLink, Send, Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { onboardingProgress, type OnboardingFormRow } from "@/lib/onboarding";

export default function OnboardingDashboard() {
  const [forms, setForms] = useState<OnboardingFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("onboarding_forms")
      .select("*")
      .order("created_at", { ascending: false });
    setForms(((data as unknown) as OnboardingFormRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    return {
      pending: forms.filter((f) => f.status === "pending"),
      in_progress: forms.filter((f) => f.status === "in_progress"),
      completed: forms.filter((f) => f.status === "completed"),
    };
  }, [forms]);

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/onboard/${token}`;
    await navigator.clipboard.writeText(url);
    toast({ title: "Onboarding link copied", description: url });
  };

  const followedUp = async (id: string) => {
    await supabase
      .from("onboarding_forms")
      .update({ reminded_at: new Date().toISOString() })
      .eq("id", id);
    toast({ title: "Marked as followed up", description: "Reminder timestamp updated." });
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-purple" />
              Client Onboarding
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track onboarding for every paid client and keep projects moving.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Pending" count={groups.pending.length} icon={Send} tone="amber" />
          <StatCard label="In progress" count={groups.in_progress.length} icon={Clock} tone="blue" />
          <StatCard label="Completed" count={groups.completed.length} icon={CheckCircle2} tone="emerald" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : forms.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No onboarding forms yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Onboarding forms are auto-created when a client completes payment, so you can collect everything you need to start the project.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {forms.map((f) => {
              const progress = onboardingProgress({ fields: f.fields, responses: f.responses });
              const ageMs = Date.now() - new Date(f.created_at).getTime();
              const stale = f.status !== "completed" && ageMs > 24 * 3600 * 1000;
              return (
                <Card key={f.id} className={stale ? "border-amber-500/40 bg-amber-500/5" : ""}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{f.client_name || "Client"}</p>
                        <StatusBadge status={f.status} />
                        {stale && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-[10px]">
                            Follow up
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {f.service_type || "Project"} · created {new Date(f.created_at).toLocaleDateString()}
                      </p>
                      <div className="mt-2 h-1 w-full max-w-sm rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple to-accent"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyLink(f.access_token)}>
                        <Copy className="w-3.5 h-3.5" /> Copy link
                      </Button>
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <a href={`/onboard/${f.access_token}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" /> Open
                        </a>
                      </Button>
                      {stale && (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-amber-500 text-white hover:bg-amber-500/90"
                          onClick={() => followedUp(f.id)}
                        >
                          <Send className="w-3.5 h-3.5" /> Send Follow-Up
                        </Button>
                      )}
                      {f.proposal_id && (
                        <Button asChild size="sm" variant="ghost" className="gap-1">
                          <Link to={`/dashboard/proposal/${f.proposal_id}`}>
                            View deal <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  label, count, icon: Icon, tone,
}: { label: string; count: number; icon: React.ComponentType<{ className?: string }>; tone: "amber" | "blue" | "emerald" }) {
  const styles =
    tone === "amber"
      ? "border-amber-500/30 bg-amber-500/5 text-amber-500"
      : tone === "blue"
        ? "border-blue-500/30 bg-blue-500/5 text-blue-500"
        : "border-emerald-500/30 bg-emerald-500/5 text-emerald-500";
  return (
    <Card className={styles.split(" ").slice(0, 2).join(" ")}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${styles.split(" ").slice(2).join(" ")} bg-current/10`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
          <p className="text-xl font-bold text-foreground">{count}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "border-amber-500/40 text-amber-500" },
    in_progress: { label: "In progress", className: "border-blue-500/40 text-blue-500" },
    completed: { label: "Completed", className: "border-emerald-500/40 text-emerald-500" },
  };
  const s = map[status] || { label: status, className: "" };
  return (
    <Badge variant="outline" className={`text-[10px] ${s.className}`}>
      {s.label}
    </Badge>
  );
}
