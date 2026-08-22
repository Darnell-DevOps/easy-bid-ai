import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import PageMeta from "@/components/PageMeta";

type AuthorizationDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setError(null);
      setDetails(null);
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error: detailsError } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detailsError) {
        setError(detailsError.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, loadAttempt]);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  async function decide(approve: boolean) {
    setError(null);
    setBusy(true);
    const { data, error: decisionError } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "this app";

  const retryLoading = () => {
    setError(null);
    setLoadAttempt((currentAttempt) => currentAttempt + 1);
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <PageMeta title="Authorize access | CloseSync AI" description="Approve or deny an app requesting access to your CloseSync AI account." path="/.lovable/oauth/consent" noIndex />
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 space-y-5" aria-busy={busy || (!error && !details)}>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            CloseSync AI authorization
          </div>

          {error && !details ? (
            <div
              ref={errorRef}
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              tabIndex={-1}
              className="space-y-3 rounded-lg border border-destructive/60 bg-destructive/10 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <h1 className="text-xl font-semibold text-foreground">Could not load this request</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              {authorizationId && (
                <Button type="button" variant="outline" onClick={retryLoading}>
                  Retry loading request
                </Button>
              )}
            </div>
          ) : !details ? (
            <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Loading authorization request…
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-foreground">
                Connect {clientName} to your account
              </h1>
              <p className="text-sm text-muted-foreground">
                {clientName} will be able to read and act on your CloseSync AI data — clients, leads,
                proposals and contracts — as you. You can revoke access at any time.
              </p>
              {error && (
                <div
                  ref={errorRef}
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                  tabIndex={-1}
                  className="rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Authorization decision failed. {error}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() => decide(true)}
                  aria-label={busy ? "Processing authorization decision" : "Approve access"}
                  aria-busy={busy}
                >
                  {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : "Approve"}
                </Button>
                <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                  Deny
                </Button>
              </div>
              <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {busy ? "Submitting authorization decision." : ""}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
