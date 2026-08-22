import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { authCaptchaSiteKey } from "@/lib/auth-captcha";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  ready: (callback: () => void) => void;
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "auto";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileLoadPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileLoadPromise) return turnstileLoadPromise;

  turnstileLoadPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const onLoad = () => {
      if (!window.turnstile) {
        reject(new Error("Turnstile loaded without exposing its browser API."));
        return;
      }
      window.turnstile.ready(() => resolve(window.turnstile as TurnstileApi));
    };

    const onError = () => reject(new Error("Turnstile could not be loaded."));
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    turnstileLoadPromise = null;
    if (!window.turnstile) {
      document.getElementById(TURNSTILE_SCRIPT_ID)?.remove();
    }
    throw error;
  });

  return turnstileLoadPromise;
}

type VerificationState = "loading" | "ready" | "error";

export type AuthCaptchaHandle = {
  reset: () => void;
};

type AuthCaptchaProps = {
  action: "login" | "signup" | "password-reset";
  onTokenChange: (token: string | null) => void;
};

const AuthCaptcha = forwardRef<AuthCaptchaHandle, AuthCaptchaProps>(function AuthCaptcha(
  { action, onTokenChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenChange(null);
      setErrorMessage(null);
      setStatusMessage(null);
      setVerificationState("ready");
      if (widgetIdRef.current !== null) {
        window.turnstile?.reset(widgetIdRef.current);
      }
    },
  }), [onTokenChange]);

  useEffect(() => {
    if (!authCaptchaSiteKey || !containerRef.current) return;

    let cancelled = false;
    setVerificationState("loading");
    setErrorMessage(null);
    setStatusMessage(null);

    void loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: authCaptchaSiteKey,
          action,
          theme: "auto",
          callback: (token) => {
            if (cancelled) return;
            setVerificationState("ready");
            setErrorMessage(null);
            setStatusMessage(null);
            onTokenChange(token);
          },
          "error-callback": () => {
            if (cancelled) return;
            setVerificationState("error");
            setErrorMessage("Security verification failed. Retry it to continue.");
            setStatusMessage(null);
            onTokenChange(null);
          },
          "expired-callback": () => {
            if (cancelled) return;
            setVerificationState("ready");
            setErrorMessage(null);
            setStatusMessage("Security verification expired. Complete the check again to continue.");
            onTokenChange(null);
          },
          "timeout-callback": () => {
            if (cancelled) return;
            setVerificationState("error");
            setErrorMessage("Security verification timed out. Retry it to continue.");
            setStatusMessage(null);
            onTokenChange(null);
          },
        });
        setVerificationState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setVerificationState("error");
          setErrorMessage("Security verification could not load. Check your connection and retry.");
          setStatusMessage(null);
          onTokenChange(null);
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, attempt, onTokenChange]);

  useEffect(() => {
    if (verificationState === "error") {
      errorRef.current?.focus();
    }
  }, [verificationState]);

  const retryVerification = () => {
    onTokenChange(null);
    setVerificationState("loading");
    setErrorMessage(null);
    setStatusMessage(null);
    setAttempt((currentAttempt) => currentAttempt + 1);
  };

  if (!authCaptchaSiteKey) return null;

  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label="Security verification"
        aria-busy={verificationState === "loading"}
        className="space-y-2"
      >
        {verificationState === "loading" && (
          <p role="status" className="text-xs text-muted-foreground">
            Loading security verification…
          </p>
        )}
        <div ref={containerRef} className="min-h-[65px]" data-testid="auth-captcha" />
      </div>

      {verificationState === "error" && errorMessage && (
        <div
          ref={errorRef}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          tabIndex={-1}
          className="space-y-2 rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <p>{errorMessage}</p>
          <Button type="button" variant="outline" size="sm" onClick={retryVerification}>
            Retry security verification
          </Button>
        </div>
      )}

      {verificationState !== "error" && statusMessage && (
        <p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-muted-foreground">
          {statusMessage}
        </p>
      )}
    </div>
  );
});

export default AuthCaptcha;
