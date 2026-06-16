
CREATE TABLE public.proposal_follow_ups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  scenario TEXT NOT NULL,
  recipient_email TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, scenario)
);

CREATE INDEX idx_proposal_follow_ups_user ON public.proposal_follow_ups(user_id);
CREATE INDEX idx_proposal_follow_ups_proposal ON public.proposal_follow_ups(proposal_id);

GRANT SELECT ON public.proposal_follow_ups TO authenticated;
GRANT ALL ON public.proposal_follow_ups TO service_role;

ALTER TABLE public.proposal_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their proposal follow-ups"
  ON public.proposal_follow_ups
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
