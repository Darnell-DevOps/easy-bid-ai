DROP POLICY IF EXISTS "users update own sending domains" ON public.sending_domains;
CREATE POLICY "users update own sending domains"
  ON public.sending_domains
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);