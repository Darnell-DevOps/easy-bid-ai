// Auto Follow-Up engine: derive scenario + pre-written message from proposal timestamps.

export type FollowUpScenario =
  | "not_viewed_24h"
  | "viewed_no_action_48h"
  | "accepted_unpaid_24h"
  | "none";

export interface FollowUpInput {
  status?: string | null;
  client_paid?: boolean | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  paid_at?: string | null;
}

const HOUR = 60 * 60 * 1000;

function hoursSince(iso?: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return (Date.now() - t) / HOUR;
}

export function getFollowUpScenario(p: FollowUpInput): FollowUpScenario {
  const status = (p.status || "").toLowerCase();
  if (p.client_paid) return "none";
  if (status === "rejected") return "none";

  if (status === "accepted" && hoursSince(p.accepted_at) >= 24) {
    return "accepted_unpaid_24h";
  }
  if (status === "viewed" && hoursSince(p.viewed_at) >= 48) {
    return "viewed_no_action_48h";
  }
  if (status === "sent" && !p.viewed_at && hoursSince(p.sent_at) >= 24) {
    return "not_viewed_24h";
  }
  return "none";
}

export interface FollowUpMeta {
  badge: string;
  headline: string;
  description: string;
  tone: "info" | "warning" | "success";
}

export const FOLLOW_UP_META: Record<Exclude<FollowUpScenario, "none">, FollowUpMeta> = {
  not_viewed_24h: {
    badge: "Follow-up needed",
    headline: "Follow up with this client",
    description: "Sent over 24 hours ago and not viewed yet. A friendly nudge often gets it opened.",
    tone: "warning",
  },
  viewed_no_action_48h: {
    badge: "Ready to close",
    headline: "Proposal viewed — ready to close",
    description: "Client opened it but hasn't responded in 48 hours. Now's the moment to follow up.",
    tone: "info",
  },
  accepted_unpaid_24h: {
    badge: "Payment pending",
    headline: "Payment pending",
    description: "Accepted over 24 hours ago without payment. Send a gentle payment reminder.",
    tone: "warning",
  },
};

export interface FollowUpTemplateInput {
  clientName: string;
  companyName?: string;
  serviceType?: string;
  proposalUrl: string;
  senderName?: string;
}

export interface FollowUpTemplate {
  subject: string;
  body: string;
}

export function buildFollowUpTemplate(
  scenario: Exclude<FollowUpScenario, "none">,
  input: FollowUpTemplateInput,
): FollowUpTemplate {
  const name = (input.clientName || "there").split(" ")[0];
  const sender = input.senderName || "";
  const sign = sender ? `\n\nBest,\n${sender}` : "\n\nThanks!";
  const url = input.proposalUrl;
  const service = input.serviceType ? input.serviceType.toLowerCase() : "the project";

  switch (scenario) {
    case "not_viewed_24h":
      return {
        subject: "Quick nudge on your proposal",
        body:
          `Hi ${name},\n\nJust checking in to make sure my proposal made it through. I put together a clear plan for ${service} based on what we discussed — you can review it here:\n${url}\n\nHappy to walk you through it or answer any questions.${sign}`,
      };
    case "viewed_no_action_48h":
      return {
        subject: "Any thoughts on the proposal?",
        body:
          `Hi ${name},\n\nThanks for taking a look at the proposal. I wanted to check in and see if you had any questions, or if there's anything you'd like to adjust before we move forward.\n\nProposal link for reference:\n${url}\n\nHappy to jump on a quick call if that's easier.${sign}`,
      };
    case "accepted_unpaid_24h":
      return {
        subject: "Securing your project start",
        body:
          `Hi ${name},\n\nExcited to get started! Just a quick reminder to complete payment so I can lock in your project slot and begin work.\n\nYou can pay securely here:\n${url}\n\nLet me know if you hit any issues.${sign}`,
      };
  }
}
