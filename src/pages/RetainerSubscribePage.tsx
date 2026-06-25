import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, CheckCircle2, Settings, AlertTriangle, Repeat, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { initializePaddle, isPaymentsConfigured, isTestMode } from "@/lib/paddle";
import { formatMoney, intervalLabel, statusBadgeClasses } from "@/lib/retainers";
import DynamicFavicon from "@/components/branding/DynamicFavicon";

interface Retainer {
  id: string;
  user_id: string;
  client_name: string;
  client_email: string | null;
  company_name: string | null;
  title: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  billing_interval: string;
  custom_interval_days: number | null;
  status: string;
  start_date: string;
  next_billing_date: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  paddle_subscription_id: string | null;
}

export default function RetainerSubscribePage() {
  const { token } = useParams();
  const { toast } = useToast();
  const [retainer, setRetainer] = useState<Retainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = async () => {
    if (!token) return;
    const { data } = await supabase
      .from("retainers")
      .select(
        "id, user_id, client_name, client_email, company_name, title, description, amount_cents, currency, billing_interval, custom_interval_days, status, start_date, next_billing_date, current_period_end, cancel_at_period_end, paddle_subscription_id",
      )
      .eq("access_token", token)
      .maybeSingle();
    setRetainer(data as Retainer | null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const subscribe = async () => {
    if (!retainer) return;
    if (!isPaymentsConfigured()) {
      toast({ title: "Payments not configured", variant: "destructive" });
      return;
    }
    setWorking(true);
    try {
      const env = isTestMode() ? "sandbox" : "live";
      const { data, error } = await supabase.functions.invoke(
        "create-retainer-subscription",
        { body: { retainerId: retainer.id, environment: env } },
      );
      if (error || !data?.transactionId) {
        throw new Error(error?.message || data?.error || "Could not start checkout");
      }
      await initializePaddle();
      window.Paddle.Checkout.open({
        transactionId: data.transactionId,
        customer: retainer.client_email ? { email: retainer.client_email } : undefined,
        settings: {
          displayMode: "overlay",
          variant: "one-page",
          successUrl: `${window.location.origin}${window.location.pathname}?subscribed=1`,
          allowLogout: false,
          theme: "dark",
        },
        eventCallback: (ev: any) => {
          if (ev?.name === "checkout.completed") {
            toast({
              title: "Subscription started",
              description: "Thanks — your retainer is now active.",
            });
            setTimeout(load, 1500);
          }
        },
      });
    } catch (e: any) {
      toast({
        title: "Could not start subscription",
        description: e?.message || "Try again",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  const openPortal = async () => {
    if (!retainer) return;
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "retainer-portal-session",
        { body: { retainerId: retainer.id } },
      );
      if (error || !data?.url) {
        throw new Error(error?.message || data?.error || "Could not open portal");
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({
        title: "Could not open billing portal",
        description: e?.message || "Try again",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!retainer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">This retainer link is invalid or expired.</p>
      </div>
    );
  }

  const isSubscribed = !!retainer.paddle_subscription_id;
  // A client should be able to subscribe whenever the retainer isn't paused/cancelled.
  // Includes draft/pending retainers that have just been shared.
  const canSubscribe = !["cancelled", "paused"].includes(retainer.status);

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Recurring service</p>
          <h1 className="text-3xl font-bold text-foreground">{retainer.title}</h1>
          <p className="text-sm text-muted-foreground">
            For {retainer.company_name || retainer.client_name}
          </p>
        </div>

        <Card className="border-border/60">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-4xl font-bold text-foreground">
                  {formatMoney(retainer.amount_cents, retainer.currency)}
                </p>
                <p className="text-sm text-muted-foreground">
                  per {intervalLabel(retainer.billing_interval, retainer.custom_interval_days).toLowerCase()}
                </p>
              </div>
              <Badge variant="outline" className={`capitalize ${statusBadgeClasses(retainer.status)}`}>
                {retainer.status.replace("_", " ")}
              </Badge>
            </div>

            {retainer.description && (
              <p className="text-sm text-foreground/90 leading-relaxed border-t border-border/40 pt-4">
                {retainer.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm border-t border-border/40 pt-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Frequency
                </p>
                <p className="text-foreground">
                  {intervalLabel(retainer.billing_interval, retainer.custom_interval_days)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Starts
                </p>
                <p className="text-foreground">
                  {new Date(retainer.start_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscribed state */}
        {isSubscribed && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-200">
                  Subscription active
                </p>
              </div>
              {retainer.next_billing_date && !retainer.cancel_at_period_end && (
                <p className="text-xs text-emerald-200/80 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Next charge on{" "}
                  {new Date(retainer.next_billing_date).toLocaleDateString()}
                </p>
              )}
              {retainer.cancel_at_period_end && retainer.current_period_end && (
                <div className="flex items-start gap-2 text-xs text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
                  <p>
                    Set to cancel on{" "}
                    {new Date(retainer.current_period_end).toLocaleDateString()}.
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={openPortal}
                disabled={working}
                className="gap-1.5 w-full"
              >
                {working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings className="w-3.5 h-3.5" />}
                Manage subscription
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                Update card · view invoices · pause or cancel
              </p>
            </CardContent>
          </Card>
        )}

        {/* Subscribe CTA */}
        {!isSubscribed && canSubscribe && (
          <Card>
            <CardContent className="p-6 space-y-3">
              <Button
                onClick={subscribe}
                disabled={working}
                className="w-full gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold hover:brightness-110 transition-all"
              >
                {working ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
                Start subscription
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Secure recurring billing · You can cancel anytime
              </p>
            </CardContent>
          </Card>
        )}

        {!isSubscribed && !canSubscribe && (
          <p className="text-center text-xs text-muted-foreground">
            This retainer is currently {retainer.status} and isn't accepting new subscriptions.
          </p>
        )}
      </div>
    </div>
  );
}
