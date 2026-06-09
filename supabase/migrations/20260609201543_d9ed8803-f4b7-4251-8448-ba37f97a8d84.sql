
CREATE TABLE public.automation_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_preferences TO authenticated;
GRANT ALL ON public.automation_preferences TO service_role;

ALTER TABLE public.automation_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own automation prefs"
ON public.automation_preferences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_automation_preferences_updated_at
BEFORE UPDATE ON public.automation_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
