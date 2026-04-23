/**
 * Smart Template Selection
 * --------------------------------------------------------------
 * Analyzes a lead message + extracted hints (service / budget /
 * timeline / goals) and picks the best matching proposal template.
 *
 * Returns a confidence-scored recommendation that the UI can use to:
 *   - Auto-select (high confidence)
 *   - Suggest with confirmation (medium confidence)
 *   - Ask the user to pick (low confidence)
 */

import { templates, type TemplateData } from "@/pages/Templates";

export type Confidence = "high" | "medium" | "low";
export type Complexity = "simple" | "standard" | "advanced";
export type BudgetTier = "low" | "mid" | "high" | "unknown";
export type Urgency = "urgent" | "normal" | "flexible";

export interface SmartSelectInput {
  message: string;
  service?: string;
  budget?: string;
  timeline?: string;
  goals?: string;
}

export interface SmartSelectResult {
  template: TemplateData;
  confidence: Confidence;
  score: number; // raw 0–1
  reasoning: string;
  complexity: Complexity;
  budgetTier: BudgetTier;
  urgency: Urgency;
  alternatives: TemplateData[];
}

// Keyword maps per template id. Weights tuned so 1–2 strong hits => confident.
const KEYWORDS: Record<string, { strong: string[]; weak: string[] }> = {
  "website-design": {
    strong: [
      "website",
      "web design",
      "web development",
      "redesign",
      "landing page",
      "shopify",
      "wordpress",
      "webflow",
      "ecommerce",
      "e-commerce",
      "cms",
    ],
    weak: ["site", "pages", "ux", "ui", "frontend", "responsive", "mobile site"],
  },
  "social-media": {
    strong: [
      "social media",
      "instagram",
      "tiktok",
      "linkedin",
      "content creation",
      "community management",
      "social posts",
      "reels",
    ],
    weak: ["posts", "engagement", "followers", "captions", "scheduling", "content"],
  },
  branding: {
    strong: [
      "branding",
      "brand identity",
      "logo",
      "rebrand",
      "visual identity",
      "brand guidelines",
      "typography",
    ],
    weak: ["palette", "colours", "style guide", "identity", "look and feel"],
  },
  "marketing-strategy": {
    strong: [
      "marketing strategy",
      "growth strategy",
      "go-to-market",
      "campaign",
      "paid ads",
      "google ads",
      "meta ads",
      "facebook ads",
      "ppc",
      "seo strategy",
      "lead generation",
    ],
    weak: ["growth", "ads", "ppc", "roi", "conversions", "funnel", "kpis", "audience"],
  },
};

const URGENCY_HINTS = {
  urgent: ["asap", "urgent", "this week", "next week", "within 2 weeks", "immediately", "rush"],
  flexible: ["no rush", "flexible", "when you can", "open timeline", "tbd"],
};

const COMPLEXITY_HINTS = {
  advanced: [
    "enterprise",
    "multi-region",
    "integrations",
    "migration",
    "headless",
    "scale",
    "complex",
    "custom build",
    "api",
    "automation",
  ],
  simple: ["simple", "basic", "small", "quick", "one-pager", "starter", "mvp"],
};

function normalize(text: string): string {
  return (text || "").toLowerCase();
}

function countMatches(text: string, terms: string[]): number {
  let n = 0;
  for (const t of terms) {
    if (text.includes(t)) n += 1;
  }
  return n;
}

function detectBudgetTier(budget?: string, message?: string): BudgetTier {
  const sources = [budget, message].filter(Boolean).join(" ");
  if (!sources) return "unknown";
  // Strip non-digits per token, look at the largest number found.
  const numbers = (sources.match(/[£$€]?\s?\d[\d,.]*\s?(k|m)?/gi) || [])
    .map((raw) => {
      const lower = raw.toLowerCase().replace(/[£$€,\s]/g, "");
      let n = parseFloat(lower);
      if (isNaN(n)) return 0;
      if (lower.endsWith("k")) n *= 1_000;
      if (lower.endsWith("m")) n *= 1_000_000;
      return n;
    })
    .filter((n) => n >= 100); // ignore tiny stray numbers like "5 days"
  if (!numbers.length) return "unknown";
  const max = Math.max(...numbers);
  if (max < 1500) return "low";
  if (max < 6000) return "mid";
  return "high";
}

function detectComplexity(message: string, budgetTier: BudgetTier): Complexity {
  if (countMatches(message, COMPLEXITY_HINTS.advanced) > 0) return "advanced";
  if (countMatches(message, COMPLEXITY_HINTS.simple) > 0) return "simple";
  if (budgetTier === "high") return "advanced";
  if (budgetTier === "low") return "simple";
  return "standard";
}

function detectUrgency(message: string, timeline?: string): Urgency {
  const blob = `${message} ${timeline || ""}`.toLowerCase();
  if (countMatches(blob, URGENCY_HINTS.urgent) > 0) return "urgent";
  if (countMatches(blob, URGENCY_HINTS.flexible) > 0) return "flexible";
  return "normal";
}

export function smartSelectTemplate(input: SmartSelectInput): SmartSelectResult {
  const text = normalize(`${input.message} ${input.service || ""} ${input.goals || ""}`);

  // Score each template
  const scored = templates.map((tpl) => {
    const km = KEYWORDS[tpl.id];
    let raw = 0;
    if (km) {
      raw += countMatches(text, km.strong) * 3;
      raw += countMatches(text, km.weak) * 1;
    }
    // Direct service-name boost
    if (input.service && normalize(input.service).includes(normalize(tpl.serviceType))) {
      raw += 4;
    }
    return { tpl, raw };
  });

  scored.sort((a, b) => b.raw - a.raw);
  const top = scored[0];
  const second = scored[1];

  // Confidence: based on absolute score AND margin over runner-up.
  const margin = top.raw - (second?.raw ?? 0);
  let confidence: Confidence = "low";
  if (top.raw >= 4 && margin >= 2) confidence = "high";
  else if (top.raw >= 2) confidence = "medium";

  // Normalize score to 0–1 for display
  const score = Math.min(1, top.raw / 8);

  const budgetTier = detectBudgetTier(input.budget, input.message);
  const complexity = detectComplexity(text, budgetTier);
  const urgency = detectUrgency(text, input.timeline);

  // Build a short reasoning string
  const matchedKeywords = (KEYWORDS[top.tpl.id]?.strong || []).filter((k) => text.includes(k));
  const reasonParts: string[] = [];
  if (matchedKeywords.length) {
    reasonParts.push(`matched "${matchedKeywords.slice(0, 2).join(", ")}"`);
  }
  if (budgetTier !== "unknown") reasonParts.push(`${budgetTier} budget`);
  if (urgency === "urgent") reasonParts.push("urgent timeline");
  const reasoning = reasonParts.length
    ? `Detected ${reasonParts.join(" · ")}.`
    : "Best match based on the lead's wording.";

  return {
    template: top.tpl,
    confidence,
    score,
    reasoning,
    complexity,
    budgetTier,
    urgency,
    alternatives: scored.slice(1, 4).map((s) => s.tpl),
  };
}
