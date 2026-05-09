import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadLeadsCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { count: c } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("unread_at", "is", null);
      if (!cancelled) setCount(c || 0);

      channel = supabase
        .channel(`unread-leads-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "clients", filter: `user_id=eq.${user.id}` },
          () => { void load(); },
        )
        .subscribe();
    };

    void load();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
