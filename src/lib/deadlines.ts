import { supabase } from "@/integrations/supabase/client";

export type DeadlinePriority = "low" | "medium" | "high";
export type DeadlineStatus = "upcoming" | "due_soon" | "overdue" | "completed";

export interface DeadlineRow {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  due_date: string; // YYYY-MM-DD
  priority: DeadlinePriority;
  status: DeadlineStatus;
  client_id: string | null;
  client_name: string | null;
  proposal_id: string | null;
  contract_id: string | null;
  retainer_id: string | null;
  booking_id: string | null;
  onboarding_form_id: string | null;
  source: string;
  source_key: string | null;
  client_visible: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const PRIORITY_OPTIONS: { value: DeadlinePriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

/** Parse human strings like "2 months", "6 weeks", "in 30 days", "4-6 weeks" → days (uses upper bound). */
export function parseDurationToDays(input?: string | null): number | null {
  if (!input) return null;
  const s = input.toLowerCase();
  // Try ranges like "4-6 weeks" — use upper bound
  const range = s.match(/(\d+)\s*[-–to]+\s*(\d+)\s*(day|week|month|year)s?/);
  if (range) {
    const n = parseInt(range[2], 10);
    const unit = range[3];
    return toDays(n, unit);
  }
  const single = s.match(/(\d+)\s*(day|week|month|year)s?/);
  if (single) {
    return toDays(parseInt(single[1], 10), single[2]);
  }
  return null;
}

function toDays(n: number, unit: string): number {
  if (unit.startsWith("day")) return n;
  if (unit.startsWith("week")) return n * 7;
  if (unit.startsWith("month")) return n * 30;
  if (unit.startsWith("year")) return n * 365;
  return n;
}

/** Look for an explicit ISO date in text (YYYY-MM-DD). */
export function parseExplicitDate(input?: string | null): string | null {
  if (!input) return null;
  const m = input.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function addDaysISO(baseISO: string | Date, days: number): string {
  const d = typeof baseISO === "string" ? new Date(baseISO) : new Date(baseISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function deriveStatus(d: Pick<DeadlineRow, "due_date" | "status" | "completed_at">): DeadlineStatus {
  if (d.status === "completed" || d.completed_at) return "completed";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d.due_date + "T00:00:00");
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "due_soon";
  return "upcoming";
}

export function priorityBadgeClass(p: DeadlinePriority): string {
  switch (p) {
    case "high":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "medium":
      return "bg-warning/15 text-warning border-warning/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function statusBadgeClass(s: DeadlineStatus): string {
  switch (s) {
    case "overdue":
      return "bg-destructive/15 text-destructive border-destructive/40";
    case "due_soon":
      return "bg-warning/15 text-warning border-warning/40";
    case "completed":
      return "bg-success/15 text-success border-success/30";
    default:
      return "bg-accent/15 text-accent border-accent/30";
  }
}

export function statusLabel(s: DeadlineStatus): string {
  return { upcoming: "Upcoming", due_soon: "Due Soon", overdue: "Overdue", completed: "Completed" }[s];
}

interface DeadlineDraft {
  user_id: string;
  title: string;
  due_date: string;
  priority: DeadlinePriority;
  status: DeadlineStatus;
  source: string;
  source_key: string;
  client_id?: string | null;
  client_name?: string | null;
  proposal_id?: string | null;
  contract_id?: string | null;
  retainer_id?: string | null;
  notes?: string | null;
}

/**
 * Scan proposals/contracts/retainers and insert any auto-deadlines that don't exist yet.
 * Idempotent via unique (user_id, source_key) index.
 */
export async function syncAutoDeadlines(userId: string): Promise<number> {
  const drafts: DeadlineDraft[] = [];

  const [propRes, contractRes, retainerRes] = await Promise.all([
    supabase
      .from("proposals")
      .select("id, client_id, client_name, service_type, project_scope, timeline, notes, status, accepted_at, paid_at, sent_at, created_at, client_paid")
      .eq("user_id", userId),
    supabase
      .from("contracts")
      .select("id, client_id, client_name, contract_type, title, body, status, signed_at, sent_at, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null),
    supabase
      .from("retainers")
      .select("id, client_id, client_name, title, end_date, next_billing_date, status, auto_renew")
      .eq("user_id", userId),
  ]);

  // Proposals — extract delivery date from timeline / scope / notes
  for (const p of propRes.data || []) {
    const text = `${p.timeline || ""} ${p.project_scope || ""} ${p.notes || ""}`;
    const explicit = parseExplicitDate(text);
    const days = parseDurationToDays(text);
    const baseDate = p.paid_at || p.accepted_at || p.sent_at || p.created_at;
    let due: string | null = null;
    if (explicit) due = explicit;
    else if (days && baseDate) due = addDaysISO(baseDate, days);
    if (!due) continue;
    drafts.push({
      user_id: userId,
      title: `Deliver: ${p.service_type || "Project"} — ${p.client_name}`,
      due_date: due,
      priority: "high",
      status: "upcoming",
      source: "proposal",
      source_key: `proposal:${p.id}:delivery`,
      client_id: p.client_id,
      client_name: p.client_name,
      proposal_id: p.id,
      notes: p.timeline ? `Timeline: ${p.timeline}` : null,
    });
  }

  // Contracts — extract project duration from body, plus signed-date based deadline
  for (const c of contractRes.data || []) {
    const text = `${c.body || ""} ${c.title || ""}`;
    const explicit = parseExplicitDate(text);
    const days = parseDurationToDays(text);
    const baseDate = c.signed_at || c.sent_at || c.created_at;
    let due: string | null = null;
    if (explicit) due = explicit;
    else if (days && baseDate) due = addDaysISO(baseDate, days);
    if (!due) continue;
    drafts.push({
      user_id: userId,
      title: `Contract delivery: ${c.title || "Agreement"} — ${c.client_name}`,
      due_date: due,
      priority: "high",
      status: "upcoming",
      source: "contract",
      source_key: `contract:${c.id}:delivery`,
      client_id: c.client_id,
      client_name: c.client_name,
      contract_id: c.id,
    });
  }

  // Retainers — end date / renewal date
  for (const r of retainerRes.data || []) {
    if (r.next_billing_date) {
      drafts.push({
        user_id: userId,
        title: `${r.auto_renew ? "Retainer renewal" : "Retainer billing"}: ${r.title} — ${r.client_name}`,
        due_date: r.next_billing_date,
        priority: "medium",
        status: "upcoming",
        source: "retainer",
        source_key: `retainer:${r.id}:next`,
        client_id: r.client_id,
        client_name: r.client_name,
        retainer_id: r.id,
      });
    }
    if (r.end_date) {
      drafts.push({
        user_id: userId,
        title: `Retainer ends: ${r.title} — ${r.client_name}`,
        due_date: r.end_date,
        priority: "medium",
        status: "upcoming",
        source: "retainer",
        source_key: `retainer:${r.id}:end`,
        client_id: r.client_id,
        client_name: r.client_name,
        retainer_id: r.id,
      });
    }
  }

  if (drafts.length === 0) return 0;

  // Upsert by (user_id, source_key) — onConflict relies on the partial unique index.
  // Use insert with ignoreDuplicates to keep things simple.
  const { data, error } = await supabase
    .from("deadlines")
    .upsert(drafts, { onConflict: "user_id,source_key", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error("syncAutoDeadlines error", error);
    return 0;
  }
  return data?.length || 0;
}
