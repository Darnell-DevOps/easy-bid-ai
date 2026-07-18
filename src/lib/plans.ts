// Plan definitions and limits. Paid entitlements are stored in Supabase and
// changed only by the server-side Paddle billing flow (see hooks/use-plan.ts).

export type PlanId = "free" | "starter" | "pro";

export interface PlanFeatures {
  proposalsPerMonth: number | "unlimited";
  watermark: boolean;
  payments: boolean;
  policies: boolean;
  aiLeadResponse: boolean;
  templates: boolean;
  shareableLinks: boolean;
  analytics: boolean;
  autoAttachPolicies: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number; // in GBP, 0 for free
  currencySymbol: string;
  tagline: string;
  highlight?: boolean;
  features: PlanFeatures;
  bullets: string[]; // user-facing feature list shown on pricing page
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    currencySymbol: "£",
    tagline: "Try it out — no card required",
    features: {
      proposalsPerMonth: 2,
      watermark: true,
      payments: false,
      policies: false,
      aiLeadResponse: false,
      templates: false,
      shareableLinks: true,
      analytics: false,
      autoAttachPolicies: false,
    },
    bullets: [
      "2 proposals per month",
      "Watermarked proposals",
      "Shareable proposal links",
      "Basic dashboard",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 9,
    currencySymbol: "£",
    tagline: "Close deals faster, every week",
    features: {
      proposalsPerMonth: 10,
      watermark: false,
      payments: false,
      policies: false,
      aiLeadResponse: false,
      templates: true,
      shareableLinks: true,
      analytics: false,
      autoAttachPolicies: false,
    },
    bullets: [
      "10 proposals per month",
      "AI proposal generation",
      "Premium templates",
      "Shareable client links",
      "No watermark",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 29,
    currencySymbol: "£",
    tagline: "Get paid instantly. Turn leads into clients automatically.",
    highlight: true,
    features: {
      proposalsPerMonth: "unlimited",
      watermark: false,
      payments: true,
      policies: true,
      aiLeadResponse: true,
      templates: true,
      shareableLinks: true,
      analytics: true,
      autoAttachPolicies: true,
    },
    bullets: [
      "Unlimited proposals",
      "Accept & Pay flow (collect payments)",
      "Auto-attach policies & terms",
      "AI lead response",
      "Analytics: views, accepted, paid",
      "Premium templates",
      "No watermark",
    ],
  },
};

// Single source of truth for "what does this feature need?".
// Used by gates to look up which plan unlocks something.
export const FEATURE_REQUIREMENTS: Record<keyof PlanFeatures, PlanId> = {
  proposalsPerMonth: "free", // limit, not gate
  watermark: "starter", // remove watermark
  payments: "pro",
  policies: "pro",
  aiLeadResponse: "pro",
  templates: "starter",
  shareableLinks: "free",
  analytics: "pro",
  autoAttachPolicies: "pro",
};

const PLAN_RANK: Record<PlanId, number> = { free: 0, starter: 1, pro: 2 };

export function planMeets(current: PlanId, required: PlanId): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

export function hasFeature(planId: PlanId, feature: keyof PlanFeatures): boolean {
  const required = FEATURE_REQUIREMENTS[feature];
  return planMeets(planId, required);
}
