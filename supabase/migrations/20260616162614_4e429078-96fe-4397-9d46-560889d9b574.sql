GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_settings TO authenticated;
GRANT ALL ON public.whatsapp_settings TO service_role;

GRANT SELECT ON public.whatsapp_send_log TO authenticated;
GRANT ALL ON public.whatsapp_send_log TO service_role;

GRANT SELECT ON public.reminder_audit_log TO authenticated;
GRANT ALL ON public.reminder_audit_log TO service_role;