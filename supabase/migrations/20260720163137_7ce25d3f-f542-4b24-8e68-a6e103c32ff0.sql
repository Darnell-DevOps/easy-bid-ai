ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS generation_status TEXT NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS generation_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generation_last_error TEXT,
  ADD COLUMN IF NOT EXISTS generation_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generation_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generation_next_retry_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contracts_generation_status_check'
      AND conrelid = 'public.contracts'::regclass
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_generation_status_check
      CHECK (generation_status IN ('not_requested', 'queued', 'generating', 'ready', 'failed'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_acceptance_contract_generation_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'acceptance_auto' THEN
    IF length(trim(COALESCE(NEW.body, ''))) > 0 THEN
      NEW.generation_status := 'ready';
      NEW.generation_completed_at := COALESCE(NEW.generation_completed_at, now());
      NEW.generation_last_error := NULL;
      NEW.generation_next_retry_at := NULL;
    ELSIF TG_OP = 'INSERT' THEN
      NEW.generation_status := 'queued';
      NEW.generation_next_retry_at := now();
    ELSIF OLD.source IS DISTINCT FROM 'acceptance_auto' THEN
      NEW.generation_status := 'queued';
      NEW.generation_next_retry_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acceptance_contract_generation_state ON public.contracts;
CREATE TRIGGER trg_acceptance_contract_generation_state
  BEFORE INSERT OR UPDATE OF source, body ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_acceptance_contract_generation_state();

UPDATE public.contracts
SET generation_status = CASE
      WHEN length(trim(COALESCE(body, ''))) > 0 THEN 'ready'
      ELSE 'queued'
    END,
    generation_completed_at = CASE
      WHEN length(trim(COALESCE(body, ''))) > 0 THEN COALESCE(generation_completed_at, updated_at)
      ELSE NULL
    END,
    generation_next_retry_at = CASE
      WHEN length(trim(COALESCE(body, ''))) = 0 THEN now()
      ELSE NULL
    END
WHERE source = 'acceptance_auto';

CREATE INDEX IF NOT EXISTS idx_contract_generation_retry
  ON public.contracts(generation_status, generation_next_retry_at)
  WHERE source = 'acceptance_auto' AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.claim_acceptance_contract_generation(
  _proposal_id UUID,
  _force BOOLEAN DEFAULT false
) RETURNS TABLE(contract_id UUID, claimed BOOLEAN, current_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract public.contracts%ROWTYPE;
BEGIN
  SELECT * INTO v_contract
  FROM public.contracts
  WHERE proposal_id = _proposal_id
    AND source = 'acceptance_auto'
    AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF length(trim(COALESCE(v_contract.body, ''))) > 0 THEN
    UPDATE public.contracts
    SET generation_status = 'ready',
        generation_completed_at = COALESCE(generation_completed_at, now()),
        generation_last_error = NULL,
        generation_next_retry_at = NULL
    WHERE id = v_contract.id;
    RETURN QUERY SELECT v_contract.id, false, 'ready'::text;
    RETURN;
  END IF;

  IF v_contract.generation_status = 'generating'
     AND v_contract.generation_started_at > now() - interval '10 minutes' THEN
    RETURN QUERY SELECT v_contract.id, false, 'generating'::text;
    RETURN;
  END IF;

  IF v_contract.generation_status = 'failed'
     AND v_contract.generation_next_retry_at > now()
     AND NOT _force THEN
    RETURN QUERY SELECT v_contract.id, false, 'failed'::text;
    RETURN;
  END IF;

  UPDATE public.contracts
  SET generation_status = 'generating',
      generation_attempts = generation_attempts + 1,
      generation_started_at = now(),
      generation_last_error = NULL
  WHERE id = v_contract.id;

  RETURN QUERY SELECT v_contract.id, true, 'generating'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_acceptance_contract_generation(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_acceptance_contract_generation(UUID, BOOLEAN) TO service_role;

DROP FUNCTION IF EXISTS public.public_get_contract_for_proposal(UUID);
CREATE FUNCTION public.public_get_contract_for_proposal(_proposal_id UUID)
RETURNS TABLE(
  id UUID,
  title TEXT,
  status TEXT,
  signing_token TEXT,
  signed_at TIMESTAMPTZ,
  generation_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.title, c.status, c.signing_token, c.signed_at, c.generation_status
  FROM public.contracts c
  WHERE c.proposal_id = _proposal_id
    AND c.deleted_at IS NULL
  ORDER BY c.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.public_get_contract_for_proposal(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_contract_for_proposal(UUID) TO anon, authenticated;