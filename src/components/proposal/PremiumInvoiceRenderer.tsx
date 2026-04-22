import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { CreditCard } from "lucide-react";

interface PremiumInvoiceRendererProps {
  content: string;
  clientName?: string;
  companyName?: string;
  onPayClick?: () => void;
  showPayCta?: boolean;
}

interface InvoiceLine {
  description: string;
  qty: string;
  unit: string;
  total: string;
}

interface ParsedInvoice {
  invoiceNumber: string | null;
  date: string | null;
  billToLines: string[];
  items: InvoiceLine[];
  subtotal: string | null;
  vat: string | null;
  total: string | null;
  paymentTerms: string;
}

function parseInvoice(content: string): ParsedInvoice {
  const text = content.replace(/\r\n/g, "\n");
  const lines = text.split("\n");

  let invoiceNumber: string | null = null;
  let date: string | null = null;
  const billToLines: string[] = [];
  let captureBillTo = false;
  const tableLines: string[] = [];
  const trailingLines: string[] = [];
  let inTable = false;
  let tableDone = false;

  for (const raw of lines) {
    const line = raw.trim();
    const isTableRow = /^\|.+\|$/.test(line);

    if (isTableRow) {
      inTable = true;
      tableLines.push(line);
      captureBillTo = false;
      continue;
    }
    if (inTable && !isTableRow) {
      inTable = false;
      tableDone = true;
    }

    // Match "Invoice number: INV-..." or "**Invoice Number:** INV-..."
    const invMatch = line.match(/invoice\s*(?:number|no\.?|#)?\s*:?\s*\**\s*(INV-[\w-]+)/i)
      || line.match(/\*\*invoice\s*(?:number|no\.?|#)?:\*\*\s*(.+)/i);
    if (invMatch && !invoiceNumber) {
      invoiceNumber = invMatch[1].replace(/\*+/g, "").trim();
      continue;
    }

    const dateMatch = line.match(/^\*?\*?\s*date\s*:?\*?\*?\s*(.+)/i);
    if (dateMatch && !date && !/bill/i.test(line)) {
      date = dateMatch[1].replace(/\*+/g, "").trim();
      continue;
    }

    if (/^\*?\*?\s*bill\s*to\s*:?/i.test(line)) {
      captureBillTo = true;
      const after = line.replace(/^\*?\*?\s*bill\s*to\s*:?\*?\*?\s*/i, "").trim();
      if (after) billToLines.push(after.replace(/\*+/g, ""));
      continue;
    }

    if (captureBillTo) {
      const cleaned = line.replace(/^[-*]\s*/, "").replace(/\*+/g, "").trim();
      if (!cleaned) {
        if (billToLines.length) captureBillTo = false;
        continue;
      }
      // Stop capture on next heading/section
      if (/^#{1,6}\s/.test(line) || /^(items?|description|line items?|payment)/i.test(cleaned)) {
        captureBillTo = false;
      } else {
        billToLines.push(cleaned);
        continue;
      }
    }

    if (tableDone) trailingLines.push(raw);
  }

  // Parse items table
  const items: InvoiceLine[] = [];
  let subtotal: string | null = null;
  let vat: string | null = null;
  let total: string | null = null;
  let headerCells: string[] = [];

  for (const raw of tableLines) {
    const cells = raw.split("|").slice(1, -1).map((c) => c.trim());
    if (!cells.length) continue;
    if (cells.every((c) => /^[-:]+$/.test(c))) continue;

    const isHeader =
      !headerCells.length &&
      cells.some((c) => /^(description|item|qty|quantity|unit|price|cost|total|amount)$/i.test(c));
    if (isHeader) {
      headerCells = cells.map((c) => c.toLowerCase());
      continue;
    }

    const firstCell = (cells[0] || "").toLowerCase();
    const lastCost = cells[cells.length - 1] || "";

    if (/^subtotal/.test(firstCell)) { subtotal = lastCost; continue; }
    if (/^(vat|tax)/.test(firstCell)) { vat = lastCost; continue; }
    if (/^total/.test(firstCell)) { total = lastCost; continue; }

    // Map cells based on header positions if we have them
    const get = (names: string[]): string => {
      if (!headerCells.length) return "";
      for (const n of names) {
        const idx = headerCells.findIndex((h) => h.includes(n));
        if (idx >= 0 && cells[idx] !== undefined) return cells[idx];
      }
      return "";
    };

    if (headerCells.length) {
      items.push({
        description: get(["description", "item"]) || cells[0] || "",
        qty: get(["qty", "quantity"]) || "1",
        unit: get(["unit", "price", "rate"]) || "",
        total: get(["total", "amount", "cost"]) || lastCost,
      });
    } else {
      // No header — best-guess mapping
      if (cells.length === 2) {
        items.push({ description: cells[0], qty: "1", unit: cells[1], total: cells[1] });
      } else if (cells.length === 3) {
        items.push({ description: cells[0], qty: "1", unit: cells[1], total: cells[2] });
      } else {
        items.push({
          description: cells[0],
          qty: cells[1] || "1",
          unit: cells[2] || "",
          total: cells[cells.length - 1],
        });
      }
    }
  }

  return {
    invoiceNumber,
    date,
    billToLines,
    items,
    subtotal,
    vat,
    total,
    paymentTerms: trailingLines.join("\n").trim(),
  };
}

export default function PremiumInvoiceRenderer({
  content,
  clientName,
  companyName,
  onPayClick,
  showPayCta,
}: PremiumInvoiceRendererProps) {
  const parsed = useMemo(() => parseInvoice(content || ""), [content]);

  if (!parsed.items.length && !parsed.total && !parsed.invoiceNumber) {
    return (
      <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  const billTo = parsed.billToLines.length
    ? parsed.billToLines
    : [clientName, companyName].filter(Boolean) as string[];

  return (
    <div className="space-y-10">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 pb-8 border-b border-border/60">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple mb-2">
            Invoice
          </p>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
            {parsed.invoiceNumber || "Invoice"}
          </h2>
          {parsed.date && (
            <p className="text-sm text-muted-foreground mt-2">
              Issued {parsed.date}
            </p>
          )}
        </div>
        {billTo.length > 0 && (
          <div className="text-left sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Bill to
            </p>
            {billTo.map((line, i) => (
              <p
                key={i}
                className={i === 0 ? "text-base font-semibold text-foreground" : "text-sm text-muted-foreground"}
              >
                {line}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Items table */}
      {parsed.items.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-4">
            Items
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Description
                  </th>
                  <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-20">
                    Qty
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-32">
                    Unit price
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-32">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {parsed.items.map((item, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-5 py-3 text-foreground">{item.description}</td>
                    <td className="px-5 py-3 text-center text-muted-foreground tabular-nums">
                      {item.qty || "1"}
                    </td>
                    <td className="px-5 py-3 text-right text-foreground tabular-nums">
                      {item.unit || item.total}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground tabular-nums">
                      {item.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Summary */}
      {(parsed.subtotal || parsed.vat || parsed.total) && (
        <section className="flex justify-end">
          <div className="w-full sm:w-80 space-y-2">
            {parsed.subtotal && (
              <div className="flex justify-between items-baseline py-2 border-b border-border/40">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {parsed.subtotal}
                </span>
              </div>
            )}
            {parsed.vat && (
              <div className="flex justify-between items-baseline py-2 border-b border-border/40">
                <span className="text-sm text-muted-foreground">VAT</span>
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {parsed.vat}
                </span>
              </div>
            )}
            {parsed.total && (
              <div className="flex justify-between items-baseline py-3 mt-2 rounded-lg bg-purple/10 border border-purple/30 px-4">
                <span className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Total
                </span>
                <span className="text-xl font-bold text-foreground tabular-nums">
                  {parsed.total}
                </span>
              </div>
            )}
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
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple to-accent px-8 py-3.5 text-sm font-semibold text-accent-foreground shadow-lg shadow-purple/20 hover:brightness-110 hover:shadow-purple/30 transition-all"
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
