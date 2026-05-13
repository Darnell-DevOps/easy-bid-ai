import { supabase } from "@/integrations/supabase/client";
import {
  Globe,
  Megaphone,
  Briefcase,
  Wrench,
  Share2,
  Repeat,
  UserCheck,
  Search,
  ShieldCheck,
  FileText,
  ListChecks,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ContractType } from "@/lib/contracts";

export type ContractTemplateSource = "custom" | "builtin_override" | "from_contract";

export interface ContractTemplateRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  contract_type: string;
  service_type: string | null;
  best_for: string | null;
  default_scope: string;
  default_timeline: string;
  default_budget: string;
  default_payment_terms: string;
  extra_clauses: string;
  icon: string | null;
  accent: string | null;
  source: ContractTemplateSource;
  builtin_id: string | null;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BuiltinContractTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  iconKey: string;
  accent: string;
  contract_type: ContractType;
  service_type: string;
  best_for: string;
  default_scope: string;
  default_timeline: string;
  default_payment_terms: string;
  extra_clauses: string;
  default_budget?: string;
}

export const BUILTIN_CONTRACT_TEMPLATES: BuiltinContractTemplate[] = [
  {
    id: "web-design-agreement",
    name: "Web Design Agreement",
    description:
      "End-to-end website design & build engagements — UX, UI, responsive development, launch & post-launch support.",
    icon: Globe,
    iconKey: "globe",
    accent: "from-accent to-purple",
    contract_type: "web_design_agreement",
    service_type: "Web Design & Development",
    best_for: "Designers, developers & studios",
    default_scope:
      "Design and develop a responsive website covering discovery, sitemap, wireframes, UI design for agreed pages, front-end build, content integration, on-page SEO, browser/device QA, and launch.",
    default_timeline: "4–8 weeks",
    default_payment_terms: "50% deposit to begin, 50% on launch",
    extra_clauses:
      "- Hosting, domains and third-party subscriptions are the Client's responsibility unless explicitly included.\n- Two rounds of revisions per phase are included; further changes are billed at the Service Provider's standard hourly rate.\n- Final files and source assets are delivered on full payment.",
  },
  {
    id: "marketing-agreement",
    name: "Marketing Services Agreement",
    description:
      "Performance, content and growth marketing engagements with clear KPIs and reporting cadence.",
    icon: Megaphone,
    iconKey: "megaphone",
    accent: "from-orange-500 to-amber-500",
    contract_type: "marketing_agreement",
    service_type: "Marketing Services",
    best_for: "Marketing consultants & agencies",
    default_scope:
      "Plan, execute and optimise marketing activity across agreed channels (paid, organic, content, email). Deliverables include a quarterly strategy, monthly campaign execution, weekly stand-ups and a monthly performance report.",
    default_timeline: "Initial 3-month term, auto-renewing monthly",
    default_payment_terms: "Monthly fee invoiced on the 1st, payable within 7 days",
    extra_clauses:
      "- Ad spend is paid directly by the Client to the platforms unless otherwise agreed.\n- Reporting KPIs are agreed at the start of each quarter and reviewed monthly.\n- Either party may terminate at the end of any month with 30 days written notice.",
  },
  {
    id: "consulting-agreement",
    name: "Consulting Agreement",
    description:
      "Advisory and strategic consulting engagements billed by project, retainer or hourly rate.",
    icon: Briefcase,
    iconKey: "briefcase",
    accent: "from-blue-500 to-cyan-500",
    contract_type: "consulting_agreement",
    service_type: "Strategic Consulting",
    best_for: "Independent consultants & advisors",
    default_scope:
      "Provide strategic consulting services including discovery interviews, analysis, written recommendations and follow-up working sessions for the agreed objectives.",
    default_timeline: "6 weeks",
    default_payment_terms: "50% on signing, 50% on delivery of the final recommendations",
    extra_clauses:
      "- All advice is provided in good faith based on information made available by the Client.\n- The Client retains final decision-making authority and accountability for actions taken.\n- Out-of-pocket expenses (travel, software, third-party reports) are pre-approved and re-charged at cost.",
  },
  {
    id: "maintenance-agreement",
    name: "Maintenance & Support Agreement",
    description:
      "Ongoing site or product maintenance — uptime monitoring, updates, fixes and support hours.",
    icon: Wrench,
    iconKey: "wrench",
    accent: "from-slate-600 to-slate-800",
    contract_type: "maintenance_agreement",
    service_type: "Maintenance & Support",
    best_for: "Studios & dev shops with retainer clients",
    default_scope:
      "Provide ongoing maintenance covering software updates, security patches, uptime monitoring, regular backups, and a defined number of support hours per month for fixes and small enhancements.",
    default_timeline: "Rolling monthly term",
    default_payment_terms: "Fixed monthly fee invoiced in advance, payable within 7 days",
    extra_clauses:
      "- Unused support hours expire at the end of each month and do not roll over.\n- Emergency response is provided during business hours; out-of-hours response requires a separate SLA addendum.\n- Major redesigns, migrations, and net-new features are quoted separately.",
  },
  {
    id: "social-media-agreement",
    name: "Social Media Management Agreement",
    description:
      "Monthly social media management — strategy, content production, scheduling, engagement and reporting.",
    icon: Share2,
    iconKey: "share2",
    accent: "from-pink-500 to-rose-500",
    contract_type: "social_media_agreement",
    service_type: "Social Media Management",
    best_for: "Social media managers & agencies",
    default_scope:
      "Manage the Client's agreed social channels: monthly content calendar, branded posts (graphics + copy), short-form video concepts, community management on weekdays, and a monthly performance report.",
    default_timeline: "Initial 3-month term, then rolling monthly",
    default_payment_terms: "Monthly fee invoiced in advance, payable within 7 days",
    extra_clauses:
      "- The Client provides timely access to brand assets, accounts and approvals.\n- Paid promotion spend is the Client's responsibility unless explicitly included.\n- Content approval turnaround is 2 business days; delays may shift scheduling.",
  },
  {
    id: "retainer-agreement",
    name: "Retainer Agreement",
    description:
      "Ongoing services delivered on a recurring monthly basis with a defined scope and hours.",
    icon: Repeat,
    iconKey: "repeat",
    accent: "from-emerald-500 to-teal-500",
    contract_type: "retainer_agreement",
    service_type: "Monthly Retainer",
    best_for: "Freelancers & agencies with ongoing clients",
    default_scope:
      "Deliver an agreed bundle of services each month, with a fair-use cap on hours and deliverables. Includes a kick-off planning call, ongoing execution, and a monthly review.",
    default_timeline: "Initial 3-month minimum, then rolling monthly",
    default_payment_terms: "Monthly retainer billed in advance on the 1st, payable within 7 days",
    extra_clauses:
      "- Unused hours do not roll over to the following month.\n- Either party may terminate at month-end with 30 days written notice.\n- Out-of-scope work is quoted and approved separately before commencing.",
  },
  {
    id: "freelancer-agreement",
    name: "Freelancer Agreement",
    description:
      "General-purpose freelance services contract suitable for most one-off project engagements.",
    icon: UserCheck,
    iconKey: "user-check",
    accent: "from-violet-500 to-fuchsia-500",
    contract_type: "freelancer_agreement",
    service_type: "Freelance Services",
    best_for: "Solo freelancers across disciplines",
    default_scope:
      "Provide the agreed services as an independent contractor, including all deliverables listed in the Scope of Work, in line with the agreed timeline and acceptance criteria.",
    default_timeline: "As agreed in the Scope of Work",
    default_payment_terms: "50% deposit on signing, balance due on completion",
    extra_clauses:
      "- The Service Provider is an independent contractor and not an employee of the Client.\n- Each party retains pre-existing intellectual property; final deliverables transfer on full payment.\n- Either party may terminate with written notice; the Client remains liable for work completed up to that date.",
  },
  {
    id: "nda",
    name: "Mutual Non-Disclosure Agreement",
    description:
      "Standard mutual NDA to protect confidential information shared between two parties.",
    icon: ShieldCheck,
    iconKey: "shield-check",
    accent: "from-slate-700 to-zinc-800",
    contract_type: "nda",
    service_type: "Confidentiality",
    best_for: "Pre-engagement and partner discussions",
    default_scope:
      "Both parties may share confidential information for the purpose of evaluating and progressing a potential business engagement.",
    default_timeline: "Confidentiality obligations last 2 years from disclosure",
    default_payment_terms: "No fees apply",
    extra_clauses:
      "- Confidential Information excludes information that is public, independently developed, or lawfully received from a third party.\n- Each party may use the Confidential Information only for the agreed purpose.\n- On request, each party will return or destroy the other's Confidential Information.",
  },
  {
    id: "discovery-agreement",
    name: "Discovery / Pre-Project Agreement",
    description:
      "Paid discovery phase that produces a written brief, recommendation and roadmap before a full project.",
    icon: Search,
    iconKey: "search",
    accent: "from-cyan-500 to-sky-600",
    contract_type: "discovery_agreement",
    service_type: "Discovery & Strategy",
    best_for: "High-value or complex client engagements",
    default_scope:
      "Conduct a paid discovery covering stakeholder interviews, current-state analysis, competitor review, and produce a written recommendation, scope outline and roadmap for a follow-on project.",
    default_timeline: "1–2 weeks",
    default_payment_terms: "100% on signing — fee credited against any follow-on engagement",
    extra_clauses:
      "- Deliverables remain the Client's property on full payment of the discovery fee.\n- The discovery does not commit either party to a follow-on engagement.\n- The Service Provider may retain anonymised insights for internal benchmarking.",
  },
  {
    id: "service-agreement",
    name: "General Service Agreement",
    description:
      "Flexible default service agreement suitable for most freelance or agency engagements.",
    icon: FileText,
    iconKey: "file-text",
    accent: "from-accent to-purple",
    contract_type: "service_agreement",
    service_type: "Professional Services",
    best_for: "Most general engagements",
    default_scope:
      "Provide the professional services described in the Scope of Work, in line with the agreed timeline, acceptance criteria and deliverables.",
    default_timeline: "As agreed",
    default_payment_terms: "50% deposit, 50% on completion",
    extra_clauses: "",
  },
  {
    id: "scope-of-work",
    name: "Scope of Work",
    description:
      "Lightweight scope document that sits under a master service agreement for a specific deliverable.",
    icon: ListChecks,
    iconKey: "list-checks",
    accent: "from-emerald-600 to-emerald-800",
    contract_type: "scope_of_work",
    service_type: "Project Scope",
    best_for: "Adding scopes under a master agreement",
    default_scope:
      "Define a specific scope of work with detailed deliverables, acceptance criteria, dependencies, and a timeline, governed by the parties' existing master agreement.",
    default_timeline: "As specified per deliverable",
    default_payment_terms: "Per the master agreement",
    extra_clauses:
      "- This Scope of Work is governed by the existing master agreement between the parties.\n- Any change request must be agreed in writing before work commences.\n- Acceptance criteria are listed against each deliverable.",
  },
];

