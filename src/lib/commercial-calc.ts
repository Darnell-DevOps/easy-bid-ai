// Deterministic commercial-math utility (frontend copy).
// Counterpart: supabase/functions/_shared/commercial-calc.ts
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
