-- Some early Lovable environments created this column outside the recorded
-- migration history. Keep fresh database replays aligned with those projects.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_status_check;

UPDATE public.proposals SET status = 'draft' WHERE status IS NULL OR LOWER(status) = 'pending';
UPDATE public.proposals SET status = LOWER(status);
UPDATE public.proposals SET status = 'draft'
  WHERE status NOT IN ('draft','sent','viewed','accepted','rejected');

ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_status_check
  CHECK (status IN ('draft','sent','viewed','accepted','rejected'));

ALTER TABLE public.proposals ALTER COLUMN status SET DEFAULT 'draft';
