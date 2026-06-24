
UPDATE public.contracts c
SET client_id = cl.id
FROM public.clients cl
WHERE c.client_id IS NULL
  AND c.user_id = cl.user_id
  AND c.client_email IS NOT NULL
  AND cl.email IS NOT NULL
  AND lower(c.client_email) = lower(cl.email);

WITH unique_name_match AS (
  SELECT co.id AS contract_id, (array_agg(cl.id))[1] AS client_id
  FROM public.contracts co
  JOIN public.clients cl
    ON cl.user_id = co.user_id
   AND lower(cl.name) = lower(co.client_name)
  WHERE co.client_id IS NULL
  GROUP BY co.id
  HAVING COUNT(*) = 1
)
UPDATE public.contracts c
SET client_id = u.client_id
FROM unique_name_match u
WHERE c.id = u.contract_id AND c.client_id IS NULL;

UPDATE public.retainers r
SET client_id = cl.id
FROM public.clients cl
WHERE r.client_id IS NULL
  AND r.user_id = cl.user_id
  AND r.client_email IS NOT NULL
  AND cl.email IS NOT NULL
  AND lower(r.client_email) = lower(cl.email);

WITH unique_name_match AS (
  SELECT re.id AS retainer_id, (array_agg(cl.id))[1] AS client_id
  FROM public.retainers re
  JOIN public.clients cl
    ON cl.user_id = re.user_id
   AND lower(cl.name) = lower(re.client_name)
  WHERE re.client_id IS NULL
  GROUP BY re.id
  HAVING COUNT(*) = 1
)
UPDATE public.retainers r
SET client_id = u.client_id
FROM unique_name_match u
WHERE r.id = u.retainer_id AND r.client_id IS NULL;
