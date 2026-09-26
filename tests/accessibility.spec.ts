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
  await expect(page.getByRole("region", { name: "Business pulse" })).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  const overflowDetails = horizontalOverflow ? await page.evaluate(() => Array.from(document.querySelectorAll("body *")).filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1).map((element) => ({ tag: element.tagName, class: element.className, width: element.getBoundingClientRect().width })).slice(0, 15)) : [];
  expect(horizontalOverflow, JSON.stringify(overflowDetails)).toBe(false);
  await expectNoWcagViolations(page, "authenticated dashboard at 320px with WCAG text spacing");
});


test("dashboard navigation retains labelled links when collapsed and keeps footer visible", async ({ page }) => {
  await mockAuthenticatedSupabase(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Accessibility");
  const navigation = page.getByRole("navigation", { name: "Primary dashboard navigation" });
  const destinations = await navigation.getByRole("link").filter({ visible: true }).evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  await expect(navigation.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
  expect(await navigation.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual(destinations);
  await expect(navigation.getByRole("link", { name: "Clients", exact: true })).toBeVisible();
  await expectNoWcagViolations(page, "collapsed dashboard navigation");
  await navigation.getByRole("link", { name: "Clients", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/clients$/);
  await expect(navigation.getByRole("link", { name: "Clients", exact: true })).toHaveAttribute("aria-current", "page");
});

test("dashboard light theme and mobile menu remain accessible", async ({ page }) => {
  await mockAuthenticatedSupabase(page);
  await page.addInitScript(() => localStorage.setItem("closesync-theme", "light"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Accessibility");
  await expectNoWcagViolations(page, "light dashboard");
  await page.getByRole("button", { name: "Open dashboard navigation" }).click();
  const menu = page.getByRole("dialog", { name: "Dashboard navigation" });
  await expect(menu.getByRole("button", { name: "Account", exact: true })).toBeInViewport();
  await menu.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Log out", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu.getByRole("button", { name: "Account", exact: true })).toBeFocused();
  await page.screenshot({ path: ".impeccable/review/navigation-mobile.png" });
  await expectNoWcagViolations(page, "light mobile navigation");
  await menu.getByRole("link", { name: "Clients", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/clients$/);
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("dashboard populated overview preserves totals, stages and revenue navigation", async ({ page }) => {
  await mockAuthenticatedSupabase(page, [{
    id: "00000000-0000-4000-8000-000000000002", client_name: "Example Studio",
    budget: "2500", service_type: "Design", status: "accepted", client_paid: true,
    created_at: new Date().toISOString(), paid_at: new Date().toISOString(),
  }]);
  await page.goto("/dashboard");
  const pulse = page.getByRole("region", { name: "Business pulse" });
  await expect(pulse.getByRole("button", { name: "Revenue £2.5k" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Conversion pipeline" }).getByRole("button", { name: "1 Paid" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
  await page.screenshot({ path: ".impeccable/review/dashboard-populated.png", animations: "disabled" });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await pulse.getByRole("button", { name: "Revenue £2.5k" }).click();
  await expect(page).toHaveURL(/\/dashboard\/revenue$/);
});


test("dashboard reference layout reflows without clipping its panels", async ({ page }) => {
  await mockAuthenticatedSupabase(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Accessibility");
  await expect(page.getByText("No paid proposals in this period")).toBeVisible();
  for (const width of [1440, 1036, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const main = page.locator("#dashboard-main");
    expect(await main.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);
    await expect(page.getByRole("region", { name: "Revenue activity" })).toBeVisible();
    await page.screenshot({ path: ".impeccable/review/dashboard-reference-" + width + ".png", animations: "disabled" });
    const setupDescription = page.getByText("Start your pipeline with a real lead.");
    if (await setupDescription.count()) {
      expect(await setupDescription.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);
    }
    await page.locator(".cs-revenue-activity").scrollIntoViewIfNeeded();
    await page.screenshot({ path: ".impeccable/review/dashboard-reference-" + width + "-middle.png", animations: "disabled" });
    await main.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await page.screenshot({ path: ".impeccable/review/dashboard-reference-" + width + "-lower.png", animations: "disabled" });
    await main.evaluate((element) => { element.scrollTop = 0; });
  }
  await expectNoWcagViolations(page, "reference dashboard at 320px");
});


test("dashboard groups remember expansion and expose destinations in the collapsed rail", async ({ page }) => {
  await mockAuthenticatedSupabase(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard");
  const navigation = page.getByRole("navigation", { name: "Primary dashboard navigation" });
  const sales = navigation.getByRole("button", { name: "Sales", exact: true });
  await expect(sales).toHaveAttribute("aria-expanded", "false");
  await sales.focus();
  await page.keyboard.press("Enter");
  await expect(sales).toBeFocused();
  await expect(navigation.getByRole("link", { name: "Contracts", exact: true })).toBeVisible();
  await page.reload();
  await expect(sales).toHaveAttribute("aria-expanded", "true");
  await sales.click();
  await page.screenshot({ path: ".impeccable/review/navigation-desktop.png" });
  await page.goto("/dashboard/contracts");
  await expect(sales).toHaveAttribute("aria-expanded", "true");
  await expect(navigation.getByRole("link", { name: "Contracts", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await navigation.getByRole("button", { name: "Resources", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Templates" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Policies" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Testimonials" }).click();
  await expect(page).toHaveURL(/\/dashboard\/testimonials$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Trash", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Log out", exact: true })).toBeVisible();
});
