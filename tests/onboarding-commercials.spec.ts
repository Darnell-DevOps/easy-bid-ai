import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("first proposal uses the agreed price and preserves input after invalid generation", async ({ page }) => {
  const user = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "qa@example.invalid", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [] };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const session = { access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", role: "authenticated", exp: expires })}.test-signature`, refresh_token: "test-refresh", expires_at: expires, expires_in: 3600, token_type: "bearer", user };
  await page.addInitScript(value => localStorage.setItem("sb-avtogztwdoemxuffnwyv-auth-token", JSON.stringify(value)), session);
  const generations: Record<string, unknown>[] = [], saved: Record<string, unknown>[] = [];
  await page.route("https://avtogztwdoemxuffnwyv.supabase.co/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let body: unknown = [];
    if (path === "/auth/v1/user") body = user;
    if (path === "/auth/v1/token") body = session;
    if (path === "/rest/v1/business_branding") body = { default_currency: "GBP", default_tax_rate: 20, default_tax_mode: "exclusive" };
    if (path === "/rest/v1/user_profiles") body = { onboarding_step: "proposal", onboarding_completed_at: null, onboarding_skipped_at: null, onboarding_client_id: "client-test", onboarding_proposal_id: null };
    if (path === "/rest/v1/clients") body = { id: "client-test", name: "Test Studio", service_requested: "Design", project_description: "Agreed scope" };
    if (path === "/functions/v1/generate-proposal") {
      generations.push(request.postDataJSON());
      if (generations.length === 1) {
        await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "The generated document was incomplete. Please try again.", code: "invalid_ai_output", retryable: true }) });
        return;
      }
      body = { proposal: "Reviewed proposal draft", pricing: "Agreed pricing", invoice: "Draft invoice" };
    }
    if (path === "/rest/v1/proposals" && request.method() === "POST") {
      saved.push(request.postDataJSON());
      body = { ...saved.at(-1), id: "proposal-test" };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/onboarding");
  const generate = page.getByRole("button", { name: "Generate Proposal with AI" });
  await expect(generate).toBeDisabled();
  const price = page.getByLabel("Project price (GBP)");
  await price.fill("200");
  await generate.click();
  await expect(page.getByText("The generated document was incomplete. Please try again.", { exact: true })).toBeVisible();
  await expect(price).toHaveValue("200");
  expect(saved).toHaveLength(0);
  await page.getByRole("button", { name: "Close notification" }).click();
  await expect(page.getByText("The generated document was incomplete. Please try again.", { exact: true })).toBeHidden();
  await generate.click();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  expect(generations).toHaveLength(2);
  expect(generations[1]).toMatchObject({ amount_cents: 20000, subtotal_cents: 20000, tax_amount_cents: 4000, total_cents: 24000, currency: "GBP", tax_rate: 20, tax_mode: "exclusive" });
  expect(saved[0]).toMatchObject({ amount_cents: 20000, currency: "GBP", tax_rate: 20, tax_mode: "exclusive" });
  for (const derivedField of ["subtotal_cents", "tax_amount_cents", "total_cents"]) expect(saved[0]).not.toHaveProperty(derivedField);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
