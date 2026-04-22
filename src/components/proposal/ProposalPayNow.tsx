import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { initializePaddle, isPaymentsConfigured, isTestMode } from "@/lib/paddle";

interface ProposalPayNowProps {
  proposalId: string;
  amountCents: number | null;
  currency: string | null;
  clientPaid: boolean;
  clientEmail?: string;
  onPaid?: () => void;
}

function formatAmount(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export default function ProposalPayNow({
  proposalId,
  amountCents,
  currency,
  clientPaid,
  clientEmail,
  onPaid,
}: ProposalPayNowProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (clientPaid) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 lg:p-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 mb-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Payment received</h3>
        <p className="text-sm text-muted-foreground">
          Thank you — your payment was processed successfully.
        </p>
      </div>
    );
  }

  if (!amountCents || amountCents < 70) {
    return null; // No price set — owner must add an amount in their dashboard
  }
  if (!isPaymentsConfigured()) return null;

  const handlePay = async () => {
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
      await initializePaddle();
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
        eventCallback: (ev: any) => {
          if (ev?.name === "checkout.completed") {
            toast({ title: "Payment complete", description: "Thanks! Your payment was received." });
            onPaid?.();
          }
        },
      });
    } catch (e: any) {
      toast({
        title: "Payment failed to start",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-purple/30 bg-card p-6 lg:p-8 shadow-lg shadow-purple/5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-purple font-semibold mb-1">Total due</p>
          <p className="text-3xl lg:text-4xl font-bold text-foreground">
            {formatAmount(amountCents, currency || "USD")}
          </p>
        </div>
        <Button
          size="lg"
          onClick={handlePay}
          disabled={loading}
          className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 hover:shadow-purple/30 transition-all h-12 px-6"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
          ) : (
            <CreditCard className="w-4 h-4 shrink-0" />
          )}
          Pay Now
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground text-center sm:text-left">
        Secure checkout · Card details are never stored on this site.
      </p>
    </div>
  );
}
