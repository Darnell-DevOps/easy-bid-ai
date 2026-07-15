import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Copy, ArrowRight, Loader2, ExternalLink, Send, Clock, CheckCircle2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { onboardingProgress, type OnboardingFormRow } from "@/lib/onboarding";
import { getPrimaryCustomDomain, buildPublicUrl } from "@/lib/customDomain";

export default function OnboardingDashboard() {
  const [forms, setForms] = useState<OnboardingFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("onboarding_forms")
      .select("*")
      .is("deleted_at", null)
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

  const sendReminder = async (f: OnboardingFormRow) => {
    if (!f.client_email) {
      toast({ title: "No client email on file", description: "Add a client email before sending.", variant: "destructive" });
      return;
    }
    setRemindingId(f.id);
    try {
      const { domain, useForForms } = await getPrimaryCustomDomain(f.user_id);
      const url = buildPublicUrl({
        customDomain: useForForms ? domain : null,
        path: `/onboard/${f.access_token}`,
      });
      const idempotencyKey = `onboarding-remind-manual-${f.id}-${new Date().toISOString().slice(0, 10)}`;
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          templateName: "onboarding-reminder",
          recipientEmail: f.client_email,
          userId: f.user_id,
          idempotencyKey,
          data: { client_name: f.client_name, onboarding_link: url },
        },
      });
      const ok = (data as any)?.ok === true;
      if (error || !ok) {
        const reason =
          (data as any)?.suppressed ? "Recipient is suppressed"
          : (data as any)?.error || (error as any)?.message || "Send failed";
        toast({ title: "Send failed", description: reason, variant: "destructive" });
        return;
      }
      const now = new Date().toISOString();
      await supabase.from("onboarding_forms").update({ reminded_at: now }).eq("id", f.id);
      toast({
        title: (data as any)?.deduped ? "Reminder already sent today" : "Reminder sent",
      });
      load();
    } finally {
      setRemindingId(null);
    }
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
          <Card className="border-dashed border-border/60">
            <CardContent className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-purple/15 flex items-center justify-center mx-auto">
                <ClipboardList className="w-5 h-5 text-purple" />
              </div>
              <p className="text-sm font-semibold text-foreground">No onboarding forms yet</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Onboarding forms are auto-created the moment a client completes payment, so you can collect every brief, asset, and detail you need to start the project — without chasing email threads.
              </p>
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link to="/dashboard/proposals">View proposals <ArrowRight className="w-3.5 h-3.5" /></Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {forms.map((f) => {
              const progress = onboardingProgress({ fields: f.fields, responses: f.responses });
              const referenceTs = f.sent_at ? new Date(f.sent_at).getTime() : null;
              const stale =
                f.status !== "completed" &&
                !!f.sent_at &&
                referenceTs !== null &&
                Date.now() - referenceTs > 24 * 3600 * 1000;
              const needsSend = f.status !== "completed" && !f.sent_at;
              return (
                <Card key={f.id} className={stale ? "border-amber-500/40 bg-amber-500/5" : ""}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{f.client_name || "Client"}</p>
                        {!f.client_id && f.client_name && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted/60 font-normal">
                            Client deleted
                          </Badge>
                        )}
                        <StatusBadge status={f.status} />
                        {needsSend && (
                          <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground text-[10px]">
                            Not sent
                          </Badge>
                        )}
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
                          className="h-full bg-accent"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button asChild size="sm" className="gap-1.5">
                        <Link to={`/dashboard/onboarding/${f.id}`}>
                          <Eye className="w-3.5 h-3.5" /> View responses
                        </Link>
                      </Button>
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
                          onClick={() => sendReminder(f)}
                          disabled={remindingId === f.id}
                        >
                          {remindingId === f.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Send className="w-3.5 h-3.5" />}
                          Send reminder
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
