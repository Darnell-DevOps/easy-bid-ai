
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_reply_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_reply_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS not_a_lead boolean NOT NULL DEFAULT false;
