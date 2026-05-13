import { supabase } from "@/integrations/supabase/client";
import { templates as builtinTemplates, type TemplateData } from "@/pages/Templates";
import {
  Globe,
  Share2,
  Palette,
  TrendingUp,
  Sparkles,
  FileText,
  Briefcase,
  Megaphone,
  Camera,
  Code,
  PenTool,
  type LucideIcon,
} from "lucide-react";

export type TemplateSource = "custom" | "builtin_override" | "from_proposal";

export interface ProposalTemplateRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  service_type: string | null;
  best_for: string | null;
  deal_size: string | null;
  tone: string | null;
  default_goals: string | null;
  default_deliverables: string | null;
  project_scope: string;
  budget: string;
  timeline: string;
  notes: string;
  icon: string | null;
  accent: string | null;
  source: TemplateSource;
  builtin_id: string | null;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export const ICON_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "globe", label: "Website", icon: Globe },
  { value: "share2", label: "Social", icon: Share2 },
  { value: "palette", label: "Design", icon: Palette },
  { value: "trending-up", label: "Growth", icon: TrendingUp },
  { value: "sparkles", label: "Premium", icon: Sparkles },
  { value: "file-text", label: "Document", icon: FileText },
  { value: "briefcase", label: "Consulting", icon: Briefcase },
  { value: "megaphone", label: "Marketing", icon: Megaphone },
  { value: "camera", label: "Content", icon: Camera },
  { value: "code", label: "Development", icon: Code },
  { value: "pen-tool", label: "Branding", icon: PenTool },
];

export const ACCENT_OPTIONS: { value: string; label: string }[] = [
  { value: "from-accent to-purple", label: "Purple" },
  { value: "from-blue-500 to-cyan-500", label: "Blue" },
  { value: "from-pink-500 to-rose-500", label: "Pink" },
  { value: "from-emerald-500 to-teal-500", label: "Emerald" },
  { value: "from-orange-500 to-amber-500", label: "Orange" },
  { value: "from-violet-500 to-fuchsia-500", label: "Violet" },
  { value: "from-slate-600 to-slate-800", label: "Slate" },
];

export function iconFromKey(key: string | null | undefined): LucideIcon {
  return ICON_OPTIONS.find((o) => o.value === key)?.icon || Sparkles;
}

/** A template ready to be rendered + used by NewProposal. */
export interface MergedTemplate extends TemplateData {
  rowId?: string; // db row id when this comes from / overrides db
  source: "builtin" | "builtin_override" | "custom" | "from_proposal";
  isDefault?: boolean;
  isArchived?: boolean;
  description: string;
}

function rowToTemplateData(row: ProposalTemplateRow): MergedTemplate {
  return {
    id: row.builtin_id || row.id,
    name: row.name,
    description: row.description || "",
    icon: iconFromKey(row.icon),
    accent: row.accent || "from-accent to-purple",
    serviceType: row.service_type || "",
    bestFor: row.best_for || "Your team",
    dealSize: row.deal_size || "",
    timeSaved: "~30 min",
    tone: (row.tone as TemplateData["tone"]) || "professional",
    defaultGoals: row.default_goals || "",
    defaultDeliverables: row.default_deliverables || "",
    prefill: {
      project_scope: row.project_scope,
      budget: row.budget,
      timeline: row.timeline,
      notes: row.notes,
    },
    rowId: row.id,
    source: row.source === "builtin_override" ? "builtin_override" : row.source as MergedTemplate["source"],
    isDefault: row.is_default,
    isArchived: row.is_archived,
  };
}

/** Merge built-in templates with user overrides + custom templates. */
export function mergeTemplates(rows: ProposalTemplateRow[]): MergedTemplate[] {
  const overrides = new Map<string, ProposalTemplateRow>();
  const customs: ProposalTemplateRow[] = [];
  for (const r of rows) {
    if (r.is_archived) continue;
    if (r.builtin_id) overrides.set(r.builtin_id, r);
    else customs.push(r);
  }

  const builtins: MergedTemplate[] = builtinTemplates.map((t) => {
    const ov = overrides.get(t.id);
    if (ov) return rowToTemplateData(ov);
    return {
      ...t,
      description: t.description,
      source: "builtin",
    };
  });

  const custom = customs
    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
    .map(rowToTemplateData);

  return [...builtins, ...custom];
}

export async function loadProposalTemplateRows(userId: string): Promise<ProposalTemplateRow[]> {
  const { data, error } = await supabase
    .from("proposal_templates")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ProposalTemplateRow[];
}

export interface TemplateFormValues {
  name: string;
  description: string;
  service_type: string;
  best_for: string;
  deal_size: string;
  tone: "professional" | "persuasive" | "concise";
  default_goals: string;
  default_deliverables: string;
  project_scope: string;
  budget: string;
  timeline: string;
  notes: string;
  icon: string;
  accent: string;
}

export const EMPTY_FORM: TemplateFormValues = {
  name: "",
  description: "",
  service_type: "",
  best_for: "",
  deal_size: "",
  tone: "professional",
  default_goals: "",
  default_deliverables: "",
  project_scope: "",
  budget: "",
  timeline: "",
  notes: "",
  icon: "sparkles",
  accent: "from-accent to-purple",
};

export function templateToForm(t: MergedTemplate): TemplateFormValues {
  // Try to map back the icon name from component
  const iconKey = ICON_OPTIONS.find((o) => o.icon === t.icon)?.value || "sparkles";
  return {
    name: t.name,
    description: t.description || "",
    service_type: t.serviceType || "",
    best_for: t.bestFor || "",
    deal_size: t.dealSize || "",
    tone: (t.tone as TemplateFormValues["tone"]) || "professional",
    default_goals: t.defaultGoals || "",
    default_deliverables: t.defaultDeliverables || "",
    project_scope: t.prefill.project_scope || "",
    budget: t.prefill.budget || "",
    timeline: t.prefill.timeline || "",
    notes: t.prefill.notes || "",
    icon: iconKey,
    accent: t.accent || "from-accent to-purple",
  };
}
