// Tiny client helper for invoking the send-email edge function.
// Errors are swallowed (logged) — email failures must never block UX.
import { supabase } from "@/integrations/supabase/client";

export interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded
  content_type?: string;
}

export async function sendEmail(args: {
  templateName: string;
  recipientEmail: string;
  data?: Record<string, unknown>;
  idempotencyKey?: string;
  userId?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}): Promise<void> {
  if (!args.recipientEmail) return;
  try {
    const { error } = await supabase.functions.invoke("send-email", { body: args });
    if (error) console.warn("send-email error:", error.message);
  } catch (e: any) {
    console.warn("send-email exception:", e?.message || e);
  }
}
