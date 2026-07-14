CREATE OR REPLACE FUNCTION public.contract_record_view(_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.contracts
     SET viewed_at = CASE WHEN status = 'sent' THEN COALESCE(viewed_at, now()) ELSE viewed_at END,
         status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
   WHERE signing_token = _token;
END;
$function$;