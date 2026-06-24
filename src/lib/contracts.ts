export const CONTRACT_TYPES = [
  { value: "service_agreement", label: "Service Agreement" },
  { value: "project_agreement", label: "Project Agreement" },
  { value: "retainer_agreement", label: "Retainer Agreement" },
  { value: "web_design_agreement", label: "Web Design Agreement" },
  { value: "marketing_agreement", label: "Marketing Services Agreement" },
  { value: "consulting_agreement", label: "Consulting Agreement" },
  { value: "maintenance_agreement", label: "Maintenance & Support Agreement" },
  { value: "social_media_agreement", label: "Social Media Management Agreement" },
  { value: "freelancer_agreement", label: "Freelancer Agreement" },
  { value: "discovery_agreement", label: "Discovery / Pre-Project Agreement" },
  { value: "nda", label: "Non-Disclosure Agreement" },
  { value: "scope_of_work", label: "Scope of Work" },
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number]["value"];

export interface ContractRow {
  id: string;
  user_id: string;
  proposal_id: string | null;
  client_id: string | null;
  contract_type: string;
  title: string;
  client_name: string;
  client_email: string | null;
  company_name: string | null;
  body: string;
  amount_cents: number | null;
  currency: string | null;
  status: string;
  signing_token: string;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  countersigned_at?: string | null;
  countersigner_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractSignatureRow {
  id: string;
  contract_id: string;
  user_id: string;
  signer_name: string;
  signer_email: string | null;
  method: "typed" | "drawn";
  signature_data: string;
  ip_address: string | null;
  user_agent: string | null;
  signed_at: string;
  signer_role?: "client" | "provider";
}

export function contractTypeLabel(type: string): string {
  return CONTRACT_TYPES.find((t) => t.value === type)?.label || "Contract";
}

export function contractStatusLabel(s: string): string {
  switch (s) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "viewed":
      return "Viewed";
    case "signed":
      return "Signed";
    default:
      return s;
  }
}
