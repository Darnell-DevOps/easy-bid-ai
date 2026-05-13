import { supabase } from "@/integrations/supabase/client";
import {
  Globe,
  Palette,
  Briefcase,
  Building2,
  GraduationCap,
  Megaphone,
  ClipboardList,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { OnboardingField } from "@/lib/onboarding";

export type OnboardingTemplateSource = "custom" | "builtin_override" | "from_form";

/** A file the agency asks the client to provide (link or upload). */
export interface FileRequest {
  label: string;
  description?: string;
  required?: boolean;
}

/** A suggested kickoff deadline, expressed as days after onboarding starts. */
export interface DeadlineItem {
  label: string;
  days_after_kickoff: number;
}

export interface OnboardingTemplateRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  service_type: string | null;
  best_for: string | null;
  intro: string;
  fields: OnboardingField[];
  file_requests: FileRequest[];
  deadlines: DeadlineItem[];
  notes: string;
  icon: string | null;
  accent: string | null;
  source: OnboardingTemplateSource;
  builtin_id: string | null;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BuiltinOnboardingTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  iconKey: string;
  accent: string;
  service_type: string;
  best_for: string;
  intro: string;
  fields: OnboardingField[];
  file_requests: FileRequest[];
  deadlines: DeadlineItem[];
}

// ---------- Built-in template field bundles ----------

const COMMON_BUSINESS: OnboardingField[] = [
  { id: "business_name", label: "Business name", type: "short_text", required: true, group: "About your business" },
  { id: "primary_contact", label: "Primary point of contact", type: "short_text", group: "About your business" },
  { id: "project_goals", label: "Top 3 goals for this project", type: "long_text", required: true, placeholder: "What does success look like in 90 days?", group: "About your business" },
  { id: "target_audience", label: "Target audience", type: "long_text", placeholder: "Who are we trying to reach?", group: "About your business" },
];

