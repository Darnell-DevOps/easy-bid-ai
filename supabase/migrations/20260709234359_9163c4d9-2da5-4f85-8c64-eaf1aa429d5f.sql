UPDATE public.contracts
SET client_id = NULL
WHERE client_id IS NOT NULL
  AND client_id NOT IN (SELECT id FROM public.clients);

ALTER TABLE public.contracts
ADD CONSTRAINT contracts_client_id_fkey
FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

UPDATE public.contracts
SET deleted_at = now()
WHERE id IN (
  '2898f707-df1c-4a2d-bef9-749dc6b6de02',
  'ec036b40-b978-4343-b5a8-68e7b2bff5b7',
  '208a4953-a4db-4df5-81d5-6fbbb0388b3b',
  'ca0dd36e-dbf4-484b-872e-be9f2a987983',
  'ca1cfda6-9216-48fe-ae5f-771605009a9c',
  'adaa1611-6944-463d-bd8e-bd63d3e4a23c'
) AND deleted_at IS NULL;