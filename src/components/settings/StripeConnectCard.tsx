import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, ExternalLink, Info, Loader2, RefreshCw, Store } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import {
  CONNECT_ERROR_FALLBACK,
  STRIPE_CONNECT_COUNTRIES,
  countryName,
  interpretConnectResponse,
  isSupportedConnectCountry,
  safeStripeOnboardingUrl,
  type ConnectState,
} from "@/lib/stripe-connect-status";

const FUNCTION_NAME = "stripe-connect-account";

type Props = { redirect?: (url: string) => void };

export default function StripeConnectCard({ redirect = (url) => window.location.assign(url) }: Props) {
  const [state, setState] = useState<ConnectState | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [country, setCountry] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const countryId = useId();
  const helpId = `${countryId}-help`;
  const errorId = `${countryId}-error`;

  const countries = useMemo(
    () => STRIPE_CONNECT_COUNTRIES.map((code) => ({ code, name: countryName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body: { action: "status" } });
      setState(error ? { kind: "error", message: CONNECT_ERROR_FALLBACK } : interpretConnectResponse(data));
    } catch {
      setState({ kind: "error", message: CONNECT_ERROR_FALLBACK });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const needsCountry = state?.kind === "unconnected";

  const startOnboarding = async () => {
    setActionError(null);
    const code = country.trim().toUpperCase();
    if (needsCountry && !isSupportedConnectCountry(code)) {
      setActionError("Select your business's legal country to continue.");
      return;
    }
    setStarting(true);
    try {
      const body = needsCountry ? { action: "onboard", country: code } : { action: "onboard" };
      const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body });
      if (error) throw new Error("request");
      const result = data as Record<string, unknown> | null;
      if (result && typeof result.error === "string") {
        setActionError(result.error);
        return;
      }
      const url = safeStripeOnboardingUrl(result?.url);
      if (url) {
        redirect(url);
        return;
      }
      // No link returned: refresh from the server rather than assuming a state.
      setState(interpretConnectResponse(result));
      if (!result || result.ready !== true) setActionError("Stripe did not return a valid onboarding link. Please retry.");
    } catch {
      setActionError("We couldn't start Stripe onboarding. Please retry.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Card aria-labelledby={`${countryId}-title`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Store className="w-5 h-5 text-primary" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 id={`${countryId}-title`} className="text-sm font-semibold text-foreground">Stripe Connect</h4>
              <Badge variant="outline" className="text-[10px]">Test mode</Badge>
              {!loading && state && <ConnectBadge state={state} />}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Connect your own Stripe account so client payments can go directly to your business.
              Stripe collects identity and bank details on its own secure pages — CloseSync never asks for them.
            </p>
          </div>
        </div>

        <div className="mt-4" role="status" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Checking Stripe connection…
            </p>
          ) : state ? (
            <StateMessage state={state} />
          ) : null}
        </div>

        {!loading && needsCountry && (
          <div className="mt-4 space-y-1.5">
            <Label htmlFor={countryId}>Legal business country</Label>
            <select
              id={countryId}
              value={country}
              onChange={(e) => { setCountry(e.target.value); setActionError(null); }}
              aria-describedby={actionError ? `${helpId} ${errorId}` : helpId}
              aria-invalid={actionError ? true : undefined}
              aria-required="true"
              className="flex h-10 w-full sm:max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="">Select a country</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
            <p id={helpId} className="text-xs text-muted-foreground">
              The country where your business is legally registered. This can't be changed later in Stripe.
            </p>
          </div>
        )}

        {actionError && (
          <p id={errorId} role="alert" className="mt-3 text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" /> {actionError}
          </p>
        )}

        <Separator className="my-4" />

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => void loadStatus()} disabled={loading || starting} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Refresh status
          </Button>
          {!loading && (state?.kind === "unconnected" || state?.kind === "incomplete") && (
            <Button size="sm" onClick={() => void startOnboarding()} disabled={starting} className="gap-1.5">
              {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />}
              {state.kind === "unconnected" ? "Connect with Stripe" : "Continue Stripe setup"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectBadge({ state }: { state: ConnectState }) {
  switch (state.kind) {
    case "ready":
      return <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 gap-1"><CheckCircle2 className="w-2.5 h-2.5" aria-hidden="true" /> Connected</Badge>;
    case "incomplete":
      return <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 gap-1"><CircleDashed className="w-2.5 h-2.5" aria-hidden="true" /> Setup incomplete</Badge>;
    case "unconnected":
      return <Badge variant="outline" className="text-[10px] text-muted-foreground">Not connected</Badge>;
    case "not_configured":
      return <Badge variant="outline" className="text-[10px] text-muted-foreground">Unavailable</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive gap-1"><AlertTriangle className="w-2.5 h-2.5" aria-hidden="true" /> Error</Badge>;
  }
}

const CHECKOUT_NOTE = "Client checkout through Stripe stays off until signed webhooks and payment tests are complete.";

function StateMessage({ state }: { state: ConnectState }) {
  const text = (() => {
    switch (state.kind) {
      case "not_configured": return "Stripe Connect isn't set up for this CloseSync deployment yet. No action is needed from you.";
      case "unconnected": return `You haven't connected a Stripe account. ${CHECKOUT_NOTE}`;
      case "incomplete": return `Your Stripe account is connected but setup isn't finished${
        !state.chargesEnabled ? " — Stripe hasn't enabled charges yet" : !state.payoutsEnabled ? " — Stripe hasn't enabled payouts yet" : ""
      }. Continue on Stripe to finish. ${CHECKOUT_NOTE}`;
      case "ready": return `Stripe reports your account can accept charges and receive payouts. ${CHECKOUT_NOTE}`;
      case "error": return state.message;
    }
  })();
  const Icon = state.kind === "error" ? AlertTriangle : Info;
  return (
    <p className={`text-xs leading-relaxed flex items-start gap-1.5 ${state.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}>
      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" /> {text}
    </p>
  );
}