export const BUILTIN_ONBOARDING_TEMPLATES: BuiltinOnboardingTemplate[] = [
  {
    id: "web-design",
    name: "Web Design Onboarding",
    description: "Capture sitemap, brand assets, hosting access and inspiration to start a website project.",
    icon: Globe,
    iconKey: "globe",
    accent: "from-accent to-purple",
    service_type: "Web Design & Development",
    best_for: "Designers, developers & studios",
    intro:
      "Welcome aboard — we're building a website that reflects your brand and converts. Please answer a few questions, share your assets and we'll have a kickoff call within a week.",
    fields: [
      ...COMMON_BUSINESS,
      { id: "sitemap_needs", label: "Pages / sitemap you need", type: "long_text", required: true, placeholder: "Home, About, Services, Contact…", group: "Website specifics" },
      { id: "inspiration_sites", label: "Inspiration websites", type: "long_text", placeholder: "URLs of sites you love and why", group: "Website specifics" },
      { id: "current_url", label: "Current website URL", type: "url", group: "Website specifics" },
      { id: "hosting_domain", label: "Hosting & domain details", type: "long_text", placeholder: "Where is the domain registered? Where is hosting?", group: "Website specifics" },
      { id: "tech_stack", label: "Preferred tech stack (optional)", type: "short_text", placeholder: "Webflow, WordPress, custom…", group: "Website specifics" },
      { id: "brand_preferences", label: "Brand preferences", type: "long_text", placeholder: "Tone, vibe, colours, fonts you love", group: "Brand" },
      { id: "preferred_deadline", label: "Preferred launch date", type: "date", group: "Timing" },
    ],
    file_requests: [
      { label: "Brand logo & lockups", description: "SVG or high-res PNG", required: true },
      { label: "Brand guidelines", description: "PDF or link" },
      { label: "Page copy / content", description: "Doc per page or shared Google Drive folder" },
      { label: "Photography / image library", description: "Drive, Dropbox or Notion link" },
      { label: "Hosting & DNS access", description: "Share securely (1Password, LastPass, Vault)" },
    ],
    deadlines: [
      { label: "Kickoff call scheduled", days_after_kickoff: 3 },
      { label: "All assets & access shared", days_after_kickoff: 7 },
      { label: "Wireframes approved", days_after_kickoff: 14 },
      { label: "Design sign-off", days_after_kickoff: 28 },
    ],
  },
  {
    id: "branding",
    name: "Branding Onboarding",
    description: "Discover the brand: positioning, audience, competitors, style references and visual direction.",
    icon: Palette,
    iconKey: "palette",
    accent: "from-pink-500 to-rose-500",
    service_type: "Brand Identity",
    best_for: "Brand designers & studios",
    intro:
      "We're about to shape your brand identity. The more honest detail you share now, the sharper and more distinctive your brand will be.",
    fields: [
      ...COMMON_BUSINESS,
      { id: "brand_story", label: "Brand story / origin", type: "long_text", placeholder: "Why does the business exist?", group: "Brand strategy" },
      { id: "values", label: "Core values", type: "long_text", placeholder: "3–5 values that drive decisions", group: "Brand strategy" },
      { id: "competitors", label: "Main competitors", type: "long_text", placeholder: "List 3–5 competitors with links", group: "Brand strategy" },
      { id: "differentiation", label: "What makes you different?", type: "long_text", group: "Brand strategy" },
      { id: "color_preferences", label: "Colour preferences / aversions", type: "long_text", group: "Visual direction" },
      { id: "style_references", label: "Style references", type: "long_text", placeholder: "Brands, moodboards, Pinterest links", group: "Visual direction" },
      { id: "logo_inspiration", label: "Logo inspiration", type: "long_text", group: "Visual direction" },
      { id: "preferred_deadline", label: "Brand launch deadline", type: "date", group: "Timing" },
    ],
    file_requests: [
      { label: "Existing logo & marks (if any)", description: "AI/SVG/PNG" },
      { label: "Existing marketing assets", description: "Decks, social templates, photos" },
      { label: "Moodboard / Pinterest board", description: "Share a link" },
      { label: "Competitor screenshots / refs", description: "Drive or Notion folder" },
    ],
    deadlines: [
      { label: "Discovery workshop", days_after_kickoff: 4 },
      { label: "Strategy & moodboard approved", days_after_kickoff: 10 },
      { label: "Logo concepts presented", days_after_kickoff: 18 },
      { label: "Final brand guidelines delivered", days_after_kickoff: 28 },
    ],
  },
  {
    id: "consulting",
    name: "Consulting Onboarding",
    description: "Surface current challenges, goals and stakeholders before the first strategic session.",
    icon: Briefcase,
    iconKey: "briefcase",
    accent: "from-blue-500 to-cyan-500",
    service_type: "Strategic Consulting",
    best_for: "Independent consultants & advisors",
    intro:
      "To make our first session count, please share context on where the business is today, where you want to take it, and the constraints we should work within.",
    fields: [
      ...COMMON_BUSINESS,
      { id: "current_challenges", label: "Current challenges", type: "long_text", required: true, group: "Context" },
      { id: "what_tried", label: "What you've already tried", type: "long_text", group: "Context" },
      { id: "stakeholders", label: "Key stakeholders & decision makers", type: "long_text", group: "Context" },
      { id: "kpis", label: "Top KPIs we should improve", type: "long_text", group: "Goals" },
      { id: "constraints", label: "Constraints (budget, time, team)", type: "long_text", group: "Goals" },
      { id: "definition_of_success", label: "Definition of success in 90 days", type: "long_text", required: true, group: "Goals" },
      { id: "preferred_deadline", label: "When do you need recommendations by?", type: "date", group: "Timing" },
    ],
    file_requests: [
      { label: "Latest financial / KPI snapshot", description: "Spreadsheet or PDF" },
      { label: "Org chart / team structure", description: "Optional but useful" },
      { label: "Existing strategy docs", description: "Plans, decks, OKRs" },
      { label: "Customer research / interview notes", description: "If available" },
    ],
    deadlines: [
      { label: "Kickoff & context call", days_after_kickoff: 3 },
      { label: "Stakeholder interviews complete", days_after_kickoff: 14 },
      { label: "Draft recommendations shared", days_after_kickoff: 28 },
      { label: "Final readout & roadmap", days_after_kickoff: 42 },
    ],
  },
  {
    id: "agency",
    name: "Agency Client Onboarding",
    description: "Multi-discipline retainer onboarding — brand, channels, access, approvers and reporting cadence.",
    icon: Building2,
    iconKey: "building2",
    accent: "from-violet-500 to-fuchsia-500",
    service_type: "Full-service Agency",
    best_for: "Agencies running multi-channel retainers",
    intro:
      "Welcome to the team. This onboarding gives us everything we need to run your account end-to-end — brand, channels, access, approvers and reporting.",
    fields: [
      ...COMMON_BUSINESS,
      { id: "brand_assets_location", label: "Where do your brand assets live?", type: "long_text", placeholder: "Drive, Notion, Frontify…", group: "Brand & assets" },
      { id: "channels", label: "Channels we'll be running", type: "long_text", placeholder: "Paid social, SEO, email, content…", group: "Scope" },
      { id: "approvers", label: "Approvers & turnaround time", type: "long_text", placeholder: "Who approves what, and how fast?", group: "Operations" },
      { id: "tools", label: "Tools we'll need access to", type: "long_text", placeholder: "Ads accounts, CMS, analytics, CRM…", group: "Operations" },
      { id: "reporting_cadence", label: "Preferred reporting cadence", type: "short_text", placeholder: "Weekly, monthly…", group: "Operations" },
      { id: "communication", label: "Preferred communication channel", type: "short_text", placeholder: "Slack, email, Teams…", group: "Operations" },
      { id: "do_not_dos", label: "Do-not-dos & no-go topics", type: "long_text", group: "Brand & assets" },
      { id: "preferred_deadline", label: "Activation date", type: "date", group: "Timing" },
    ],
    file_requests: [
      { label: "Brand guidelines", description: "PDF or link" },
      { label: "Logo pack & brand assets", description: "SVG/PNG/EPS bundle" },
      { label: "Photography / video library", description: "Drive or Dropbox link" },
      { label: "Ad account access (Meta / Google / LinkedIn)", description: "Add us via Business Manager" },
      { label: "Analytics & CMS access", description: "GA4, GSC, CMS user invite" },
      { label: "CRM / email platform access", description: "HubSpot, Klaviyo, etc." },
    ],
    deadlines: [
      { label: "Kickoff & access provisioned", days_after_kickoff: 5 },
      { label: "Strategy doc approved", days_after_kickoff: 14 },
      { label: "First campaign live", days_after_kickoff: 28 },
      { label: "Month-1 performance review", days_after_kickoff: 35 },
    ],
  },
  {
    id: "coaching",
    name: "Coaching Onboarding",
    description: "Personal context, goals and commitments to make every coaching session high-impact.",
    icon: GraduationCap,
    iconKey: "graduation-cap",
    accent: "from-emerald-500 to-teal-500",
    service_type: "Coaching",
    best_for: "Business & life coaches",
    intro:
      "I'm excited to start working with you. Please answer the questions below honestly — they'll help me tailor every session to where you actually are right now.",
    fields: [
      { id: "full_name", label: "Full name", type: "short_text", required: true, group: "About you" },
      { id: "role", label: "Current role / business", type: "short_text", group: "About you" },
      { id: "why_now", label: "Why coaching, why now?", type: "long_text", required: true, group: "About you" },
      { id: "biggest_challenge", label: "Biggest challenge right now", type: "long_text", required: true, group: "Context" },
      { id: "what_tried", label: "What have you tried already?", type: "long_text", group: "Context" },
      { id: "definition_of_success", label: "What does success look like in 90 days?", type: "long_text", required: true, group: "Goals" },
      { id: "non_negotiables", label: "Non-negotiables / boundaries", type: "long_text", group: "Goals" },
      { id: "preferred_session_time", label: "Preferred session time", type: "short_text", placeholder: "e.g. weekday mornings", group: "Logistics" },
      { id: "communication", label: "How do you want async support?", type: "short_text", placeholder: "WhatsApp, email, Voxer…", group: "Logistics" },
      { id: "preferred_deadline", label: "Preferred first session date", type: "date", group: "Logistics" },
    ],
    file_requests: [
      { label: "Pre-coaching reflection (PDF)", description: "Optional — share if you've done one" },
      { label: "Recent goals or vision doc", description: "If you have one" },
    ],
    deadlines: [
      { label: "Discovery / chemistry call", days_after_kickoff: 3 },
      { label: "Goals & commitments agreed", days_after_kickoff: 7 },
      { label: "First milestone review", days_after_kickoff: 30 },
      { label: "90-day review session", days_after_kickoff: 90 },
    ],
  },
  {
    id: "marketing",
    name: "Marketing Services Onboarding",
    description: "Capture audience, offers, channels, budget and tracking access to launch campaigns fast.",
    icon: Megaphone,
    iconKey: "megaphone",
    accent: "from-orange-500 to-amber-500",
    service_type: "Marketing Services",
    best_for: "Performance marketers & agencies",
    intro:
      "Let's get your campaigns live. Share the details below and we'll have a strategy + launch plan within 10 days.",
    fields: [
      ...COMMON_BUSINESS,
      { id: "offers", label: "Core offers / products / services", type: "long_text", required: true, group: "Offer" },
      { id: "ideal_customer", label: "Ideal customer profile", type: "long_text", required: true, group: "Offer" },
      { id: "current_funnel", label: "Current funnel & conversion rates", type: "long_text", group: "Performance" },
      { id: "channels", label: "Channels in scope", type: "long_text", placeholder: "Meta, Google, TikTok, LinkedIn, SEO, email…", group: "Channels" },
      { id: "ad_budget", label: "Monthly ad budget", type: "short_text", group: "Channels" },
      { id: "campaign_goals", label: "Primary campaign goals & KPIs", type: "long_text", required: true, group: "Goals" },
      { id: "tracking_setup", label: "Tracking setup status", type: "long_text", placeholder: "GA4, Meta Pixel, CAPI, server-side…", group: "Tracking" },
      { id: "preferred_deadline", label: "Preferred launch date", type: "date", group: "Timing" },
    ],
    file_requests: [
      { label: "Brand assets (logos, fonts, colours)", description: "ZIP or link" },
      { label: "Existing creative library", description: "Static + video" },
      { label: "Ad account access (Meta / Google / TikTok)", description: "Via Business Manager" },
      { label: "Analytics access (GA4, GSC)", description: "Read access for our team email" },
      { label: "Customer research / personas", description: "If available" },
    ],
    deadlines: [
      { label: "Kickoff & access provisioned", days_after_kickoff: 3 },
      { label: "Strategy approved", days_after_kickoff: 10 },
      { label: "Creatives delivered", days_after_kickoff: 17 },
      { label: "Campaigns live", days_after_kickoff: 21 },
    ],
  },
];

