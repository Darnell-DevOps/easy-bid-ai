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

async function mockAuthenticatedSupabase(page: Page) {
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

    const headers = {
      "access-control-allow-origin": "*",
      "content-range": "*/0",
      "content-type": "application/json",
    };
    await route.fulfill({ status: 200, headers, body: request.method() === "HEAD" ? undefined : "[]" });
  });
}

for (const publicRoute of ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/sample"]) {
  test(`automated WCAG scan passes for ${publicRoute}`, async ({ page }) => {
    await page.goto(publicRoute);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("main")).toBeVisible();
    await expectNoWcagViolations(page, publicRoute);
  });
}

test("automated WCAG scan passes for the authenticated dashboard", async ({ page }) => {
  await mockAuthenticatedSupabase(page);
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Accessibility");
  await expect(page.getByRole("status", { name: "Checking your session" })).toHaveCount(0);
  await expectNoWcagViolations(page, "authenticated dashboard");
});

test("authenticated dashboard supports keyboard bypass and mobile navigation", async ({ page }) => {
  await mockAuthenticatedSupabase(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Accessibility");

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#dashboard-main")).toBeFocused();

  await page.setViewportSize({ width: 320, height: 800 });
  const menuButton = page.getByRole("button", { name: "Open dashboard navigation" });
  await menuButton.click();
  await expect(page.getByRole("dialog", { name: "Dashboard navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Dashboard navigation" })).toHaveCount(0);
  await expect(menuButton).toBeFocused();
});

test("authenticated dashboard reflows with WCAG text spacing", async ({ page }) => {
  await mockAuthenticatedSupabase(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Accessibility");

  await page.addStyleTag({
    content: `
      * {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p { margin-bottom: 2em !important; }
    `,
  });

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /lead/i }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Business pulse" })).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);
  await expectNoWcagViolations(page, "authenticated dashboard at 320px with WCAG text spacing");
});
