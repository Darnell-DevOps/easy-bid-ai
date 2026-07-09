-- 1. Add deleted_at columns
ALTER TABLE public.retainers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.lead_auto_send_log ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS retainers_deleted_at_idx ON public.retainers (deleted_at);
CREATE INDEX IF NOT EXISTS lead_auto_send_log_deleted_at_idx ON public.lead_auto_send_log (deleted_at);

-- 2. Null out orphaned client_id values, then add FKs
UPDATE public.retainers
SET client_id = NULL
WHERE client_id IS NOT NULL
  AND client_id NOT IN (SELECT id FROM public.clients);

UPDATE public.lead_auto_send_log
SET client_id = NULL
WHERE client_id IS NOT NULL
  AND client_id NOT IN (SELECT id FROM public.clients);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retainers_client_id_fkey'
  ) THEN
    ALTER TABLE public.retainers
      ADD CONSTRAINT retainers_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lead_auto_send_log_client_id_fkey'
  ) THEN
    ALTER TABLE public.lead_auto_send_log
      ADD CONSTRAINT lead_auto_send_log_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Backfill: soft-delete retainers/lead_auto_send_log for already-trashed clients
UPDATE public.retainers r
SET deleted_at = now()
FROM public.clients c
WHERE r.client_id = c.id
  AND c.deleted_at IS NOT NULL
  AND r.deleted_at IS NULL;

UPDATE public.lead_auto_send_log l
SET deleted_at = now()
FROM public.clients c
WHERE l.client_id = c.id
  AND c.deleted_at IS NOT NULL
  AND l.deleted_at IS NULL;