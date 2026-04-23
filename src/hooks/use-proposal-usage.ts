import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UsageState {
  countThisMonth: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Counts proposals the current user has created since the start of this
 * calendar month. Used by plan-limit gates on NewProposal.
 */
export function useProposalUsage(): UsageState {
  const [countThisMonth, setCountThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCountThisMonth(0);
      setLoading(false);
      return;
    }
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("proposals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", start.toISOString());
    setCountThisMonth(count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return { countThisMonth, loading, refresh: fetchCount };
}