export const CONTRACT_ACCENT_OPTIONS: { value: string; label: string }[] = [
  { value: "from-accent to-purple", label: "Purple" },
  { value: "from-blue-500 to-cyan-500", label: "Blue" },
  { value: "from-pink-500 to-rose-500", label: "Pink" },
  { value: "from-emerald-500 to-teal-500", label: "Emerald" },
  { value: "from-orange-500 to-amber-500", label: "Orange" },
  { value: "from-violet-500 to-fuchsia-500", label: "Violet" },
  { value: "from-slate-600 to-slate-800", label: "Slate" },
  { value: "from-cyan-500 to-sky-600", label: "Sky" },
];

export const CONTRACT_ICON_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "globe", label: "Web", icon: Globe },
  { value: "megaphone", label: "Marketing", icon: Megaphone },
  { value: "briefcase", label: "Consulting", icon: Briefcase },
  { value: "wrench", label: "Maintenance", icon: Wrench },
  { value: "share2", label: "Social", icon: Share2 },
  { value: "repeat", label: "Retainer", icon: Repeat },
  { value: "user-check", label: "Freelancer", icon: UserCheck },
  { value: "search", label: "Discovery", icon: Search },
  { value: "shield-check", label: "Confidential", icon: ShieldCheck },
  { value: "file-text", label: "Document", icon: FileText },
  { value: "list-checks", label: "Scope", icon: ListChecks },
  { value: "sparkles", label: "Premium", icon: Sparkles },
];

