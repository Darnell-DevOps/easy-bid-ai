
-- ============ CONTRACTS ============
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  proposal_id UUID,
  client_id UUID,
  contract_type TEXT NOT NULL DEFAULT 'service_agreement',
  title TEXT NOT NULL DEFAULT 'Service Agreement',
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT,
  company_name TEXT,
  body TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | viewed | signed
  signing_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX contracts_signing_token_idx ON public.contracts(signing_token);
CREATE INDEX contracts_user_idx ON public.contracts(user_id);
CREATE INDEX contracts_proposal_idx ON public.contracts(proposal_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own contracts" ON public.contracts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own contracts" ON public.contracts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own contracts" ON public.contracts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own contracts" ON public.contracts
  FOR DELETE USING (auth.uid() = user_id);

-- Public read by signing token (token acts as the secret)
CREATE POLICY "Public view contracts via token" ON public.contracts
  FOR SELECT TO anon, authenticated USING (true);

-- Public can update viewed_at / signed_at / status when they have the token
-- We restrict via an RPC instead (security definer). Keep UPDATE owner-only.

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SIGNATURES ============
CREATE TABLE public.contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  method TEXT NOT NULL DEFAULT 'typed', -- typed | drawn
  signature_data TEXT NOT NULL, -- typed text OR data:image/png;base64,...
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX contract_signatures_contract_idx ON public.contract_signatures(contract_id);
CREATE INDEX contract_signatures_user_idx ON public.contract_signatures(user_id);

ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view signatures for own contracts" ON public.contract_signatures
  FOR SELECT USING (auth.uid() = user_id);

-- Public view (so the signing page can show the signed state)
CREATE POLICY "Public view signatures" ON public.contract_signatures
  FOR SELECT TO anon, authenticated USING (true);

-- ============ PUBLIC SIGNING RPC ============
CREATE OR REPLACE FUNCTION public.contract_record_view(_token TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contracts
     SET viewed_at = COALESCE(viewed_at, now()),
         status = CASE WHEN status IN ('draft','sent') THEN 'viewed' ELSE status END
   WHERE signing_token = _token;
END;
$$;

CREATE OR REPLACE FUNCTION public.contract_sign(
  _token TEXT,
  _signer_name TEXT,
  _signer_email TEXT,
  _method TEXT,
  _signature_data TEXT,
  _ip TEXT,
  _ua TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract public.contracts%ROWTYPE;
  v_sig_id UUID;
BEGIN
  SELECT * INTO v_contract FROM public.contracts WHERE signing_token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid signing token';
  END IF;

  IF v_contract.status = 'signed' THEN
    RAISE EXCEPTION 'Contract already signed';
  END IF;

  IF _method NOT IN ('typed','drawn') THEN
    RAISE EXCEPTION 'Invalid signature method';
  END IF;

  IF length(coalesce(_signer_name,'')) < 2 THEN
    RAISE EXCEPTION 'Signer name required';
  END IF;

  INSERT INTO public.contract_signatures (
    contract_id, user_id, signer_name, signer_email, method, signature_data, ip_address, user_agent
  ) VALUES (
    v_contract.id, v_contract.user_id, _signer_name, _signer_email, _method, _signature_data, _ip, _ua
  ) RETURNING id INTO v_sig_id;

  UPDATE public.contracts
     SET status = 'signed',
         signed_at = now(),
         viewed_at = COALESCE(viewed_at, now())
   WHERE id = v_contract.id;

  RETURN v_sig_id;
END;
$$;
