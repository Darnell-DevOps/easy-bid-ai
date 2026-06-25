// Shared helper for edge functions to append to public.lead_activity.
// Service-role only — RLS is bypassed by the service key.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type LeadActivityType =
  | "lead_email_received"
  | "lead_qualified"
  | "reply_drafted"
  | "reply_sent"
  | "intake_form_sent"
  | "proposal_created_from_lead"
  | "lead_marked_not_a_lead";

export interface LogLeadActivityArgs {
  user_id: string;
  type: LeadActivityType;
  title: string;
  summary?: string | null;
  client_id?: string | null;
  lead_id?: string | null;
  proposal_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logLeadActivity(
  svc: SupabaseClient,
  args: LogLeadActivityArgs,
): Promise<void> {
  try {
    await svc.from("lead_activity").insert({
      user_id: args.user_id,
      type: args.type,
      title: args.title,
      summary: args.summary ?? null,
      client_id: args.client_id ?? null,
      lead_id: args.lead_id ?? null,
      proposal_id: args.proposal_id ?? null,
      metadata: args.metadata ?? {},
    });
  } catch (e) {
    console.warn("logLeadActivity failed", e);
  }
}