export const ONBOARDING_ACCENT_OPTIONS: { value: string; label: string }[] = [
  { value: "from-accent to-purple", label: "Purple" },
  { value: "from-blue-500 to-cyan-500", label: "Blue" },
  { value: "from-pink-500 to-rose-500", label: "Pink" },
  { value: "from-emerald-500 to-teal-500", label: "Emerald" },
  { value: "from-orange-500 to-amber-500", label: "Orange" },
  { value: "from-violet-500 to-fuchsia-500", label: "Violet" },
  { value: "from-slate-600 to-slate-800", label: "Slate" },
  { value: "from-cyan-500 to-sky-600", label: "Sky" },
];

export const ONBOARDING_ICON_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "globe", label: "Web", icon: Globe },
  { value: "palette", label: "Branding", icon: Palette },
  { value: "briefcase", label: "Consulting", icon: Briefcase },
  { value: "building2", label: "Agency", icon: Building2 },
  { value: "graduation-cap", label: "Coaching", icon: GraduationCap },
  { value: "megaphone", label: "Marketing", icon: Megaphone },
  { value: "clipboard", label: "Onboarding", icon: ClipboardList },
  { value: "sparkles", label: "Premium", icon: Sparkles },
];

export function onboardingIconFromKey(key: string | null | undefined): LucideIcon {
  return ONBOARDING_ICON_OPTIONS.find((o) => o.value === key)?.icon || ClipboardList;
}

