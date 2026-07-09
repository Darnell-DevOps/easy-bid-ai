import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, ArrowRight, CheckCircle2, Clock, Send, Copy } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/hooks/use-toast";
import type { OnboardingFormRow } from "@/lib/onboarding";

interface Props {
  className?: string;
}

export default function OnboardingWidget({ className }: Props) {
  const [forms, setForms] = useState<OnboardingFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    const { data } = await supabase
      .from("onboarding_forms")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    setForms(((data as unknown) as OnboardingFormRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const pending = forms.filter((f) => f.status === "pending");
    const inProgress = forms.filter((f) => f.status === "in_progress");
    const completed = forms.filter((f) => f.status === "completed");
    return { pending, inProgress, completed };
  }, [forms]);

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/onboard/${token}`;
    await navigator.clipboard.writeText(url);
    toast({ title: "Onboarding link copied", description: url });
  };

  if (loading) return null;

  if (forms.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <EmptyState
            icon={ClipboardList}
            title="Onboard clients on autopilot"
            description="Onboarding forms are auto-created when a client completes payment, so you collect everything you need to start the project — no chasing email threads."
            variant="inline"
            tone="purple"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-purple" />
            <p className="text-sm font-semibold text-foreground">Client Onboarding</p>
          </div>
          <div className="flex gap-1.5 text-[10px]">
            {grouped.pending.length > 0 && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-500">
                {grouped.pending.length} pending
              </Badge>
            )}
            {grouped.inProgress.length > 0 && (
              <Badge variant="outline" className="border-blue-500/40 text-blue-500">
                {grouped.inProgress.length} in progress
              </Badge>
            )}
            {grouped.completed.length > 0 && (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
                {grouped.completed.length} done
              </Badge>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {forms.slice(0, 4).map((f) => {
            const Icon =
              f.status === "completed" ? CheckCircle2 : f.status === "in_progress" ? Clock : Send;
            const tone =
              f.status === "completed"
                ? "text-emerald-500"
                : f.status === "in_progress"
                  ? "text-blue-500"
                  : "text-amber-500";
            return (
              <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-2.5">
                <Icon className={`w-4 h-4 shrink-0 ${tone}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{f.client_name || "Client"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {f.service_type || "Project"} ·{" "}
                    {f.status === "completed"
                      ? "Onboarding complete"
                      : f.status === "in_progress"
                        ? "Filling out form"
                        : "Awaiting client"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => copyLink(f.access_token)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
        </div>
        {forms.length > 4 && (
          <Button asChild variant="ghost" size="sm" className="w-full text-xs gap-1">
            <Link to="/dashboard/onboarding">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
