import { supabase } from "@/integrations/supabase/client";
import {
  Megaphone,
  Search,
  Wrench,
  Briefcase,
  FileText,
  Palette,
  Target,
  Share2,
  Repeat,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type RetainerTemplateSource = "custom" | "builtin_override" | "from_retainer";
export type BillingInterval = "weekly" | "monthly" | "quarterly" | "custom";

export interface RetainerTemplateRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  service_type: string | null;
  best_for: string | null;
  default_amount_cents: number;
  default_currency: string;
  default_interval: string;
  default_custom_days: number | null;
  default_bullets: string;
  notes: string;
  icon: string | null;
  accent: string | null;
  source: RetainerTemplateSource;
  builtin_id: string | null;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BuiltinRetainerTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  iconKey: string;
  accent: string;
  service_type: string;
  best_for: string;
  default_amount_cents: number;
  default_currency: string;
  default_interval: BillingInterval;
  default_bullets: string; // newline-separated
}

export const BUILTIN_RETAINER_TEMPLATES: BuiltinRetainerTemplate[] = [
  {
    id: "monthly-marketing-retainer",
    name: "Monthly Marketing Retainer",
    description:
      "Strategic marketing oversight, multi-channel campaigns and monthly reporting.",
    icon: Megaphone,
    iconKey: "megaphone",
    accent: "from-orange-500 to-amber-500",
    service_type: "Marketing",
    best_for: "Agencies & marketing consultants",
    default_amount_cents: 150000,
    default_currency: "GBP",
    default_interval: "monthly",
    default_bullets:
      "Monthly strategy session\nCampaign planning & execution\nEmail + paid coordination\nMonthly KPI dashboard",
  },
  {
    id: "seo-retainer",
    name: "SEO Retainer",
    description:
      "Ongoing search optimisation: technical SEO, content production and link building.",
    icon: Search,
    iconKey: "search",
    accent: "from-emerald-500 to-teal-500",
    service_type: "SEO",
    best_for: "SEO specialists & content agencies",
    default_amount_cents: 100000,
    default_currency: "GBP",
    default_interval: "monthly",
    default_bullets:
      "Monthly keyword & ranking report\nOn-page SEO improvements\n1 long-form content piece\nLink building outreach",
  },
  {
    id: "website-maintenance",
    name: "Website Maintenance",
    description:
      "Keep the site secure, fast and up to date — backups, updates and small edits each month.",
    icon: Wrench,
    iconKey: "wrench",
    accent: "from-slate-600 to-slate-800",
    service_type: "Web Maintenance",
    best_for: "Studios & freelancers with active sites",
    default_amount_cents: 50000,
    default_currency: "GBP",
    default_interval: "monthly",
    default_bullets:
      "Plugin & core updates\nDaily backups\nUptime & security monitoring\n2 hours of small edits / month",
  },
  {
    id: "consulting-retainer",
    name: "Consulting Retainer",
    description:
      "Reserved consulting hours each month for advisory and execution support.",
    icon: Briefcase,
    iconKey: "briefcase",
    accent: "from-blue-500 to-cyan-500",
    service_type: "Consulting",
    best_for: "Independent consultants & advisors",
    default_amount_cents: 120000,
    default_currency: "GBP",
    default_interval: "monthly",
    default_bullets:
      "8 reserved hours per month\nAsync Slack/email access\nMonthly review call\nPriority response within 24h",
  },
  {
    id: "content-management",
    name: "Content Management",
    description:
      "Editorial planning, content production and publishing across owned channels.",
    icon: FileText,
    iconKey: "file-text",
    accent: "from-violet-500 to-fuchsia-500",
    service_type: "Content",
    best_for: "Content marketers & studios",
    default_amount_cents: 90000,
    default_currency: "GBP",
    default_interval: "monthly",
    default_bullets:
      "Monthly editorial calendar\n4 long-form articles\nOn-page SEO + internal linking\nMonthly content performance report",
  },
  {
    id: "design-support",
    name: "Design Support",
    description:
      "Ongoing design support for marketing assets, social graphics and product UI updates.",
    icon: Palette,
    iconKey: "palette",
    accent: "from-pink-500 to-rose-500",
    service_type: "Design",
    best_for: "Designers & studios with retainer clients",
    default_amount_cents: 80000,
    default_currency: "GBP",
    default_interval: "monthly",
    default_bullets:
      "Reserved design hours each month\nMarketing & social assets\nLanding page & UI tweaks\n48h turnaround on small jobs",
  },
  {
    id: "ad-management",
    name: "Ad Management",
    description:
      "Paid media management across Meta, Google and LinkedIn with weekly optimisation.",
    icon: Target,
    iconKey: "target",
    accent: "from-cyan-500 to-sky-600",
    service_type: "Paid Media",
    best_for: "Performance marketers & agencies",
    default_amount_cents: 110000,
    default_currency: "GBP",
    default_interval: "monthly",
    default_bullets:
      "Campaign setup & creative briefs\nWeekly bid & budget optimisation\nA/B testing of audiences & creative\nMonthly performance report (excludes ad spend)",
  },
  {
    id: "social-media-management",
    name: "Social Media Management",
    description:
      "Monthly content creation, scheduling and community management across channels.",
    icon: Share2,
    iconKey: "share2",
    accent: "from-accent to-purple",
    service_type: "Social Media",
    best_for: "Social media managers & studios",
    default_amount_cents: 75000,
    default_currency: "GBP",
    default_interval: "monthly",
    default_bullets:
      "12 posts per month across 2 platforms\nMonthly content calendar\nCommunity engagement & DMs\nMonthly performance report",
  },
];

