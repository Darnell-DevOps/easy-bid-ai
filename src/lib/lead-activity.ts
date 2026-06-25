import { supabase } from "@/integrations/supabase/client";

export type LeadActivityType =
  | "lead_email_received"
  | "lead_qualified"
  | "reply_drafted"
  | "reply_sent"
  | "intake_form_sent"
  | "proposal_created_from_lead"
  | "lead_marked_not_a_lead";

export interface LogLeadActivityArgs {
  type: LeadActivityType;
  title: string;
  summary?: string | null;
  client_id?: string | null;
  lead_id?: string | null;
  proposal_id?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append a row to lead_activity for the current user. Never throws — a logging
 * failure must not break the user-facing action.
 */
export async function logLeadActivity(args: LogLeadActivityArgs): Promise<void> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return;
    await supabase.from("lead_activity").insert({
      user_id: userId,
      type: args.type,
      title: args.title,
      summary: args.summary ?? null,
      client_id: args.client_id ?? null,
      lead_id: args.lead_id ?? null,
      proposal_id: args.proposal_id ?? null,
      metadata: args.metadata ?? {},
    });
  } catch (e) {
    // Swallow — never block the UI on activity logging.
    console.warn("logLeadActivity failed", e);
  }
}
