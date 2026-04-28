// Retainers / recurring billing helpers.

export type BillingInterval = "weekly" | "monthly" | "quarterly" | "custom";
export type RetainerStatus =
  | "draft"
  | "active"
  | "paused"
  | "pending_renewal"
  | "cancelled"
  | "completed";

export interface RetainerTemplate {
  key: string;
  name: string;
  description: string;
  serviceType: string;
  defaultAmountCents: number;
  defaultInterval: BillingInterval;
  defaultCurrency: string;
  bullets: string[];
}

export const RETAINER_TEMPLATES: RetainerTemplate[] = [
  {
    key: "social_media_management",
    name: "Social Media Management",
    description: "Monthly content creation, scheduling, and community management across channels.",
    serviceType: "Social Media",
    defaultAmountCents: 75000,
    defaultInterval: "monthly",
    defaultCurrency: "GBP",
    bullets: [
      "12 posts per month across 2 platforms",
      "Monthly content calendar",
      "Community engagement & DMs",
      "Monthly performance report",
    ],
  },
  {
    key: "seo_retainer",
    name: "SEO Retainer",
    description: "Ongoing search optimisation: technical SEO, content, and backlinks.",
    serviceType: "SEO",
    defaultAmountCents: 100000,
    defaultInterval: "monthly",
    defaultCurrency: "GBP",
    bullets: [
      "Monthly keyword & ranking report",
      "On-page SEO improvements",
      "1 long-form content piece",
      "Link building outreach",
    ],
  },
  {
    key: "marketing_retainer",
    name: "Marketing Retainer",
    description: "Strategic marketing oversight, campaigns, and reporting.",
    serviceType: "Marketing",
    defaultAmountCents: 150000,
    defaultInterval: "monthly",
    defaultCurrency: "GBP",
    bullets: [
      "Monthly strategy session",
      "Campaign planning & execution",
      "Email + paid coordination",
      "KPI dashboard",
    ],
  },
  {
    key: "consulting_retainer",
    name: "Ongoing Consulting Agreement",
    description: "Reserved consulting hours each month for advisory and execution support.",
    serviceType: "Consulting",
    defaultAmountCents: 120000,
    defaultInterval: "monthly",
    defaultCurrency: "GBP",
    bullets: [
      "8 reserved hours per month",
      "Async Slack/email access",
      "Monthly review call",
      "Priority response within 24h",
    ],
  },
  {
    key: "website_maintenance",
    name: "Website Maintenance Plan",
    description: "Keep the site secure, fast, and up to date every month.",
    serviceType: "Web Maintenance",
    defaultAmountCents: 50000,
    defaultInterval: "monthly",
    defaultCurrency: "GBP",
    bullets: [
      "Plugin & core updates",
      "Daily backups",
      "Uptime & security monitoring",
      "2 hours of small edits / month",
    ],
  },
  {
    key: "coaching_subscription",
    name: "Coaching Subscription",
    description: "Recurring coaching sessions with async support between calls.",
    serviceType: "Coaching",
    defaultAmountCents: 60000,
    defaultInterval: "monthly",
    defaultCurrency: "GBP",
    bullets: [
      "2 × 60-min coaching calls",
      "Async messaging support",
      "Custom action plan",
      "Progress tracking",
    ],
  },
  {
    key: "support_maintenance",
    name: "Support & Maintenance Package",
    description: "Ongoing technical support and small-change requests for active clients.",
    serviceType: "Support",
    defaultAmountCents: 40000,
    defaultInterval: "monthly",
    defaultCurrency: "GBP",
    bullets: [
      "Email & chat support",
      "Bug fixes within SLA",
      "Up to 4 small changes / month",
      "Monthly status update",
    ],
  },
  {
    key: "monthly_management",
    name: "Monthly Management Retainer",
    description: "All-in management retainer for ongoing client work and account oversight.",
    serviceType: "Account Management",
    defaultAmountCents: 90000,
    defaultInterval: "monthly",
    defaultCurrency: "GBP",
    bullets: [
      "Dedicated account lead",
      "Weekly check-ins",
      "Roadmap planning",
      "Monthly executive summary",
    ],
  },
];

export function getTemplate(key?: string | null): RetainerTemplate | undefined {
  if (!key) return undefined;
  return RETAINER_TEMPLATES.find((t) => t.key === key);
}

export function intervalLabel(interval: string, customDays?: number | null): string {
  switch (interval) {
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "custom":
      return customDays ? `Every ${customDays} days` : "Custom";
    default:
      return interval;
  }
}

export function intervalDays(interval: string, customDays?: number | null): number {
  switch (interval) {
    case "weekly":
      return 7;
    case "monthly":
      return 30;
    case "quarterly":
      return 90;
    case "custom":
      return Math.max(1, customDays || 30);
    default:
      return 30;
  }
}

/** Compute the next billing date given a start date (ISO) and interval. */
export function computeNextBillingDate(
  startDateISO: string,
  interval: BillingInterval | string,
  customDays?: number | null,
  fromDate: Date = new Date(),
): Date {
  const start = new Date(startDateISO);
  if (start > fromDate) return start;

  const next = new Date(start);
  if (interval === "monthly") {
    while (next <= fromDate) next.setMonth(next.getMonth() + 1);
  } else if (interval === "quarterly") {
    while (next <= fromDate) next.setMonth(next.getMonth() + 3);
  } else if (interval === "weekly") {
    while (next <= fromDate) next.setDate(next.getDate() + 7);
  } else {
    const d = Math.max(1, customDays || 30);
    while (next <= fromDate) next.setDate(next.getDate() + d);
  }
  return next;
}

/** Convert a retainer's amount to its monthly-equivalent value (in cents) for MRR. */
export function monthlyEquivalentCents(
  amountCents: number,
  interval: string,
  customDays?: number | null,
): number {
  switch (interval) {
    case "weekly":
      return Math.round(amountCents * (52 / 12));
    case "monthly":
      return amountCents;
    case "quarterly":
      return Math.round(amountCents / 3);
    case "custom": {
      const d = Math.max(1, customDays || 30);
      return Math.round(amountCents * (30 / d));
    }
    default:
      return amountCents;
  }
}

export function formatMoney(amountCents: number, currency: string = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format((amountCents || 0) / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(0)}`;
  }
}

export function statusBadgeClasses(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "paused":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "past_due":
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    case "pending_renewal":
      return "bg-purple-500/15 text-purple-400 border-purple-500/30";
    case "cancelled":
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    case "completed":
      return "bg-muted text-muted-foreground border-border";
    case "draft":
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export const CURRENCIES = [
  { code: "USD", symbol: "$" },
  { code: "GBP", symbol: "£" },
  { code: "EUR", symbol: "€" },
  { code: "CAD", symbol: "C$" },
  { code: "AUD", symbol: "A$" },
];

export function daysUntil(dateISO?: string | null): number | null {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  const now = new Date();
  const ms = d.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
