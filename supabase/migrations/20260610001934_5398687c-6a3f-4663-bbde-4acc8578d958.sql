
-- Patch only the retainer insert to use billing_interval
DO $$
BEGIN
  -- Recompile the function by replacing the single offending string
  -- (cheaper than re-pasting the whole function): just CREATE OR REPLACE the
  -- function from the existing source with a sed-like substitution is not
  -- possible inside SQL — easiest path: do a small targeted UPDATE on pg_proc
  NULL;
END $$;

-- Recreate just the retainer insert region by replacing the function definition isn't trivial here.
-- Instead, alter the harness via a tiny wrapper that overrides the call.
-- Easier: just CREATE OR REPLACE the function with one line corrected.
