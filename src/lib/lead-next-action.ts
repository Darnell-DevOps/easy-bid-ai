// Pure, deterministic "recommended next action" for a lead-shaped client row.
// No AI call. First match wins — the precedence order below is authoritative
// and shared between the lead detail page and the dashboard AttentionCenter so
// they can't disagree.

export type LeadNextActionKind =
  | "open_proposal"
  | "review_reply"
  | "awaiting_response"
  | "review_qualification"
  | "ask_qualifying_questions"
  | "reply_now";

export interface LeadNextAction {
  kind: LeadNextActionKind;
  label: string;         // Primary button label
  title: string;         // Short headline (dashboard card / panel banner)
  hint: string;          // One-line description
  tone: "critical" | "warning" | "info" | "success" | "passive";
  passive?: boolean;     // true = subordinate (Awaiting response); don't visually push
}

export interface LeadRowForNextAction {
  id: string;
  name?: string | null;
  lead_score?: string | null;
  fit_score?: number | null;
  lead_quality?: string | null;
  missing_info?: string[] | null;
  lead_thread?: unknown;              // jsonb array
  lead_reply_sent_at?: string | null;
  not_a_lead?: boolean | null;
}

function threadEntries(t: unknown): Array<{ at?: string; direction?: string }> {
  if (!Array.isArray(t)) return [];
  return t as Array<{ at?: string; direction?: string }>;
}

function lastInboundAfter(iso: string | null | undefined, thread: unknown): boolean {
  const entries = threadEntries(thread);
  if (entries.length === 0) return false;
  // If we've never sent a reply, treat >1 entry as "they wrote back at least once"
  if (!iso) return entries.length > 1;
  const cutoff = new Date(iso).getTime();
  return entries.some((e) => {
    const at = e?.at ? new Date(e.at).getTime() : 0;
    return at > cutoff;
  });
}

/**
 * Compute the single recommended next action for a client row.
 * The caller supplies whether a proposal already exists for this client_id
 * (mandatory — we do not name-match).
 */
export function computeLeadNextAction(
  client: LeadRowForNextAction,
  hasProposal: boolean,
): LeadNextAction {
  // (a) Proposal exists -> Open proposal
  if (hasProposal) {
    return {
      kind: "open_proposal",
      label: "Open proposal",
      title: "Open proposal",
      hint: "This lead already has a proposal — continue the deal there.",
      tone: "info",
    };
  }

  // (b) Lead replied after we sent (or thread has multiple entries and nothing sent)
  if (lastInboundAfter(client.lead_reply_sent_at, client.lead_thread)) {
    return {
      kind: "review_reply",
      label: "Review response",
      title: "Lead replied — review response",
      hint: "They wrote back after your last message. Read it before doing anything else.",
      tone: "critical",
    };
  }

  // (c) Reply already sent, no reply back yet, no proposal -> passive
  if (client.lead_reply_sent_at) {
    return {
      kind: "awaiting_response",
      label: "Awaiting response",
      title: "Awaiting response",
      hint: "You've replied. Give them time to respond before nudging.",
      tone: "passive",
      passive: true,
    };
  }

  // (d) Never qualified — no signals at all
  const neverQualified =
    !client.lead_score && !client.fit_score && !client.lead_quality;
  if (neverQualified) {
    return {
      kind: "review_qualification",
      label: "Run qualification",
      title: "Review qualification",
      hint: "This lead hasn't been analysed yet. Run qualification to see fit.",
      tone: "info",
    };
  }

  // (e) Missing info present -> clarification comes before a proposal
  const missing = Array.isArray(client.missing_info)
    ? client.missing_info.filter(Boolean)
    : [];
  if (missing.length > 0) {
    return {
      kind: "ask_qualifying_questions",
      label: "Ask qualifying questions",
      title: "Ask qualifying questions",
      hint: `Get clarity on: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}.`,
      tone: "warning",
    };
  }

  // (f) Qualified, no gaps, no reply sent, no proposal
  return {
    kind: "reply_now",
    label: "Reply now",
    title: "Reply now",
    hint: "This lead is ready — send your first reply to keep momentum.",
    tone: "critical",
  };
}
