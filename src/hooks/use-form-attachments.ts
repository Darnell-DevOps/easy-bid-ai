import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFormAttachments() {
  return useQuery({
    queryKey: ["form-attachments-available"],
    queryFn: async () => {
      const { data } = await supabase.rpc("form_attachments_available");
      return data === true;
    },
    retry: false,
  });
}