export function contractIconFromKey(key: string | null | undefined): LucideIcon {
  return CONTRACT_ICON_OPTIONS.find((o) => o.value === key)?.icon || FileText;
}

export interface MergedContractTemplate {
  rowId?: string;
  id: string; // builtin id when builtin/override; else row id
  name: string;
  description: string;
  icon: LucideIcon;
  iconKey: string;
  accent: string;
  contract_type: ContractType;
  service_type: string;
  best_for: string;
  default_scope: string;
  default_timeline: string;
  default_budget: string;
  default_payment_terms: string;
  extra_clauses: string;
  source: "builtin" | "builtin_override" | "custom" | "from_contract";
  isDefault?: boolean;
  isArchived?: boolean;
}

function rowToMerged(row: ContractTemplateRow): MergedContractTemplate {
  return {
    rowId: row.id,
    id: row.builtin_id || row.id,
    name: row.name,
    description: row.description || "",
    icon: contractIconFromKey(row.icon),
    iconKey: row.icon || "file-text",
    accent: row.accent || "from-accent to-purple",
    contract_type: (row.contract_type as ContractType) || "service_agreement",
    service_type: row.service_type || "",
    best_for: row.best_for || "",
    default_scope: row.default_scope,
    default_timeline: row.default_timeline,
    default_budget: row.default_budget,
    default_payment_terms: row.default_payment_terms,
    extra_clauses: row.extra_clauses,
    source: row.source === "builtin_override" ? "builtin_override" : (row.source as MergedContractTemplate["source"]),
    isDefault: row.is_default,
    isArchived: row.is_archived,
  };
}

