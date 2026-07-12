CREATE OR REPLACE FUNCTION public.lead_convert_to_client(_lead_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_client_id uuid;
BEGIN
  SELECT * INTO v_lead FROM public.leads WHERE id = _lead_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'lead_not_found'; END IF;
  IF v_lead.client_id IS NOT NULL THEN RETURN v_lead.client_id; END IF;

  INSERT INTO public.clients (
    user_id, name, email, phone, company, lead_source, status,
    project_description, original_lead_message,
    intake_responses, intake_form_id,
    service_requested, budget, timeline, goals,
    lead_quality, ai_recommendation,
    lead_draft_reply, lead_draft_subject,
    lead_score, lead_score_reason, missing_info
  ) VALUES (
    v_lead.user_id,
    COALESCE(NULLIF(trim(coalesce(v_lead.name,'')), ''), 'New lead'),
    v_lead.email, v_lead.phone, v_lead.company,
    COALESCE(v_lead.source, 'form'), 'New',
    NULL,
    (SELECT string_agg(key || ': ' || value, E'\n') FROM jsonb_each_text(v_lead.responses)),
    COALESCE(v_lead.responses, '{}'::jsonb),
    v_lead.form_id,
    v_lead.service_requested, v_lead.budget, v_lead.timeline, v_lead.goals,
    v_lead.lead_quality, v_lead.ai_recommendation,
    v_lead.draft_reply, v_lead.draft_subject,
    COALESCE(
      v_lead.lead_score,
      CASE v_lead.lead_quality
        WHEN 'High' THEN 'Hot'
        WHEN 'Medium' THEN 'Warm'
        WHEN 'Low' THEN 'Cold'
        ELSE 'Unclear'
      END
    ),
    v_lead.lead_score_reason,
    v_lead.missing_info
  ) RETURNING id INTO v_client_id;

  UPDATE public.leads
     SET client_id = v_client_id, status = 'converted'
   WHERE id = _lead_id;

  RETURN v_client_id;
END;
$function$;