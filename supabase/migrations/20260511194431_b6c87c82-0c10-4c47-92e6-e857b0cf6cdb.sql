-- Restrict "public via token" SELECT policies to anon role only.
-- Previously these were granted to {anon, authenticated} with USING (true),
-- which caused authenticated users to see ALL rows across accounts because
-- RLS policies combine with OR. Authenticated users remain scoped by the
-- existing owner policies (auth.uid() = user_id).

-- proposals
DROP POLICY IF EXISTS "Public can view proposals via link" ON public.proposals;
CREATE POLICY "Public can view proposals via link"
  ON public.proposals FOR SELECT
  TO anon
  USING (true);

-- contracts
DROP POLICY IF EXISTS "Public view contracts via token" ON public.contracts;
CREATE POLICY "Public view contracts via token"
  ON public.contracts FOR SELECT
  TO anon
  USING (true);

-- contract_signatures
DROP POLICY IF EXISTS "Public view signatures" ON public.contract_signatures;
CREATE POLICY "Public view signatures"
  ON public.contract_signatures FOR SELECT
  TO anon
  USING (true);

-- onboarding_forms
DROP POLICY IF EXISTS "Public view onboarding by token" ON public.onboarding_forms;
CREATE POLICY "Public view onboarding by token"
  ON public.onboarding_forms FOR SELECT
  TO anon
  USING (true);

-- retainers
DROP POLICY IF EXISTS "Public view retainers by token" ON public.retainers;
CREATE POLICY "Public view retainers by token"
  ON public.retainers FOR SELECT
  TO anon
  USING (true);

-- review_requests
DROP POLICY IF EXISTS "Public view review requests by token" ON public.review_requests;
CREATE POLICY "Public view review requests by token"
  ON public.review_requests FOR SELECT
  TO anon
  USING (true);

-- bookings (public read for client portal lookup by proposal_id)
DROP POLICY IF EXISTS "Public view bookings for proposal" ON public.bookings;
CREATE POLICY "Public view bookings for proposal"
  ON public.bookings FOR SELECT
  TO anon
  USING (proposal_id IS NOT NULL);

-- bookings (public create via active link)
DROP POLICY IF EXISTS "Public create bookings via link" ON public.bookings;
CREATE POLICY "Public create bookings via link"
  ON public.bookings FOR INSERT
  TO anon
  WITH CHECK (
    booking_link_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.booking_links bl
      WHERE bl.id = bookings.booking_link_id
        AND bl.user_id = bookings.user_id
        AND bl.is_active = true
    )
  );

-- booking_links (public read by slug)
DROP POLICY IF EXISTS "Public view booking links by slug" ON public.booking_links;
CREATE POLICY "Public view booking links by slug"
  ON public.booking_links FOR SELECT
  TO anon
  USING (is_active = true);
