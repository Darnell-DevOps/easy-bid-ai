import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logLeadActivity } from "@/lib/lead-activity";
import { KickoffAgendaDialog } from "@/components/kickoff/KickoffAgendaDialog";
import { CheckCircle2, FileSignature, ClipboardList, CreditCard, CalendarPlus, Mail, Eye, Rocket } from "lucide-react";

type ClientRow = {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  project_stage: string | null;
  project_stage_proposal_id: string | null;
};

type Bundle = {
  client: ClientRow;
  proposal: any | null;
  contract: any | null;
  onboarding: any | null;
};

export default function KickoffDashboard() {
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [agendaFor, setAgendaFor] = useState<Bundle | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: clients } = await (supabase.from("clients") as any)
      .select("id, name, company, email, project_stage, project_stage_proposal_id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("project_stage", ["ready_for_kickoff", "kickoff_scheduled"]);

    const list = (clients || []) as ClientRow[];
    if (list.length === 0) { setBundles([]); setLoading(false); return; }

    // Split clients into two groups:
    // - Modern: have a project_stage_proposal_id → bundle strictly by that exact proposal
    // - Legacy fallback: no project_stage_proposal_id (pre-existing records from
    //   before this field was introduced) → keep old latest-of-each-type by client_id
    const modernClients = list.filter((c) => !!c.project_stage_proposal_id);
    const legacyClients = list.filter((c) => !c.project_stage_proposal_id);

    const qualifyingProposalIds = modernClients.map((c) => c.project_stage_proposal_id as string);
    const legacyClientIds = legacyClients.map((c) => c.id);

    const [
      { data: modernProposals },
      { data: modernContracts },
      { data: modernForms },
      { data: legacyProposals },
      { data: legacyContracts },
      { data: legacyForms },
    ] = await Promise.all([
      qualifyingProposalIds.length
        ? supabase.from("proposals").select("*").in("id", qualifyingProposalIds)
        : Promise.resolve({ data: [] as any[] }),
      qualifyingProposalIds.length
        ? supabase.from("contracts").select("id, client_id, proposal_id, status")
            .in("proposal_id", qualifyingProposalIds).is("deleted_at", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      qualifyingProposalIds.length
        ? supabase.from("onboarding_forms").select("id, client_id, proposal_id, status")
            .in("proposal_id", qualifyingProposalIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      legacyClientIds.length
        ? supabase.from("proposals").select("*").in("client_id", legacyClientIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      legacyClientIds.length
        ? supabase.from("contracts").select("id, client_id, status").in("client_id", legacyClientIds)
            .is("deleted_at", null).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      legacyClientIds.length
        ? supabase.from("onboarding_forms").select("id, client_id, status").in("client_id", legacyClientIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const bundled: Bundle[] = list.map((c) => {
      if (c.project_stage_proposal_id) {
        // Modern path — bundle strictly by qualifying proposal_id so contract + onboarding
        // are guaranteed to belong to the SAME project as the proposal.
        const pid = c.project_stage_proposal_id;
        return {
          client: c,
          proposal: (modernProposals || []).find((p: any) => p.id === pid) || null,
          contract: (modernContracts || []).find((x: any) => x.proposal_id === pid) || null,
          onboarding: (modernForms || []).find((x: any) => x.proposal_id === pid) || null,
        };
      }
      // Legacy fallback: pre-existing clients whose stage was set before
      // project_stage_proposal_id existed. Preserve the original latest-of-each-type
      // by client_id behavior so historical records aren't broken.
      return {
        client: c,
        proposal: (legacyProposals || []).find((p: any) => p.client_id === c.id) || null,
        contract: (legacyContracts || []).find((x: any) => x.client_id === c.id) || null,
        onboarding: (legacyForms || []).find((x: any) => x.client_id === c.id) || null,
      };
    });

    // For agenda dialog we need full onboarding row (fields/responses) on demand — fetch here
    if (bundled.length > 0) {
      const formIds = bundled.map((b) => b.onboarding?.id).filter(Boolean);
      if (formIds.length > 0) {
        const { data: full } = await supabase.from("onboarding_forms").select("id, fields, responses").in("id", formIds);
        for (const b of bundled) {
          const f = (full || []).find((x: any) => x.id === b.onboarding?.id);
          if (f) b.onboarding = { ...b.onboarding, ...f };
        }
      }
    }

    setBundles(bundled);
    setLoading(false);
  };


  useEffect(() => { load(); }, []);

  const setStage = async (b: Bundle, stage: "kickoff_scheduled" | "project_active") => {
    const { error } = await (supabase.from("clients") as any)
      .update({ project_stage: stage })
      .eq("id", b.client.id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }

    if (stage === "kickoff_scheduled") {
      await logLeadActivity({
        type: "kickoff_scheduled" as any,
        title: "Kickoff call scheduled",
        summary: b.client.company || b.client.name || undefined,
        client_id: b.client.id,
      });
      toast({ title: "Marked as scheduled" });
    } else {
      await logLeadActivity({
        type: "kickoff_completed" as any,
        title: "Kickoff call completed",
        client_id: b.client.id,
      });
      await logLeadActivity({
        type: "project_active" as any,
        title: "Project moved to active",
        client_id: b.client.id,
      });
      toast({ title: "Project moved to active" });
    }
    load();
  };

  const openMailto = (b: Bundle) => {
    if (!b.client.email) { toast({ title: "No client email on file" }); return; }
    const portal = b.proposal?.id ? `${window.location.origin}/proposal/view/${b.proposal.id}` : window.location.origin;
    const subject = encodeURIComponent(`Let's schedule your kickoff — ${b.proposal?.service_type || "your project"}`);
    const body = encodeURIComponent(
      `Hi ${b.client.name || "there"},\n\nWe're ready to kick off ${b.proposal?.service_type || "your project"}. You can review everything and schedule your kickoff here:\n\n${portal}\n\nSpeak soon,`,
    );
    window.location.href = `mailto:${b.client.email}?subject=${subject}&body=${body}`;
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Rocket className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-bold">Kickoff</h1>
        </div>
        <p className="text-muted-foreground text-sm">Clients ready for or currently scheduling a kickoff call.</p>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : bundles.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Rocket className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">No clients waiting for kickoff</h2>
          <p className="text-sm text-muted-foreground">
            Clients appear here automatically once their contract is signed, onboarding is complete, and payment is settled.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bundles.map((b) => {
            const contractStatus = b.contract?.status || "—";
            const onboardingStatus = b.onboarding?.status || "—";
            const hasPrice = (b.proposal?.amount_cents || 0) > 0;
            const paid = hasPrice ? !!b.proposal?.client_paid : true;
            const isScheduled = b.client.project_stage === "kickoff_scheduled";

            return (
              <div key={b.client.id} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{b.client.company || b.client.name || "Client"}</h3>
                      {b.client.company && b.client.name && (
                        <div className="text-xs text-muted-foreground">{b.client.name}</div>
                      )}
                    </div>
                    <Badge variant={isScheduled ? "default" : "secondary"} className="gap-1">
                      {isScheduled ? <CalendarPlus className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      {isScheduled ? "Scheduled" : "Ready for Kickoff"}
                    </Badge>
                  </div>
                  {b.proposal?.service_type && (
                    <div className="text-sm text-muted-foreground mt-1">{b.proposal.service_type}</div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md border border-border/60 bg-background/40 p-2">
                    <div className="flex items-center gap-1 text-muted-foreground"><FileSignature className="w-3 h-3" />Contract</div>
                    <div className="font-medium capitalize mt-0.5">{contractStatus}</div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/40 p-2">
                    <div className="flex items-center gap-1 text-muted-foreground"><ClipboardList className="w-3 h-3" />Onboarding</div>
                    <div className="font-medium capitalize mt-0.5">{onboardingStatus}</div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/40 p-2">
                    <div className="flex items-center gap-1 text-muted-foreground"><CreditCard className="w-3 h-3" />Payment</div>
                    <div className="font-medium mt-0.5">{!hasPrice ? "Not Required" : paid ? "Paid" : "Pending"}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {b.onboarding?.id && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/dashboard/onboarding/${b.onboarding.id}`}>
                        <Eye className="w-3.5 h-3.5 mr-1.5" /> View onboarding
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setAgendaFor(b)}>
                    <ClipboardList className="w-3.5 h-3.5 mr-1.5" /> View kickoff agenda
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openMailto(b)}>
                    <Mail className="w-3.5 h-3.5 mr-1.5" /> Send kickoff link
                  </Button>
                  {!isScheduled && (
                    <Button size="sm" onClick={() => setStage(b, "kickoff_scheduled")}>
                      <CalendarPlus className="w-3.5 h-3.5 mr-1.5" /> Mark scheduled
                    </Button>
                  )}
                  {isScheduled && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setStage(b, "project_active")}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark completed
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <KickoffAgendaDialog
        open={!!agendaFor}
        onOpenChange={(v) => !v && setAgendaFor(null)}
        proposal={agendaFor?.proposal || null}
        onboarding={agendaFor?.onboarding || null}
      />
    </DashboardLayout>
  );
}
