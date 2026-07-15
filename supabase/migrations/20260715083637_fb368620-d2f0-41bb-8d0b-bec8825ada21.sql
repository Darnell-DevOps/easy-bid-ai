
CREATE OR REPLACE FUNCTION public.onboarding_submit(_token text, _responses jsonb, _complete boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_form public.onboarding_forms%ROWTYPE;
  v_was_completed boolean;
BEGIN
  SELECT * INTO v_form FROM public.onboarding_forms WHERE access_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid onboarding token'; END IF;

  v_was_completed := (v_form.status = 'completed');

  UPDATE public.onboarding_forms
     SET responses    = COALESCE(_responses, '{}'::jsonb),
         status       = CASE WHEN _complete THEN 'completed' ELSE 'in_progress' END,
         started_at   = COALESCE(started_at, now()),
         completed_at = CASE WHEN _complete AND completed_at IS NULL THEN now() ELSE completed_at END
   WHERE id = v_form.id;

  IF _complete AND NOT v_was_completed AND public.automation_enabled(v_form.user_id, 'onboarding_notify_completed') THEN
    INSERT INTO public.user_notifications (
      user_id, category, key, title, body, metadata
    ) VALUES (
      v_form.user_id, 'onboarding', 'onboarding_completed',
      'Onboarding completed',
      COALESCE(v_form.client_name, 'A client') || ' completed their onboarding form.',
      jsonb_build_object('onboarding_form_id', v_form.id)
    );
  END IF;

  RETURN v_form.id;
END;
$function$;
