import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type ProposalLite = {
  service_type?: string | null;
  project_scope?: string | null;
  budget?: string | null;
  timeline?: string | null;
  notes?: string | null;
  client_name?: string | null;
  company_name?: string | null;
} | null;

type OnboardingLite = {
  fields?: any;
  responses?: Record<string, any> | null;
} | null;

function renderResponse(field: any, value: any): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? v : v?.name ?? "file")).join(", ");
  if (typeof value === "object") return value?.name ?? JSON.stringify(value);
  return String(value);
}

function extractOnboarding(onboarding: OnboardingLite): { label: string; value: string }[] {
  if (!onboarding) return [];
  const fields = Array.isArray(onboarding.fields) ? onboarding.fields : [];
  const responses = onboarding.responses || {};
  const out: { label: string; value: string }[] = [];
  for (const f of fields) {
    if (!f?.id) continue;
    const v = renderResponse(f, responses[f.id]);
    if (v) out.push({ label: f.label || f.id, value: v });
  }
  return out;
}

export function KickoffAgendaDialog({
  open,
  onOpenChange,
  proposal,
  onboarding,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proposal: ProposalLite;
  onboarding: OnboardingLite;
}) {
  const answers = extractOnboarding(onboarding);
  const who = proposal?.company_name || proposal?.client_name || "Client";

  const sections: { title: string; body: React.ReactNode; text: string }[] = [
    {
      title: "Project Summary",
      body: (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {proposal?.project_scope || proposal?.notes || `Kickoff call for ${who}'s ${proposal?.service_type || "project"}.`}
        </p>
      ),
      text: proposal?.project_scope || proposal?.notes || `Kickoff call for ${who}'s ${proposal?.service_type || "project"}.`,
    },
    {
      title: "Goals",
      body: (
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Confirm the primary outcome {who} expects from this engagement.</li>
          <li>Align on success metrics and how they'll be measured.</li>
          {answers.slice(0, 3).map((a) => (
            <li key={a.label}><span className="text-foreground">{a.label}:</span> {a.value}</li>
          ))}
        </ul>
      ),
      text: `- Confirm primary outcome\n- Align on success metrics${answers.slice(0, 3).map((a) => `\n- ${a.label}: ${a.value}`).join("")}`,
    },
    {
      title: "Deliverables",
      body: (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {proposal?.project_scope || "Walk through each deliverable from the proposal and confirm scope."}
        </p>
      ),
      text: proposal?.project_scope || "Walk through each deliverable from the proposal and confirm scope.",
    },
    {
      title: "Timeline",
      body: <p className="text-sm text-muted-foreground">{proposal?.timeline || "Confirm start date, key milestones, and target completion."}</p>,
      text: proposal?.timeline || "Confirm start date, key milestones, and target completion.",
    },
    {
      title: "Client Responsibilities",
      body: (
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Provide access, assets, and approvals in a timely manner.</li>
          <li>Nominate a single point of contact for decisions.</li>
          <li>Respond to review requests within the agreed SLA.</li>
        </ul>
      ),
      text: "- Provide access, assets, and approvals\n- Nominate a single point of contact\n- Respond to reviews within SLA",
    },
    {
      title: "Provider Responsibilities",
      body: (
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Deliver on scope within the agreed timeline and budget ({proposal?.budget || "as per proposal"}).</li>
          <li>Provide regular status updates.</li>
          <li>Flag risks and blockers early.</li>
        </ul>
      ),
      text: `- Deliver on scope within timeline & budget (${proposal?.budget || "as per proposal"})\n- Provide regular status updates\n- Flag risks & blockers early`,
    },
    {
      title: "Questions to Confirm",
      body: answers.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          {answers.map((a) => (
            <li key={a.label}><span className="text-foreground">{a.label}:</span> {a.value}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No onboarding answers on file — review the proposal together and note any gaps.</p>
      ),
      text: answers.length > 0 ? answers.map((a) => `- ${a.label}: ${a.value}`).join("\n") : "No onboarding answers on file.",
    },
    {
      title: "Next Actions",
      body: (
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Confirm kickoff completion and mark the project active.</li>
          <li>Schedule the first working session / recurring check-in.</li>
          <li>Share the project channel and shared drive with {who}.</li>
        </ul>
      ),
      text: `- Confirm kickoff completion & activate project\n- Schedule first working session\n- Share project channel with ${who}`,
    },
  ];

  const fullText = sections.map((s) => `# ${s.title}\n${s.text}`).join("\n\n");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kickoff agenda — {who}</DialogTitle>
          <DialogDescription>{proposal?.service_type || "Project kickoff"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          {sections.map((s) => (
            <div key={s.title}>
              <h3 className="text-sm font-semibold text-foreground mb-1.5">{s.title}</h3>
              {s.body}
            </div>
          ))}
        </div>
        <div className="pt-4 border-t flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(fullText);
              toast({ title: "Agenda copied to clipboard" });
            }}
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy agenda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
