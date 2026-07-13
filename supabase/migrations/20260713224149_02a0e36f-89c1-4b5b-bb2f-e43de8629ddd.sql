CREATE OR REPLACE FUNCTION public.lead_convert_to_client(_lead_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_client_id uuid;
  v_existing_client_id uuid;
  v_match_count int;
  v_email_norm text;
  v_thread_body text;
BEGIN
  SELECT * INTO v_lead FROM public.leads WHERE id = _lead_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'lead_not_found'; END IF;
  IF v_lead.client_id IS NOT NULL THEN RETURN v_lead.client_id; END IF;

  v_email_norm := lower(trim(coalesce(v_lead.email, '')));
  IF v_email_norm <> '' THEN
    SELECT count(*) INTO v_match_count
      FROM public.clients c
     WHERE c.user_id = v_lead.user_id
       AND c.deleted_at IS NULL
       AND lower(trim(coalesce(c.email, ''))) = v_email_norm;

    IF v_match_count = 1 THEN
      SELECT c.id INTO v_existing_client_id
        FROM public.clients c
       WHERE c.user_id = v_lead.user_id
         AND c.deleted_at IS NULL
         AND lower(trim(coalesce(c.email, ''))) = v_email_norm
       LIMIT 1;

      -- Merge intelligence only into currently-null fields
      UPDATE public.clients c SET
        service_requested = COALESCE(c.service_requested, v_lead.service_requested),
        budget = COALESCE(c.budget, v_lead.budget),
        timeline = COALESCE(c.timeline, v_lead.timeline),
        goals = COALESCE(c.goals, v_lead.goals),
        lead_quality = COALESCE(c.lead_quality, v_lead.lead_quality),
        ai_recommendation = COALESCE(c.ai_recommendation, v_lead.ai_recommendation),
        lead_score = COALESCE(c.lead_score, v_lead.lead_score),
        lead_score_reason = COALESCE(c.lead_score_reason, v_lead.lead_score_reason),
        missing_info = COALESCE(c.missing_info, v_lead.missing_info),
        fit_score = COALESCE(c.fit_score, v_lead.fit_score),
        fit_factors = COALESCE(c.fit_factors, v_lead.fit_factors),
        lead_draft_reply = CASE WHEN c.lead_reply_sent_at IS NULL
                                THEN COALESCE(c.lead_draft_reply, v_lead.draft_reply)
                                ELSE c.lead_draft_reply END,
        lead_draft_subject = CASE WHEN c.lead_reply_sent_at IS NULL
                                  THEN COALESCE(c.lead_draft_subject, v_lead.draft_subject)
                                  ELSE c.lead_draft_subject END
      WHERE c.id = v_existing_client_id;

      -- Append new enquiry content to lead_thread if any
      v_thread_body := NULLIF(trim(coalesce(v_lead.notes, '')), '');
      IF v_thread_body IS NULL THEN
        v_thread_body := NULLIF(
          (SELECT string_agg(key || ': ' || value, E'\n') FROM jsonb_each_text(coalesce(v_lead.responses, '{}'::jsonb))),
          ''
        );
      END IF;
      IF v_thread_body IS NOT NULL THEN
        UPDATE public.clients c
           SET lead_thread = COALESCE(c.lead_thread, '[]'::jsonb)
             || jsonb_build_array(jsonb_build_object(
                  'subject', v_lead.draft_subject,
                  'body', v_thread_body,
                  'received_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                ))
         WHERE c.id = v_existing_client_id;
      END IF;

      UPDATE public.leads
         SET client_id = v_existing_client_id, status = 'converted'
       WHERE id = _lead_id;

      RETURN v_existing_client_id;
    END IF;
  END IF;

  INSERT INTO public.clients (
    user_id, name, email, phone, company, lead_source, status,
    project_description, original_lead_message,
    intake_responses, intake_form_id,
    service_requested, budget, timeline, goals,
    lead_quality, ai_recommendation,
    lead_draft_reply, lead_draft_subject,
    lead_score, lead_score_reason, missing_info,
    fit_score, fit_factors
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
    v_lead.missing_info,
    v_lead.fit_score,
    v_lead.fit_factors
  ) RETURNING id INTO v_client_id;

  UPDATE public.leads
     SET client_id = v_client_id, status = 'converted'
   WHERE id = _lead_id;

  RETURN v_client_id;
END;
$function$;