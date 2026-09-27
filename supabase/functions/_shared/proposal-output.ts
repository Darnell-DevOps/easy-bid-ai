import { currencySymbolFor, type CommercialTotals } from "./commercial-calc.ts";

export const PROPOSAL_HEADINGS = ["What You'll Get", "Introduction", "Your Current Challenge", "How We'll Solve This", "Scope of Work", "Deliverables", "Timeline", "Expected Outcomes", "Investment", "Why Choose Us", "Next Steps"];

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 100_000) throw new Error("Missing or oversized document");
  return value.replace(/\r\n/g, "\n").trim();
}

export function parseProposalJson(content: string): Record<string, unknown> {
  const cleaned = content.trim().replace(/^```(?:json)?\s*\n?/, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object");
  return parsed;
}

function amounts(value: string, currency: string): number[] {
  // Prices must use the agreed currency, including multi-character $ prefixes.
  const symbol = currencySymbolFor(currency).trim();
  const prices = [...value.matchAll(/(?:C\$|A\$|NZ\$|£|\$|€|¥|CHF|kr)\s*(-?\d[\d,]*(?:\.\d{1,2})?)/g)];
  return prices.map(([match, number]) => {
    if (!match.startsWith(symbol)) throw new Error("Mixed currency");
    const cents = Math.round(Number(number.replace(/,/g, "")) * 100);
    if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Invalid commercial figure");
    return cents;
  });
}

export function validateCommercialTable(value: string, currency: string, totals: CommercialTotals) {
  const expected: Record<string, number> = { subtotal: totals.subtotalCents, tax: totals.taxAmountCents, total: totals.totalCents };
  const seen = new Set<string>();
  let lineItemTotal = 0;
  let lineItems = 0;
  amounts(value, currency); // Reject mixed currencies anywhere, not only totals.
  for (const line of value.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1,-1).map(cell => cell.replace(/\*/g,"" ).trim());
    if (cells.length < 2) continue;
    const label = cells[0].toLowerCase();
    const figures = amounts(cells.at(-1)!, currency);
    if (!figures.length) continue;
    if (figures.length !== 1) throw new Error("Ambiguous table cost");
    const key = /^subtotal\b/.test(label) ? "subtotal" : /^tax\b/.test(label) ? "tax" : /^total\b/.test(label) ? "total" : null;
    if (key) {
      if (seen.has(key) || figures[0] !== expected[key]) throw new Error("Commercial totals do not match the agreed figures");
      seen.add(key);
    } else {
      lineItems++;
      lineItemTotal += figures[0];
    }
  }
  if (!seen.has("subtotal") || !seen.has("total") || (totals.taxAmountCents > 0 && !seen.has("tax"))) throw new Error("Missing commercial totals");
  if (!lineItems || lineItemTotal !== totals.subtotalCents) throw new Error("Line items do not add up to the subtotal");
}

export function validateProposalSection(parsed: Record<string, unknown>, heading: string, nextSteps?: string[]) {
  const section = text(parsed.section);
  const headings = [...section.matchAll(/^## (.+)$/gm)].map(match => match[1].trim());
  if (headings.length !== 1 || headings[0] !== heading) throw new Error("Unexpected section heading");
  if (section.split("\n").slice(1).join("\n").trim().length < 5) throw new Error("Empty section");
  const bodyLines = section.split("\n").slice(1).map(line => line.trim()).filter(Boolean);
  if (nextSteps && bodyLines.join("\n") !== nextSteps.map(step => `- ${step}`).join("\n")) throw new Error("Incorrect client journey");
  return { section };
}

export function validateProposalOutput(parsed: Record<string, unknown>, currency: string, totals: CommercialTotals, nextSteps: string[]) {
  const proposal = text(parsed.proposal), pricing = text(parsed.pricing), invoice = text(parsed.invoice);
  const headings = [...proposal.matchAll(/^## (.+)$/gm)].map(match => match[1].trim());
  if (headings.join("|") !== PROPOSAL_HEADINGS.join("|")) throw new Error("Missing or reordered proposal sections");
  for (const heading of PROPOSAL_HEADINGS) {
    const start = proposal.indexOf(`## ${heading}\n`);
    const next = proposal.indexOf("\n## ", start + 3);
    validateProposalSection({ section: proposal.slice(start, next === -1 ? undefined : next).trim() }, heading, heading === "Next Steps" ? nextSteps : undefined);
  }
  validateCommercialTable(pricing,currency,totals);
  validateCommercialTable(invoice,currency,totals);
  const investment = proposal.split("## Investment\n")[1]?.split("\n## ")[0] || "";
  validateInvestmentOutput(investment,currency,totals);
  return { proposal, pricing, invoice };
}

export function validateInvestmentOutput(value: string, currency: string, totals: CommercialTotals) {
  const values = amounts(value,currency);
  if (!values.includes(totals.totalCents) || values.some(value => ![totals.subtotalCents, totals.taxAmountCents, totals.totalCents].includes(value))) throw new Error("Investment does not match agreed figures");
}
