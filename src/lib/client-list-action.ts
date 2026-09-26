type ClientActionInput = { status: string; lead_quality: string | null };
type ProposalActionInput = { id: string; status: string };

export function clientListAction(client: ClientActionInput, proposal?: ProposalActionInput) {
  if (proposal?.status === "draft") return "Review Draft";
  if (proposal || client.status === "Won" || client.status === "Lost" || client.status === "Proposal Sent") return "View Client";
  if (client.lead_quality === "Low") return "Qualify Lead";
  return "Create Proposal";
}
