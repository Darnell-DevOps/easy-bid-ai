
CREATE TABLE public.reminder_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  stage TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  related_id UUID,
  recipient TEXT,
  idempotency_key TEXT NOT NULL,
  error TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key, status)
);

CREATE INDEX reminder_audit_user_idx ON public.reminder_audit_log(user_id, attempted_at DESC);
CREATE INDEX reminder_audit_related_idx ON public.reminder_audit_log(related_id) WHERE related_id IS NOT NULL;

GRANT SELECT ON public.reminder_audit_log TO authenticated;
GRANT ALL ON public.reminder_audit_log TO service_role;

ALTER TABLE public.reminder_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reminder audit log"
ON public.reminder_audit_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