export interface MergedOnboardingTemplate {
  rowId?: string;
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  iconKey: string;
  accent: string;
  service_type: string;
  best_for: string;
  intro: string;
  fields: OnboardingField[];
  file_requests: FileRequest[];
  deadlines: DeadlineItem[];
  notes: string;
  source: "builtin" | "builtin_override" | "custom" | "from_form";
  isDefault?: boolean;
  isArchived?: boolean;
}

function rowToMerged(row: OnboardingTemplateRow): MergedOnboardingTemplate {
  return {
    rowId: row.id,
    id: row.builtin_id || row.id,
    name: row.name,
    description: row.description || "",
    icon: onboardingIconFromKey(row.icon),
    iconKey: row.icon || "clipboard",
    accent: row.accent || "from-accent to-purple",
    service_type: row.service_type || "",
    best_for: row.best_for || "",
    intro: row.intro || "",
    fields: Array.isArray(row.fields) ? row.fields : [],
    file_requests: Array.isArray(row.file_requests) ? row.file_requests : [],
    deadlines: Array.isArray(row.deadlines) ? row.deadlines : [],
    notes: row.notes || "",
    source:
      row.source === "builtin_override"
        ? "builtin_override"
        : (row.source as MergedOnboardingTemplate["source"]),
    isDefault: row.is_default,
    isArchived: row.is_archived,
  };
}

function builtinToMerged(b: BuiltinOnboardingTemplate): MergedOnboardingTemplate {
  return {
    id: b.id,
    name: b.name,
    description: b.description,
    icon: b.icon,
    iconKey: b.iconKey,
    accent: b.accent,
    service_type: b.service_type,
    best_for: b.best_for,
    intro: b.intro,
    fields: b.fields,
    file_requests: b.file_requests,
    deadlines: b.deadlines,
    notes: "",
    source: "builtin",
  };
}

