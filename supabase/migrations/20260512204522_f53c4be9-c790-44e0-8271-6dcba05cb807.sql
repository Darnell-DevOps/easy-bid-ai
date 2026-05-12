
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_key TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cta_text TEXT,
  cta_url_var TEXT,
  sign_off TEXT,
  sender_display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_key)
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own email templates" ON public.email_templates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own email templates" ON public.email_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own email templates" ON public.email_templates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own email templates" ON public.email_templates
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_email_templates_updated
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.business_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  business_name TEXT,
  logo_url TEXT,
  brand_color TEXT,
  default_sender_name TEXT,
  default_sign_off TEXT,
  reply_to_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own branding" ON public.business_branding
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own branding" ON public.business_branding
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own branding" ON public.business_branding
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own branding" ON public.business_branding
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_business_branding_updated
  BEFORE UPDATE ON public.business_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
