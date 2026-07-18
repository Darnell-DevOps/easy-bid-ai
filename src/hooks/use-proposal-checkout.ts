import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initializePaddle, isPaymentsConfigured, isTestMode } from "@/lib/paddle";
import { useToast } from "@/hooks/use-toast";

interface Options {
  proposalId: string;
  clientEmail?: string;
  onPaid?: () => void;
}

export function useProposalCheckout() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const openCheckout = useCallback(
    async ({ proposalId, clientEmail, onPaid }: Options) => {
      if (!isPaymentsConfigured()) {
        toast({
          title: "Payments unavailable",
          description: "Payment system is not configured yet.",
          variant: "destructive",
        });
        return false;
      }
      setLoading(true);
      try {
        const env = isTestMode() ? "sandbox" : "live";
        const { data, error } = await supabase.functions.invoke(
          "create-proposal-checkout",
          { body: { proposalId, environment: env } },
        );
        if (error || !data?.transactionId) {
          throw new Error(error?.message || data?.error || "Could not start checkout");
        }
        await initializePaddle((event) => {
          if (event.name === "checkout.completed") {
            toast({
              title: "Payment complete",
              description: "Thanks! Your payment was received.",
            });
            onPaid?.();
          }
        });
        window.Paddle.Checkout.open({
          transactionId: data.transactionId,
          customer: clientEmail ? { email: clientEmail } : undefined,
          settings: {
            displayMode: "overlay",
            variant: "one-page",
            successUrl: `${window.location.origin}${window.location.pathname}?paid=1`,
            allowLogout: false,
            theme: "dark",
          },
        });
        return true;
      } catch (error: unknown) {
        toast({
          title: "Payment failed to start",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  return { openCheckout, loading, available: isPaymentsConfigured() };
}
