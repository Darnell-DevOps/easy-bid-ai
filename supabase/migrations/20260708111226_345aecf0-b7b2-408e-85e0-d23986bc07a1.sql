UPDATE public.onboarding_forms SET client_id = NULL WHERE client_id IS NOT NULL AND client_id NOT IN (SELECT id FROM public.clients);

ALTER TABLE public.onboarding_forms ADD CONSTRAINT onboarding_forms_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;