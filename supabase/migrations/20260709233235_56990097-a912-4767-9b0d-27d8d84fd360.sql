
-- Null out any remaining deadlines.client_id values that point at non-existent clients
UPDATE public.deadlines
   SET client_id = NULL
 WHERE client_id IS NOT NULL
   AND client_id NOT IN (SELECT id FROM public.clients);

ALTER TABLE public.deadlines
  ADD CONSTRAINT deadlines_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
