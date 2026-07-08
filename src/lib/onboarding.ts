// Onboarding system: shared types, service-specific field templates, helpers.
// Backed by the shared SmartField engine in @/lib/form-fields.

import type { SmartField, SmartFieldType, FieldCondition } from "@/lib/form-fields";
export { isFieldVisible, visibleFields, computeProgress, missingRequired } from "@/lib/form-fields";

export type OnboardingFieldType = SmartFieldType;
export type OnboardingField = SmartField;
export type { FieldCondition };

export interface OnboardingSchema {
  service_key: string;
  service_label: string;
  intro: string;
  fields: OnboardingField[];
}

export interface OnboardingFormRow {
  id: string;
  user_id: string;
  proposal_id: string | null;
  client_id: string | null;
  client_name: string;
  client_email: string | null;
  service_type: string | null;
  fields: OnboardingField[];
  responses: Record<string, string>;
  status: "pending" | "in_progress" | "completed";
  access_token: string;
  sent_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  reminded_at: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------- Base + service-specific fields -------------------

const BASE_FIELDS: OnboardingField[] = [
  { id: "business_name", label: "Business name", type: "short_text", required: true, group: "About your business" },
  { id: "project_goals", label: "Top project goals", type: "long_text", required: true, placeholder: "What does success look like?", group: "About your business" },
  { id: "target_audience", label: "Target audience", type: "long_text", placeholder: "Who are we trying to reach?", group: "About your business" },
  { id: "preferred_deadline", label: "Preferred deadline", type: "date", group: "Timing" },
  { id: "brand_preferences", label: "Brand preferences", type: "long_text", placeholder: "Tone, vibe, colours, fonts you love", group: "Brand" },
  { id: "important_links", label: "Important links", type: "long_text", placeholder: "Website, socials, references — one per line", group: "Resources" },
  { id: "assets_required", label: "Assets you'll provide", type: "long_text", placeholder: "Logos, photos, copy, videos…", group: "Resources" },
  { id: "login_access", label: "How can we get access?", type: "long_text", placeholder: "e.g. invite us as a collaborator/admin on your platform, or let us know how you'd like to share access — please don't type passwords here.", group: "Resources" },
  { id: "decision_maker", label: "Who is the main decision-maker for this project?", type: "short_text", group: "Approvals & Contact" },
  { id: "preferred_contact_method", label: "Best way to reach you", type: "short_text", placeholder: "e.g. email, phone, WhatsApp, Slack", group: "Approvals & Contact" },
  { id: "extra_notes", label: "Anything else we should know?", type: "long_text", group: "Notes" },
];

const SERVICE_SPECIFIC: Record<string, OnboardingField[]> = {
  website: [
    { id: "sitemap_needs", label: "Pages / sitemap you need", type: "long_text", placeholder: "Home, About, Services, Contact…", group: "Website specifics" },
    { id: "inspiration_sites", label: "Inspiration websites", type: "long_text", placeholder: "URLs of sites you love", group: "Website specifics" },
    { id: "hosting_domain", label: "Hosting / domain details", type: "long_text", group: "Website specifics" },
    { id: "current_website_url", label: "Current website URL (if any)", type: "short_text", group: "Website specifics" },
    { id: "needs_copywriting", label: "Do you need copywriting for the site?", type: "short_text", placeholder: "Yes/No — or let us know if you'll provide the text", group: "Website specifics" },
    { id: "forms_needed", label: "Do you need booking, payment, or contact forms?", type: "long_text", placeholder: "List any forms or interactive features needed", group: "Website specifics" },
    { id: "competitor_websites", label: "Competitor websites", type: "long_text", placeholder: "Sites of similar businesses, for reference", group: "Website specifics" },
  ],
  branding: [
    { id: "color_preferences", label: "Colour preferences", type: "long_text", group: "Branding specifics" },
    { id: "competitors", label: "Main competitors", type: "long_text", group: "Branding specifics" },
    { id: "style_references", label: "Style references", type: "long_text", placeholder: "Brands, moodboards, Pinterest…", group: "Branding specifics" },
    { id: "logo_inspiration", label: "Logo inspiration", type: "long_text", group: "Branding specifics" },
    { id: "has_existing_logo", label: "Do you already have a logo?", type: "short_text", placeholder: "Yes/No — if yes, you can upload it under Assets you'll provide", group: "Branding specifics" },
    { id: "logo_usage", label: "Where will the logo be used?", type: "long_text", placeholder: "Website, packaging, signage, social media…", group: "Branding specifics" },
  ],
  social: [
    { id: "platforms", label: "Platforms used", type: "long_text", placeholder: "Instagram, TikTok, LinkedIn…", group: "Social specifics" },
    { id: "post_frequency", label: "Posting frequency", type: "short_text", placeholder: "e.g. 3x/week", group: "Social specifics" },
    { id: "brand_tone", label: "Brand tone", type: "long_text", group: "Social specifics" },
    { id: "content_goals", label: "Content goals", type: "long_text", group: "Social specifics" },
  ],
  marketing: [
    { id: "audience", label: "Who is the audience?", type: "long_text", group: "Marketing specifics" },
    { id: "offers", label: "Offers / promotions", type: "long_text", group: "Marketing specifics" },
    { id: "campaign_goals", label: "Campaign goals", type: "long_text", group: "Marketing specifics" },
    { id: "ad_budget", label: "Ad budget", type: "short_text", placeholder: "Monthly spend", group: "Marketing specifics" },
  ],
  consulting: [
    { id: "current_challenges", label: "Current challenges", type: "long_text", group: "Consulting specifics" },
    { id: "business_goals", label: "Business goals", type: "long_text", group: "Consulting specifics" },
    { id: "priorities", label: "Top priorities right now", type: "long_text", group: "Consulting specifics" },
  ],
};

export function detectServiceKey(service: string | null | undefined): keyof typeof SERVICE_SPECIFIC | "general" {
  const s = (service || "").toLowerCase();
  if (/(web ?site|web ?design|landing|wordpress|shopify)/i.test(s)) return "website";
  if (/(brand|logo|identity)/i.test(s)) return "branding";
  if (/(social|instagram|tiktok|content|community)/i.test(s)) return "social";
  if (/(market|ads?|seo|paid|growth|email)/i.test(s)) return "marketing";
  if (/(automation|workflow|zapier|make\.com|integration|ai agent|chatbot|whatsapp bot)/i.test(s)) return "automation";
  if (/(consult|advis|coach|strateg)/i.test(s)) return "consulting";
  return "general";
}

export function buildOnboardingFields(serviceType: string | null | undefined): OnboardingField[] {
  const key = detectServiceKey(serviceType);
  const extras = key === "general" ? [] : SERVICE_SPECIFIC[key];
  // Insert service-specific block right after "About your business"
  const fields: OnboardingField[] = [];
  let inserted = false;
  for (const f of BASE_FIELDS) {
    fields.push(f);
    if (!inserted && f.id === "target_audience" && extras.length) {
      fields.push(...extras);
      inserted = true;
    }
  }
  if (!inserted) fields.push(...extras);
  return fields;
}

export function groupFields(fields: OnboardingField[]): { group: string; fields: OnboardingField[] }[] {
  const groups: { group: string; fields: OnboardingField[] }[] = [];
  for (const f of fields) {
    const g = f.group || "Details";
    let bucket = groups.find((x) => x.group === g);
    if (!bucket) {
      bucket = { group: g, fields: [] };
      groups.push(bucket);
    }
    bucket.fields.push(f);
  }
  return groups;
}

export function onboardingStatusLabel(s: string): string {
  switch (s) {
    case "pending": return "Pending";
    case "in_progress": return "In progress";
    case "completed": return "Completed";
    default: return s;
  }
}

export function onboardingProgress(form: Pick<OnboardingFormRow, "fields" | "responses">): number {
  const required = form.fields.filter((f) => f.required);
  if (required.length === 0) {
    const total = form.fields.length || 1;
    const filled = form.fields.filter((f) => (form.responses?.[f.id] || "").trim()).length;
    return Math.round((filled / total) * 100);
  }
  const filled = required.filter((f) => (form.responses?.[f.id] || "").trim()).length;
  return Math.round((filled / required.length) * 100);
}
