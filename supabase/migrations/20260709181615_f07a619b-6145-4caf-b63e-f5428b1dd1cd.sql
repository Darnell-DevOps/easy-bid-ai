
ALTER TABLE public.clients          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.proposals        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.onboarding_forms ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.deadlines        ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS clients_deleted_at_idx          ON public.clients          (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS proposals_deleted_at_idx        ON public.proposals        (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS onboarding_forms_deleted_at_idx ON public.onboarding_forms (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS deadlines_deleted_at_idx        ON public.deadlines        (deleted_at) WHERE deleted_at IS NOT NULL;
