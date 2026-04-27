-- RETAINERS TABLE
CREATE TABLE public.retainers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID,
  proposal_id UUID,
  contract_id UUID,

  -- client snapshot
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT,
  company_name TEXT,

  -- product
  template_key TEXT,
  service_type TEXT,
  title TEXT NOT NULL DEFAULT 'Monthly Retainer',
  description TEXT,

  -- billing
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_interval TEXT NOT NULL DEFAULT 'monthly', -- weekly|monthly|quarterly|custom
  custom_interval_days INTEGER,
  start_date DATE NOT NULL DEFAULT (now()::date),
  end_date DATE,
  auto_renew BOOLEAN NOT NULL DEFAULT true,

  -- lifecycle
  status TEXT NOT NULL DEFAULT 'draft', -- draft|active|paused|pending_renewal|cancelled|completed
  next_billing_date DATE,
  last_billed_date DATE,
  total_billed_cents INTEGER NOT NULL DEFAULT 0,
  total_payments_count INTEGER NOT NULL DEFAULT 0,

  -- failed payment tracking
  has_failed_payment BOOLEAN NOT NULL DEFAULT false,
  failed_payment_reason TEXT,
  failed_payment_at TIMESTAMPTZ,

  -- paddle integration (for future auto-charge)
  paddle_subscription_id TEXT,
  paddle_customer_id TEXT,
  paddle_product_id TEXT,
  paddle_price_id TEXT,
  environment TEXT,

  -- public access for client portal
  access_token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(18), 'hex'),

  notes TEXT,
  paused_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  renewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_retainers_user ON public.retainers(user_id);
CREATE INDEX idx_retainers_status ON public.retainers(status);
CREATE INDEX idx_retainers_next_billing ON public.retainers(next_billing_date);
CREATE UNIQUE INDEX idx_retainers_access_token ON public.retainers(access_token);

ALTER TABLE public.retainers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own retainers" ON public.retainers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own retainers" ON public.retainers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own retainers" ON public.retainers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own retainers" ON public.retainers
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public view retainers by token" ON public.retainers
  FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER update_retainers_updated_at
BEFORE UPDATE ON public.retainers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RETAINER INVOICES TABLE
CREATE TABLE public.retainer_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  retainer_id UUID NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled|paid|failed|skipped
  paddle_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_retainer_invoices_user ON public.retainer_invoices(user_id);
CREATE INDEX idx_retainer_invoices_retainer ON public.retainer_invoices(retainer_id);
CREATE INDEX idx_retainer_invoices_status ON public.retainer_invoices(status);

ALTER TABLE public.retainer_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own retainer invoices" ON public.retainer_invoices
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own retainer invoices" ON public.retainer_invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own retainer invoices" ON public.retainer_invoices
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own retainer invoices" ON public.retainer_invoices
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_retainer_invoices_updated_at
BEFORE UPDATE ON public.retainer_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();