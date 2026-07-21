import { describe, expect, it } from "vitest";
import { resolvePublicClientConfig } from "@/config/public-client-config";

describe("public client configuration", () => {
  it("preserves the existing development and production defaults", () => {
    const development = resolvePublicClientConfig({}, "test_default");
    const production = resolvePublicClientConfig({}, "live_default");

    expect(development.supabaseUrl).toBe("https://avtogztwdoemxuffnwyv.supabase.co");
    expect(development.paymentsClientToken).toBe("test_default");
    expect(production.paymentsClientToken).toBe("live_default");
  });

  it("prefers configured Vite values", () => {
    const config = resolvePublicClientConfig(
      {
        VITE_SUPABASE_PROJECT_ID: "project-override",
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "public-key-override",
        VITE_PAYMENTS_CLIENT_TOKEN: "test_token_override",
      },
      "live_default",
    );

    expect(config).toEqual({
      supabaseProjectId: "project-override",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "public-key-override",
      paymentsClientToken: "test_token_override",
    });
  });

  it("preserves an explicitly blank override", () => {
    const config = resolvePublicClientConfig(
      { VITE_PAYMENTS_CLIENT_TOKEN: "" },
      "test_default",
    );

    expect(config.paymentsClientToken).toBe("");
  });
});
