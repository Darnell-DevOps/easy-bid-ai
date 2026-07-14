// Deterministic commercial-math utility (edge function copy).
// Counterpart: src/lib/commercial-calc.ts
// KEEP ALGORITHMICALLY IDENTICAL — any change here must be mirrored there.

export type TaxMode = "none" | "exclusive" | "inclusive" | null | undefined;

export interface CommercialTotals {
  subtotalCents: number;
  taxAmountCents: number;
  totalCents: number;
}

export function calculateCommercialTotals(
  amountCents: number,
  taxRatePercent: number | null | undefined,
  taxMode: TaxMode,
): CommercialTotals {
  const rate = typeof taxRatePercent === "number" ? taxRatePercent : NaN;
  const hasTax =
    (taxMode === "exclusive" || taxMode === "inclusive") &&
    Number.isFinite(rate) &&
    rate > 0;

  if (!hasTax) {
    return { subtotalCents: amountCents, taxAmountCents: 0, totalCents: amountCents };
  }

  if (taxMode === "exclusive") {
    const subtotalCents = amountCents;
    const taxAmountCents = Math.round(subtotalCents * (rate / 100));
    const totalCents = subtotalCents + taxAmountCents;
    return { subtotalCents, taxAmountCents, totalCents };
  }

  // inclusive
  const totalCents = amountCents;
  const subtotalCents = Math.round(totalCents / (1 + rate / 100));
  const taxAmountCents = totalCents - subtotalCents;
  return { subtotalCents, taxAmountCents, totalCents };
}

// Mirror of CURRENCY_SYMBOLS in supabase/functions/generate-proposal/index.ts.
export const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  CAD: "C$",
  AUD: "A$",
  NZD: "NZ$",
  CHF: "CHF ",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  JPY: "¥",
};

export function currencySymbolFor(currency: string | null | undefined): string {
  if (!currency) return "£";
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
}

export function formatCents(cents: number, currency: string | null | undefined): string {
  const symbol = currencySymbolFor(currency);
  const amount = (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${amount}`;
}

// Mirrors PAYMENT_TERMS in src/components/settings/BusinessInformationSettings.tsx
export function paymentTermsPhrase(code?: string | null, dueDays?: number | null): string | null {
  const raw = (code || "").toString().trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  const netMatch = key.match(/^net[_\s-]?(\d+)$/);
  if (netMatch) {
    const days = dueDays && dueDays > 0 ? dueDays : parseInt(netMatch[1], 10);
    return `Payment due within ${days} days of invoice.`;
  }
  if (key === "due_immediately" || key === "immediate" || key === "on_receipt") {
    return "Payment due immediately upon receipt of invoice.";
  }
  // If the stored value is already a human-readable phrase (e.g. legacy "50% deposit, 50% on completion"), pass it through.
  if (raw.length > 3 && /\s/.test(raw)) return raw.endsWith(".") ? raw : `${raw}.`;
  return null;
}
