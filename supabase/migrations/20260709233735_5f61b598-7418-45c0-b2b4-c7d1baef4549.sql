ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_deleted_at ON public.contracts(deleted_at);

-- Backfill: for clients already soft-deleted, cascade to their contracts
UPDATE public.contracts c
SET deleted_at = cl.deleted_at
FROM public.clients cl
WHERE c.client_id = cl.id
  AND cl.deleted_at IS NOT NULL
  AND c.deleted_at IS NULL;