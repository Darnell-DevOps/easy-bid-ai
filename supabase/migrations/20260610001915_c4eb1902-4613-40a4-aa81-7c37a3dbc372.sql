
DROP INDEX IF EXISTS public.deadlines_user_id_source_key_uniq;
CREATE UNIQUE INDEX deadlines_user_id_source_key_uniq
  ON public.deadlines (user_id, source_key);
