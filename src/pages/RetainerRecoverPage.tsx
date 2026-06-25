import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import DynamicFavicon from "@/components/branding/DynamicFavicon";

interface RetainerLite {
  user_id: string;
  client_name: string;
  title: string;
  has_failed_payment: boolean;
  failed_payment_reason: string | null;
  status: string;
  amount_cents: number;
  currency: string;
}

export default function RetainerRecoverPage() {
  const { token } = useParams<{ token: string }>();
  const [retainer, setRetainer] = useState<RetainerLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await supabase
        .from("retainers")
        .select(
          "user_id, client_name, title, has_failed_payment, failed_payment_reason, status, amount_cents, currency",
        )
        .eq("access_token", token)
        .maybeSingle();
      setRetainer(data as RetainerLite | null);
      setLoading(false);
    })();
  }, [token]);

  const openPortal = async () => {
    if (!token) return;
    setOpening(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "retainer-recover-portal",
        { body: { token } },
      );
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        setError("Could not open the payment portal. Please contact support.");
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!retainer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-2">
            <h1 className="text-lg font-semibold">Link not found</h1>
            <p className="text-sm text-muted-foreground">
              This recovery link is invalid or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const resolved = !retainer.has_failed_payment && retainer.status === "active";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <Card className="max-w-lg w-full border-border/60">
        <CardContent className="p-8 space-y-6">
          {resolved ? (
            <>
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">You're all set</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Hi {retainer.client_name}, your payment for{" "}
                  <span className="font-medium text-foreground">
                    {retainer.title}
                  </span>{" "}
                  is up to date. No action needed.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">
                  Update your payment method
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Hi {retainer.client_name}, the most recent charge for{" "}
                  <span className="font-medium text-foreground">
                    {retainer.title}
                  </span>{" "}
                  didn't go through. Update your payment method below to keep
                  things running.
                </p>
                {retainer.failed_payment_reason && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Reason: {retainer.failed_payment_reason}
                  </p>
                )}
              </div>

              <Button
                onClick={openPortal}
                disabled={opening}
                size="lg"
                className="w-full"
              >
                {opening ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Update payment method
              </Button>

              {error && (
                <p className="text-xs text-rose-500 text-center">{error}</p>
              )}

              <p className="text-[11px] text-muted-foreground text-center">
                You'll be redirected to a secure payment page.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
