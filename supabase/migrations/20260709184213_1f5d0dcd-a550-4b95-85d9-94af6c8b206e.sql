
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS project_stage text;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_project_stage_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_project_stage_check
  CHECK (project_stage IS NULL OR project_stage IN ('ready_for_kickoff','kickoff_scheduled','kickoff_completed','project_active'));

ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS kickoff_booking_url text;

CREATE OR REPLACE FUNCTION public.recompute_kickoff_readiness(_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_contract boolean;
  has_onboarding boolean;
  payment_ok boolean;
  current_stage text;
BEGIN
  IF _client_id IS NULL THEN RETURN; END IF;
  SELECT project_stage INTO current_stage FROM public.clients WHERE id = _client_id;
  IF current_stage IS NOT NULL THEN RETURN; END IF;

  SELECT EXISTS(SELECT 1 FROM public.contracts WHERE client_id = _client_id AND status = 'executed') INTO has_contract;
  SELECT EXISTS(SELECT 1 FROM public.onboarding_forms WHERE client_id = _client_id AND status = 'completed') INTO has_onboarding;
  SELECT (
    NOT EXISTS(SELECT 1 FROM public.proposals WHERE client_id = _client_id AND COALESCE(amount_cents,0) > 0)
    OR EXISTS(SELECT 1 FROM public.proposals WHERE client_id = _client_id AND COALESCE(amount_cents,0) > 0 AND client_paid = true)
  ) INTO payment_ok;

  IF has_contract AND has_onboarding AND payment_ok THEN
    UPDATE public.clients SET project_stage = 'ready_for_kickoff' WHERE id = _client_id AND project_stage IS NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_kickoff_readiness()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    PERFORM public.recompute_kickoff_readiness(NEW.client_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contracts_recompute_kickoff ON public.contracts;
CREATE TRIGGER contracts_recompute_kickoff AFTER UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_kickoff_readiness();

DROP TRIGGER IF EXISTS onboarding_forms_recompute_kickoff ON public.onboarding_forms;
CREATE TRIGGER onboarding_forms_recompute_kickoff AFTER UPDATE ON public.onboarding_forms
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_kickoff_readiness();

DROP TRIGGER IF EXISTS proposals_recompute_kickoff ON public.proposals;
CREATE TRIGGER proposals_recompute_kickoff AFTER UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_kickoff_readiness();

CREATE OR REPLACE FUNCTION public.public_get_kickoff_booking_url(_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT kickoff_booking_url FROM public.user_settings WHERE user_id = _user_id LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.public_get_kickoff_booking_url(uuid) TO anon, authenticated;
