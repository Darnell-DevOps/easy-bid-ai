import type { Database } from "@/integrations/supabase/types";

export type BillingItem = Database["public"]["Tables"]["retainer_billing_items"]["Row"];

export const billingStatus: Record<BillingItem["status"], string> = {
  pending: "Awaiting approval",
  declined: "Declined",
  withdrawn: "Withdrawn",
  approved: "Ready to invoice",
  invoiced: "Awaiting payment",
  paid: "Paid",
};

export function currentBillingMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function billingMonthLabel(isoDate: string) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(isoDate));
}

export function billingMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function approvalLink(token: string) {
  return `${window.location.origin}/approve-extra#${token}`;
}

export function billingCopy(items: BillingItem[], clientNames: Map<string, string>) {
  const safeCell = (value: string) => {
    const cell = value.replace(/[\t\r\n]+/g, " ").trim();
    return /^[=+@-]/.test(cell) ? `'${cell}` : cell;
  };
  return [
    "Client\tMonth\tDescription\tCurrency\tAmount",
    ...items.filter((item) => item.status === "approved").map((item) => [
      clientNames.get(item.retainer_id) || "Client",
      item.billing_month.slice(0, 7),
      item.title,
      item.currency,
      (item.amount_cents / 100).toFixed(2),
    ].map(safeCell).join("\t")),
  ].join("\n");
}
