import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plug, RefreshCw, ShieldOff, ExternalLink } from "lucide-react";

type Consent = {
  consent_id: string;
  client_id: string;
  client_name: string | null;
  client_uri: string | null;
  logo_uri: string | null;
  scopes: string | null;
  granted_at: string | null;
  active_sessions: number | null;
};

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ConnectedAppsSettings() {
  const { toast } = useToast();
  const [items, setItems] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Consent | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_my_oauth_consents");
    if (error) {
      toast({
        title: "Couldn't load connections",
        description: error.message,
        variant: "destructive",
      });
      setItems([]);
    } else {
      setItems((data as Consent[]) ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async () => {
    if (!pending) return;
    setRevoking(true);
    const { data, error } = await supabase.rpc("revoke_my_oauth_consent", {
      p_consent_id: pending.consent_id,
    });
    setRevoking(false);
    if (error) {
      toast({ title: "Revoke failed", description: error.message, variant: "destructive" });
      return;
    }
    const result = data as { revoked?: boolean; sessions_ended?: number } | null;
    if (result?.revoked) {
      toast({
        title: "Access revoked",
        description: `${pending.client_name ?? "That app"} can no longer access your account${
          result.sessions_ended ? ` — ${result.sessions_ended} active session(s) ended` : ""
        }.`,
      });
    } else {
      toast({ title: "Nothing to revoke", description: "That connection no longer exists." });
    }
    setPending(null);
    void load();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4" />
              Connected apps
            </CardTitle>
            <CardDescription>
              AI assistants and other tools you have authorised to access CloseSync AI as you. Revoking
              access signs that app out immediately.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="ml-2">Refresh</span>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading connections…
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium text-foreground">No connected apps</p>
              <p className="mt-1 text-sm text-muted-foreground">
                When you connect an assistant like Claude or ChatGPT to CloseSync AI, it will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.consent_id} className="flex flex-wrap items-center gap-4 py-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {item.logo_uri ? (
                      <img
                        src={item.logo_uri}
                        alt={`${item.client_name ?? "App"} logo`}
                        className="h-9 w-9 rounded-md object-contain"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                        <Plug className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.client_name ?? "Unknown app"}
                        </p>
                        {(item.active_sessions ?? 0) > 0 && (
                          <Badge variant="secondary">{item.active_sessions} active</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Connected {formatDate(item.granted_at)}
                        {item.scopes ? ` · ${item.scopes}` : ""}
                      </p>
                      {item.client_uri && (
                        <a
                          href={item.client_uri}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                        >
                          {item.client_uri}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setPending(item)}>
                    <ShieldOff className="h-4 w-4" />
                    <span className="ml-2">Revoke</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke access for {pending?.client_name ?? "this app"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This immediately ends every session that app holds and it will need your approval again
              before it can read or change anything in your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void revoke();
              }}
              disabled={revoking}
            >
              {revoking ? "Revoking…" : "Revoke access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
