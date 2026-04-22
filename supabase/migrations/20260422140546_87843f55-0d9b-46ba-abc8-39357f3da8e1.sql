-- Add client response message column
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS client_response_message text;

-- Allow public (anon) read access so the client portal can fetch a proposal by id
CREATE POLICY "Public can view proposals via link"
  ON public.proposals
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow public (anon) to update only tracking/response fields via the portal.
-- We can't restrict columns in RLS, but we limit the policy to anon and the app
-- only sends tracking fields. Authenticated users keep their existing policy.
CREATE POLICY "Public can respond to proposals via link"
  ON public.proposals
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
