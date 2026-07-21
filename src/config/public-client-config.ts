type PublicClientEnvironment = {
  VITE_SUPABASE_PROJECT_ID?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_PAYMENTS_CLIENT_TOKEN?: string;
};

// These identifiers and client tokens are intentionally public: Vite embeds them
// in the browser bundle. Authorization remains enforced by Supabase RLS and the
// server-side Paddle/Edge Function secrets.
const PUBLIC_DEFAULTS = {
  supabaseProjectId: "avtogztwdoemxuffnwyv",
  supabaseUrl: "https://avtogztwdoemxuffnwyv.supabase.co",
  supabasePublishableKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2dG9nenR3ZG9lbXh1ZmZud3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjMzOTIsImV4cCI6MjA5MTI5OTM5Mn0.YzBeN1hJwep-3enRTATohXbuBC0OoEMVv0KC6yRmhnw",
} as const;

const DEFAULT_PAYMENTS_CLIENT_TOKEN = import.meta.env.MODE === "production"
  ? "live_be22f02bf72bb9acdd082bb66a7"
  : "test_be90c4414520f4305681834c583";

function configuredValue(value: string | undefined, fallback: string) {
  return value === undefined ? fallback : value;
}

export function resolvePublicClientConfig(
  environment: PublicClientEnvironment,
  paymentsClientTokenFallback: string,
) {
  return Object.freeze({
    supabaseProjectId: configuredValue(
      environment.VITE_SUPABASE_PROJECT_ID,
      PUBLIC_DEFAULTS.supabaseProjectId,
    ),
    supabaseUrl: configuredValue(
      environment.VITE_SUPABASE_URL,
      PUBLIC_DEFAULTS.supabaseUrl,
    ),
    supabasePublishableKey: configuredValue(
      environment.VITE_SUPABASE_PUBLISHABLE_KEY,
      PUBLIC_DEFAULTS.supabasePublishableKey,
    ),
    paymentsClientToken: configuredValue(
      environment.VITE_PAYMENTS_CLIENT_TOKEN,
      paymentsClientTokenFallback,
    ),
  });
}

export const publicClientConfig = resolvePublicClientConfig(
  import.meta.env,
  DEFAULT_PAYMENTS_CLIENT_TOKEN,
);
