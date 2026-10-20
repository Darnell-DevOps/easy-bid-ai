import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const SUPABASE_ORIGIN = "https://avtogztwdoemxuffnwyv.supabase.co";
const AUTH_STORAGE_KEY = "sb-avtogztwdoemxuffnwyv-auth-token";

const testUser = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "accessibility@example.test",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  phone: "",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Accessibility Tester" },
  identities: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function base64Url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function testSession() {
  const expiresAt = Math.floor(Date.now() / 1_000) + 60 * 60;
  const accessToken = [
    base64Url({ alg: "HS256", typ: "JWT" }),
    base64Url({
      aud: "authenticated",
      exp: expiresAt,
      iat: expiresAt - 60,
      role: "authenticated",
      sub: testUser.id,
      email: testUser.email,
    }),
    "test-signature",
  ].join(".");

  return {
    access_token: accessToken,
    refresh_token: "test-refresh-token",
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: "bearer",
    user: testUser,
  };
}

async function expectNoWcagViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));

  expect(violations, `${context} should have no automatically detectable WCAG A/AA violations`).toEqual([]);
}

async function mockAuthenticatedSupabase(page: Page, proposals: Record<string, unknown>[] = []) {
  const session = testSession();
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: AUTH_STORAGE_KEY, value: session },
  );

  await page.route(`${SUPABASE_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(testUser) });
      return;
    }

    if (url.pathname === "/auth/v1/token") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
      return;
    }

    if (url.pathname === "/rest/v1/user_profiles") {
      const select = url.searchParams.get("select") || "";
      const body = select.includes("onboarding_")
        ? {
            onboarding_step: "completed",
            onboarding_completed_at: "2026-01-01T00:00:00.000Z",
            onboarding_skipped_at: null,
            onboarding_client_id: null,
            onboarding_proposal_id: null,
          }
        : { first_name: "Accessibility", last_name: "Tester", business_name: "Test Studio" };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      return;
    }

    if (url.pathname === "/rest/v1/proposals") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(proposals) });
      return;
    }

    const headers = {
      "access-control-allow-origin": "*",
      "content-range": "*/0",
      "content-type": "application/json",
    };
    await route.fulfill({ status: 200, headers, body: request.method() === "HEAD" ? undefined : "[]" });
  });
}


const workspaceRoutes = ["clients","lead-inbox","calendar","emails","leads","lead-forms","proposals","contracts","client-portal","onboarding","kickoff","revenue","retainers","recovery","templates","policies","testimonials","settings","trash","billing","time-saved","clients/new","new","policies/new","retainers/new"];
for (const route of workspaceRoutes) {
 test('workspace consistency: '+route, async ({page}) => {
  await mockAuthenticatedSupabase(page);
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/dashboard/'+route);
  const heading=page.locator('main h1').first();
  await expect(heading).toBeVisible();
  await expect(heading).toHaveClass(/cs-workspace-page-title/);
  await expect(heading).toHaveCSS('font-size','28px');
  await page.screenshot({path:'.impeccable/review/consistency-'+route.replaceAll('/','-')+'-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await expect(heading).toHaveCSS('font-size','22px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),route+' must not overflow').toBe(false);
  await page.screenshot({path:'.impeccable/review/consistency-'+route.replaceAll('/','-')+'-mobile.png'});
 });
}

for (const route of ['lead-inbox','calendar','settings']) {
 test('workspace light and narrow: '+route, async ({page}) => {
  await mockAuthenticatedSupabase(page);
  await page.addInitScript(()=>localStorage.setItem('closesync-theme','light'));
  await page.setViewportSize({width:320,height:844});
  await page.goto('/dashboard/'+route);
  await expect(page.locator('main h1').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
  await expectNoWcagViolations(page,route+' light narrow layout');
 });
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`Stripe onboarding failure preserves country and supports retry at ${viewport.width}px`, async ({ page }) => {
    await mockAuthenticatedSupabase(page);
    const attempts: Record<string, unknown>[] = [];
    const reference = `req_${"a".repeat(60)}`;
    await page.route(`${SUPABASE_ORIGIN}/functions/v1/stripe-connect-account`, async (route) => {
      const body = route.request().postDataJSON();
      if (body.action === "status") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          configured: true, connected: false, environment: "test",
        }) });
        return;
      }
      attempts.push(body);
      await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({
        code: "stripe_connect_setup_required", requestId: reference,
        error: "Private provider response must never reach the screen",
      }) });
    });
    await page.setViewportSize(viewport);
    await page.goto("/dashboard/settings#integrations");
    const card = page.locator("[data-cs-card]").filter({ has: page.getByRole("heading", { name: "Stripe Connect", exact: true }) });
    await expect(card.getByText("Not connected", { exact: true })).toBeVisible();
    await card.getByLabel("Legal business country").selectOption("GB");
    await card.getByRole("button", { name: "Connect with Stripe" }).click();
    await expect(card.getByRole("alert")).toContainText("isn't enabled for CloseSync's Stripe account");
    await expect(card.getByRole("alert")).toContainText(reference);
    await expect(card.getByRole("alert")).not.toContainText("Private provider");
    await expect(card.getByLabel("Legal business country")).toHaveValue("GB");
    await expect(card.getByLabel("Legal business country")).not.toHaveAttribute("aria-invalid");
    await expect(card.getByRole("button", { name: "Connect with Stripe" })).toBeEnabled();
    await card.getByRole("button", { name: "Connect with Stripe" }).click();
    await expect.poll(() => attempts.length).toBe(2);
    expect(attempts).toEqual([{ action: "onboard", country: "GB" }, { action: "onboard", country: "GB" }]);
    await expect(page).toHaveURL(/\/dashboard\/settings#integrations$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    const accessibility = await new AxeBuilder({ page }).include("[data-cs-card][aria-labelledby]").withTags(WCAG_TAGS).analyze();
    expect(accessibility.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
    await card.screenshot({ path: `.impeccable/review/stripe-onboarding-error-${viewport.width}.png` });
  });
}
