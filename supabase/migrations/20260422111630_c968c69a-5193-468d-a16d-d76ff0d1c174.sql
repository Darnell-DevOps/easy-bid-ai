
CREATE TABLE public.policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  country TEXT NOT NULL,
  policy_type TEXT NOT NULL,
  services_offered TEXT,
  payment_methods TEXT,
  refund_rules TEXT,
  data_collection TEXT,
  special_requirements TEXT,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own policies"
ON public.policies FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own policies"
ON public.policies FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own policies"
ON public.policies FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own policies"
ON public.policies FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_policies_updated_at
BEFORE UPDATE ON public.policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
