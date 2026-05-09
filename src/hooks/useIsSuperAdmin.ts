import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsSuperAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("is_super_admin");
      if (cancelled) return;
      setIsAdmin(error ? false : Boolean(data));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}
