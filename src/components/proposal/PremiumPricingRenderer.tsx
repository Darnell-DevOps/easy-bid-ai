import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { CheckCircle2, CreditCard } from "lucide-react";

interface PremiumPricingRendererProps {
  content: string;
  onPayClick?: () => void;
  showPayCta?: boolean;
}

interface ParsedRow {
  item: string;
  description?: string;
  cost: string;
  isSubtotal?: boolean;
  isVat?: boolean;
  isTotal?: boolean;
}

function parsePricing(content: string): {
  intro: string;
  rows: ParsedRow[];
  total: string | null;
  subtotal: string | null;
  vat: string | null;
  paymentTerms: string;
  included: string[];
} {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const introLines: string[] = [];
  const tableLines: string[] = [];
  const trailingLines: string[] = [];
  let inTable = false;
  let tableDone = false;

  for (const line of lines) {
    const isTableRow = /^\s*\|.+\|\s*$/.test(line);
    if (isTableRow) {
      inTable = true;
      tableLines.push(line);
      continue;
    }
    if (inTable && !isTableRow) {
      tableDone = true;
      inTable = false;
    }
    if (tableDone) trailingLines.push(line);
    else introLines.push(line);
  }

  // Parse table rows
  const rows: ParsedRow[] = [];
  let total: string | null = null;
  let subtotal: string | null = null;
  let vat: string | null = null;

  for (const raw of tableLines) {
    const cells = raw.trim().split("|").slice(1, -1).map((c) => c.trim());
    if (!cells.length) continue;
    if (cells.every((c) => /^[-:]+$/.test(c))) continue; // separator
    if (cells.every((c) => /^(item|description|cost|price|qty|quantity|unit|total)$/i.test(c))) continue; // header

    const lower = cells.join(" ").toLowerCase();
    const cost = cells[cells.length - 1] || "";

    if (/^total\b/.test(cells[0]?.toLowerCase() || "") || /\btotal\b/.test(lower) && !/subtotal/.test(lower)) {
      if (/^total/.test(cells[0]?.toLowerCase() || "")) {
        total = cost;
        continue;
      }
    }
    if (/subtotal/.test(cells[0]?.toLowerCase() || "")) {
      subtotal = cost;
      continue;
    }
    if (/vat|tax/.test(cells[0]?.toLowerCase() || "")) {
      vat = cost;
      continue;
    }
    if (/^total/.test(cells[0]?.toLowerCase() || "")) {
      total = cost;
      continue;
    }

    rows.push({
      item: cells[0] || "",
      description: cells.length >= 3 ? cells[1] : undefined,
      cost,
    });
  }

  // Parse intro for "What's included" bullets
  const introText = introLines.join("\n").trim();
  const included: string[] = [];
  for (const l of introLines) {
    const m = l.match(/^\s*[-*]\s+(.+)$/);
    if (m) included.push(m[1].trim());
  }

  // Payment terms = trailing prose
  const paymentTerms = trailingLines.join("\n").trim();

  return {
    intro: included.length ? "" : introText,
    rows,
    total,
    subtotal,
    vat,
    paymentTerms,
    included,
  };
}

export default function PremiumPricingRenderer({ content, onPayClick, showPayCta }: PremiumPricingRendererProps) {
  const parsed = useMemo(() => parsePricing(content || ""), [content]);

  // Fallback if we couldn't parse anything sensible
  if (!parsed.rows.length && !parsed.total && !parsed.included.length) {
    return (
      <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Investment hero */}
      {parsed.total && (
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple mb-3">
            Investment
          </p>
          <p className="text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-none">
            {parsed.total}
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            Total project investment, all-inclusive.
          </p>
        </section>
      )}

      {/* What's included */}
      {parsed.included.length > 0 && (
        <section className="border-t border-border/60 pt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">
            What's included
          </h3>
          <ul className="space-y-2.5">
            {parsed.included.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-purple mt-1 shrink-0" />
                <span className="text-sm text-foreground/90 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Cost breakdown */}
      {parsed.rows.length > 0 && (
        <section className="border-t border-border/60 pt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">
            Cost breakdown
          </h3>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Item
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-5 py-3 text-foreground">
                      <p className="font-medium">{row.item}</p>
                      {row.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground tabular-nums">
                      {row.cost}
                    </td>
                  </tr>
                ))}
                {parsed.subtotal && (
                  <tr className="border-t border-border/60 bg-background/40">
                    <td className="px-5 py-2.5 text-sm text-muted-foreground">Subtotal</td>
                    <td className="px-5 py-2.5 text-right font-medium text-foreground tabular-nums">
                      {parsed.subtotal}
                    </td>
                  </tr>
                )}
                {parsed.vat && (
                  <tr className="border-t border-border/60 bg-background/40">
                    <td className="px-5 py-2.5 text-sm text-muted-foreground">VAT</td>
                    <td className="px-5 py-2.5 text-right font-medium text-foreground tabular-nums">
                      {parsed.vat}
                    </td>
                  </tr>
                )}
                {parsed.total && (
                  <tr className="border-t-2 border-purple/40 bg-purple/5">
                    <td className="px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-foreground">
                      Total
                    </td>
                    <td className="px-5 py-3.5 text-right text-lg font-bold text-foreground tabular-nums">
                      {parsed.total}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Payment terms */}
      {parsed.paymentTerms && (
        <section className="border-t border-border/60 pt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-3">
            Payment terms
          </h3>
          <div className="text-sm text-muted-foreground leading-relaxed max-w-[60ch] prose-content">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => (
                  <strong className="text-foreground font-semibold">{children}</strong>
                ),
                ul: ({ children }) => <ul className="space-y-1.5 list-none pl-0">{children}</ul>,
                li: ({ children }) => (
                  <li className="flex items-start gap-2">
                    <span className="text-purple mt-1">·</span>
                    <span>{children}</span>
                  </li>
                ),
              }}
            >
              {parsed.paymentTerms}
            </ReactMarkdown>
          </div>
        </section>
      )}

      {/* Pay CTA */}
      {showPayCta && parsed.total && (
        <section className="border-t border-border/60 pt-8">
          <div className="rounded-xl border border-purple/30 bg-gradient-to-br from-purple/10 via-accent/5 to-transparent p-6 text-center">
            <button
              type="button"
              onClick={onPayClick}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-3.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              Pay Now
            </button>
            <p className="text-xs text-muted-foreground mt-3">
              Secure payment via card or bank transfer
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