export const RETAINER_ACCENT_OPTIONS: { value: string; label: string }[] = [
  { value: "from-accent to-purple", label: "Purple" },
  { value: "from-blue-500 to-cyan-500", label: "Blue" },
  { value: "from-pink-500 to-rose-500", label: "Pink" },
  { value: "from-emerald-500 to-teal-500", label: "Emerald" },
  { value: "from-orange-500 to-amber-500", label: "Orange" },
  { value: "from-violet-500 to-fuchsia-500", label: "Violet" },
  { value: "from-slate-600 to-slate-800", label: "Slate" },
  { value: "from-cyan-500 to-sky-600", label: "Sky" },
];

export const RETAINER_ICON_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "megaphone", label: "Marketing", icon: Megaphone },
  { value: "search", label: "SEO", icon: Search },
  { value: "wrench", label: "Maintenance", icon: Wrench },
  { value: "briefcase", label: "Consulting", icon: Briefcase },
  { value: "file-text", label: "Content", icon: FileText },
  { value: "palette", label: "Design", icon: Palette },
  { value: "target", label: "Ads", icon: Target },
  { value: "share2", label: "Social", icon: Share2 },
  { value: "repeat", label: "Retainer", icon: Repeat },
  { value: "sparkles", label: "Premium", icon: Sparkles },
];

export function retainerIconFromKey(key: string | null | undefined): LucideIcon {
  return RETAINER_ICON_OPTIONS.find((o) => o.value === key)?.icon || Repeat;
}

export interface MergedRetainerTemplate {
  rowId?: string;
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  iconKey: string;
  accent: string;
  service_type: string;
  best_for: string;
  default_amount_cents: number;
  default_currency: string;
  default_interval: BillingInterval;
  default_custom_days: number | null;
  default_bullets: string;
  notes: string;
  source: "builtin" | "builtin_override" | "custom" | "from_retainer";
  isDefault?: boolean;
  isArchived?: boolean;
}

function rowToMerged(row: RetainerTemplateRow): MergedRetainerTemplate {
  return {
    rowId: row.id,
    id: row.builtin_id || row.id,
    name: row.name,
    description: row.description || "",
    icon: retainerIconFromKey(row.icon),
    iconKey: row.icon || "repeat",
    accent: row.accent || "from-accent to-purple",
    service_type: row.service_type || "",
    best_for: row.best_for || "",
    default_amount_cents: row.default_amount_cents,
    default_currency: row.default_currency,
    default_interval: (row.default_interval as BillingInterval) || "monthly",
    default_custom_days: row.default_custom_days,
    default_bullets: row.default_bullets,
    notes: row.notes,
    source:
      row.source === "builtin_override"
        ? "builtin_override"
        : (row.source as MergedRetainerTemplate["source"]),
    isDefault: row.is_default,
    isArchived: row.is_archived,
  };
}

function builtinToMerged(b: BuiltinRetainerTemplate): MergedRetainerTemplate {
  return {
    id: b.id,
    name: b.name,
    description: b.description,
    icon: b.icon,
    iconKey: b.iconKey,
    accent: b.accent,
    service_type: b.service_type,
    best_for: b.best_for,
    default_amount_cents: b.default_amount_cents,
    default_currency: b.default_currency,
    default_interval: b.default_interval,
    default_custom_days: null,
    default_bullets: b.default_bullets,
    notes: "",
    source: "builtin",
  };
}

export function mergeRetainerTemplates(rows: RetainerTemplateRow[]): MergedRetainerTemplate[] {
  const overrides = new Map<string, RetainerTemplateRow>();
  const customs: RetainerTemplateRow[] = [];
  for (const r of rows) {
    if (r.is_archived) continue;
    if (r.builtin_id) overrides.set(r.builtin_id, r);
    else customs.push(r);
  }
  const builtins = BUILTIN_RETAINER_TEMPLATES.map((b) => {
    const ov = overrides.get(b.id);
    return ov ? rowToMerged(ov) : builtinToMerged(b);
  });
  const custom = customs
    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
    .map(rowToMerged);
  return [...builtins, ...custom];
}

export async function loadRetainerTemplateRows(userId: string): Promise<RetainerTemplateRow[]> {
  const { data, error } = await supabase
    .from("retainer_templates" as any)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as RetainerTemplateRow[];
}

export interface RetainerTemplateFormValues {
  name: string;
  description: string;
  service_type: string;
  best_for: string;
  default_amount: string; // dollars/pounds string
  default_currency: string;
  default_interval: BillingInterval;
  default_custom_days: string;
  default_bullets: string;
  notes: string;
  icon: string;
  accent: string;
}

export const EMPTY_RETAINER_FORM: RetainerTemplateFormValues = {
  name: "",
  description: "",
  service_type: "",
  best_for: "",
  default_amount: "",
  default_currency: "GBP",
  default_interval: "monthly",
  default_custom_days: "30",
  default_bullets: "",
  notes: "",
  icon: "repeat",
  accent: "from-accent to-purple",
};

export function templateToRetainerForm(t: MergedRetainerTemplate): RetainerTemplateFormValues {
  return {
    name: t.name,
    description: t.description,
    service_type: t.service_type,
    best_for: t.best_for,
    default_amount: t.default_amount_cents ? (t.default_amount_cents / 100).toFixed(0) : "",
    default_currency: t.default_currency || "GBP",
    default_interval: t.default_interval || "monthly",
    default_custom_days: String(t.default_custom_days || 30),
    default_bullets: t.default_bullets,
    notes: t.notes,
    icon: t.iconKey,
    accent: t.accent,
  };
}
