// Ready-made follow-up messages for the Recovery dashboard.
// Plain copy-and-paste templates the user can send via email/SMS.

export type RecoveryTemplateKind =
  | "payment_failed_first"
  | "payment_failed_followup"
  | "payment_final_notice"
  | "invoice_due_soon"
  | "invoice_overdue"
  | "renewal_reminder"
  | "chronic_late_check_in";

export interface RecoveryTemplateInput {
  clientName: string;
  amount?: string;
  dueDate?: string;
  recoveryUrl?: string;
  invoiceUrl?: string;
  senderName?: string;
  serviceTitle?: string;
}

export interface RecoveryTemplate {
  label: string;
  subject: string;
  body: string;
}

function firstName(name: string): string {
  return (name || "there").trim().split(/\s+/)[0] || "there";
}

export function buildRecoveryTemplate(
  kind: RecoveryTemplateKind,
  input: RecoveryTemplateInput,
): RecoveryTemplate {
  const name = firstName(input.clientName);
  const sender = input.senderName || "";
  const sign = sender ? `\n\nThanks,\n${sender}` : "\n\nThanks!";
  const url = input.recoveryUrl || input.invoiceUrl || "";
  const amount = input.amount || "";
  const due = input.dueDate || "";
  const svc = input.serviceTitle || "your retainer";

  switch (kind) {
    case "payment_failed_first":
      return {
        label: "Payment failed — friendly first nudge",
        subject: "Quick heads-up about your last payment",
        body:
          `Hi ${name},\n\nJust a heads-up — your most recent payment for ${svc}${amount ? ` (${amount})` : ""} didn't go through. It's usually something small like an expired card.\n\nYou can update your payment details here in under a minute:\n${url}\n\nLet me know if you hit any issues.${sign}`,
      };
    case "payment_failed_followup":
      return {
        label: "Payment failed — second reminder",
        subject: "Following up on your payment",
        body:
          `Hi ${name},\n\nFollowing up — the payment for ${svc} is still showing as failed on my side. To keep everything running without interruption, could you update your card here?\n\n${url}\n\nHappy to help if anything's blocking it.${sign}`,
      };
    case "payment_final_notice":
      return {
        label: "Final notice — service pause",
        subject: "Final notice — action needed",
        body:
          `Hi ${name},\n\nI've tried to process the payment for ${svc} a few times now without success. To avoid pausing the work on my end, please update your payment details today:\n\n${url}\n\nIf there's a billing issue I should know about, just reply to this email and we'll sort it out.${sign}`,
      };
    case "invoice_due_soon":
      return {
        label: "Invoice due soon",
        subject: `Invoice due ${due || "soon"}`,
        body:
          `Hi ${name},\n\nQuick reminder that your invoice${amount ? ` for ${amount}` : ""} is due ${due ? `on ${due}` : "soon"}.\n\nYou can pay it here:\n${url}\n\nThanks for staying on top of this.${sign}`,
      };
    case "invoice_overdue":
      return {
        label: "Invoice overdue",
        subject: "Overdue invoice — quick reminder",
        body:
          `Hi ${name},\n\nJust circling back — your invoice${amount ? ` for ${amount}` : ""} was due ${due ? `on ${due}` : "recently"} and is now overdue.\n\nYou can settle it here:\n${url}\n\nIf there's an issue with the invoice, let me know and I'll get it sorted.${sign}`,
      };
    case "renewal_reminder":
      return {
        label: "Renewal reminder",
        subject: "Your retainer is up for renewal",
        body:
          `Hi ${name},\n\n${svc} is coming up for renewal${due ? ` on ${due}` : ""}. I've loved working with you and would love to keep things going.\n\nLet me know if you'd like to renew as-is, adjust the scope, or jump on a quick call to plan the next quarter.${sign}`,
      };
    case "chronic_late_check_in":
      return {
        label: "Chronic late-payer — gentle check-in",
        subject: "A quick chat about billing?",
        body:
          `Hi ${name},\n\nI noticed payments for ${svc} have been running late a few times. No drama — I just wanted to check in and see if there's a better billing day, payment method, or cadence that would make life easier on your side.\n\nHappy to adjust things so it's frictionless going forward.${sign}`,
      };
  }
}

export const ALL_TEMPLATE_KINDS: RecoveryTemplateKind[] = [
  "payment_failed_first",
  "payment_failed_followup",
  "payment_final_notice",
  "invoice_due_soon",
  "invoice_overdue",
  "renewal_reminder",
  "chronic_late_check_in",
];