export function mergeOnboardingTemplates(
  rows: OnboardingTemplateRow[],
): MergedOnboardingTemplate[] {
  const overrides = new Map<string, OnboardingTemplateRow>();
  const customs: OnboardingTemplateRow[] = [];
  for (const r of rows) {
    if (r.is_archived) continue;
    if (r.builtin_id) overrides.set(r.builtin_id, r);
    else customs.push(r);
  }
  const builtins = BUILTIN_ONBOARDING_TEMPLATES.map((b) => {
    const ov = overrides.get(b.id);
    return ov ? rowToMerged(ov) : builtinToMerged(b);
  });
  const custom = customs
    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
    .map(rowToMerged);
  return [...builtins, ...custom];
}

export async function loadOnboardingTemplateRows(
  userId: string,
): Promise<OnboardingTemplateRow[]> {
  const { data, error } = await supabase
    .from("onboarding_templates" as any)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as OnboardingTemplateRow[];
}

/**
 * Convert a template into the OnboardingField[] array we save on `onboarding_forms.fields`.
 * File requests are appended as long_text fields (one per request) under "Files we need".
 * Deadlines are appended as read-only date fields under "Project timeline" — the date field
 * is pre-filled with the suggested kickoff offset and the client can adjust if needed.
 */
export function templateToOnboardingFields(
  t: MergedOnboardingTemplate,
): OnboardingField[] {
  const fields = [...t.fields];

  if (t.file_requests.length) {
    for (const req of t.file_requests) {
      fields.push({
        id: `file_${slug(req.label)}`,
        label: req.label,
        type: "long_text",
        required: !!req.required,
        placeholder:
          req.description ||
          "Paste a Google Drive / Dropbox / Notion link or describe how you'll share it.",
        group: "Files we need",
      });
    }
  }

  if (t.deadlines.length) {
    for (const d of t.deadlines) {
      fields.push({
        id: `deadline_${slug(d.label)}`,
        label: `${d.label} (target date)`,
        type: "date",
        placeholder: `Suggested: ${d.days_after_kickoff} days after kickoff`,
        group: "Project timeline",
      });
    }
  }

  return fields;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// ---------- Editor form types ----------

export interface OnboardingTemplateFormValues {
  name: string;
  description: string;
  service_type: string;
  best_for: string;
  intro: string;
  fields_text: string; // newline-separated "Label" entries (long_text by default; uses syntax: "Label | type | required" where type/required optional)
  file_requests_text: string; // one per line
  deadlines_text: string; // "Label | days" per line
  notes: string;
  icon: string;
  accent: string;
}

export const EMPTY_ONBOARDING_FORM: OnboardingTemplateFormValues = {
  name: "",
  description: "",
  service_type: "",
  best_for: "",
  intro: "",
  fields_text: "",
  file_requests_text: "",
  deadlines_text: "",
  notes: "",
  icon: "clipboard",
  accent: "from-accent to-purple",
};

export function templateToOnboardingForm(
  t: MergedOnboardingTemplate,
): OnboardingTemplateFormValues {
  return {
    name: t.name,
    description: t.description,
    service_type: t.service_type,
    best_for: t.best_for,
    intro: t.intro,
    fields_text: t.fields
      .map((f) => `${f.label} | ${f.type}${f.required ? " | required" : ""}`)
      .join("\n"),
    file_requests_text: t.file_requests
      .map((r) => `${r.label}${r.description ? ` — ${r.description}` : ""}`)
      .join("\n"),
    deadlines_text: t.deadlines
      .map((d) => `${d.label} | ${d.days_after_kickoff}`)
      .join("\n"),
    notes: t.notes,
    icon: t.iconKey,
    accent: t.accent,
  };
}

const VALID_TYPES = new Set([
  "short_text",
  "long_text",
  "url",
  "email",
  "date",
  "select",
]);

export function parseFieldsText(text: string): OnboardingField[] {
  const out: OnboardingField[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split("|").map((p) => p.trim());
    const label = parts[0];
    if (!label) continue;
    const type = (VALID_TYPES.has(parts[1] as any) ? parts[1] : "long_text") as OnboardingField["type"];
    const required = parts.slice(2).some((p) => p.toLowerCase() === "required");
    out.push({
      id: slug(label) + "_" + out.length,
      label,
      type,
      required,
    });
  }
  return out;
}

export function parseFileRequestsText(text: string): FileRequest[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split("—");
      return {
        label: label.trim(),
        description: rest.join("—").trim() || undefined,
      };
    });
}

export function parseDeadlinesText(text: string): DeadlineItem[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, days] = line.split("|").map((p) => p.trim());
      return {
        label: label || "Milestone",
        days_after_kickoff: Math.max(0, parseInt(days || "7") || 7),
      };
    });
}