function builtinToMerged(b: BuiltinContractTemplate): MergedContractTemplate {
  return {
    id: b.id,
    name: b.name,
    description: b.description,
    icon: b.icon,
    iconKey: b.iconKey,
    accent: b.accent,
    contract_type: b.contract_type,
    service_type: b.service_type,
    best_for: b.best_for,
    default_scope: b.default_scope,
    default_timeline: b.default_timeline,
    default_budget: b.default_budget || "",
    default_payment_terms: b.default_payment_terms,
    extra_clauses: b.extra_clauses,
    source: "builtin",
  };
}

export function mergeContractTemplates(rows: ContractTemplateRow[]): MergedContractTemplate[] {
  const overrides = new Map<string, ContractTemplateRow>();
  const customs: ContractTemplateRow[] = [];
  for (const r of rows) {
    if (r.is_archived) continue;
    if (r.builtin_id) overrides.set(r.builtin_id, r);
    else customs.push(r);
  }
  const builtins = BUILTIN_CONTRACT_TEMPLATES.map((b) => {
    const ov = overrides.get(b.id);
    return ov ? rowToMerged(ov) : builtinToMerged(b);
  });
  const custom = customs
    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
    .map(rowToMerged);
  return [...builtins, ...custom];
}

export async function loadContractTemplateRows(userId: string): Promise<ContractTemplateRow[]> {
  const { data, error } = await supabase
    .from("contract_templates")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ContractTemplateRow[];
}

export interface ContractTemplateFormValues {
  name: string;
  description: string;
  contract_type: ContractType;
  service_type: string;
  best_for: string;
  default_scope: string;
  default_timeline: string;
  default_budget: string;
  default_payment_terms: string;
  extra_clauses: string;
  icon: string;
  accent: string;
}

export const EMPTY_CONTRACT_FORM: ContractTemplateFormValues = {
  name: "",
  description: "",
  contract_type: "service_agreement",
  service_type: "",
  best_for: "",
  default_scope: "",
  default_timeline: "",
  default_budget: "",
  default_payment_terms: "50% deposit, 50% on completion",
  extra_clauses: "",
  icon: "file-text",
  accent: "from-accent to-purple",
};

export function templateToContractForm(t: MergedContractTemplate): ContractTemplateFormValues {
  return {
    name: t.name,
    description: t.description,
    contract_type: t.contract_type,
    service_type: t.service_type,
    best_for: t.best_for,
    default_scope: t.default_scope,
    default_timeline: t.default_timeline,
    default_budget: t.default_budget,
    default_payment_terms: t.default_payment_terms,
    extra_clauses: t.extra_clauses,
    icon: t.iconKey,
    accent: t.accent,
  };
}
