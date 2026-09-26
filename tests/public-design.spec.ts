import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const pages = [
  { path: "/", name: "landing", heading: "From first enquiry to signed, paid and ready to start." },
  { path: "/login", name: "login", heading: "Sign in to CloseSync AI" },
  { path: "/signup", name: "signup", heading: "Create account" },
  { path: "/forgot-password", name: "forgot-password", heading: "Reset your CloseSync AI password" },
  { path: "/reset-password", name: "reset-password", heading: "Set a new password" },
  { path: "/terms", name: "terms", heading: "Terms of Service" },
  { path: "/privacy", name: "privacy", heading: "Privacy Policy" },
];

for (const surface of pages) {
  test(`${surface.name} keeps readable public layouts and accessible controls`, async ({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(surface.path);
    await expect(page.getByRole("heading", { level: 1, name: surface.heading, exact: true })).toBeVisible();
    const output = resolve(".impeccable/review");
    await mkdir(output, { recursive: true });

    for (const width of [1440, 877, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${surface.path} at ${width}px`).toBe(true);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (width === 1440 || width === 390 || (width === 877 && surface.name === "landing")) {
        await page.screenshot({ path: resolve(output, `${surface.name}-${width}.png`), fullPage: true, animations: "disabled" });
      }
    }

    const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(accessibility.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
    expect(failures).toEqual([]);
  });
}

test("legal documents are reachable, labelled as drafts, and support section navigation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Legal information" }).getByRole("link", { name: "Terms of Service" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByText("Design preview — policy wording pending")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Your account" }).click();
  await expect(page).toHaveURL(/#terms-account$/);
  await expect(page.getByRole("heading", { name: "Your account", exact: true })).toBeInViewport();
  await page.getByRole("navigation", { name: "Legal information" }).getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy Policy", exact: true })).toBeVisible();
  await expect(page.getByText("Design preview — policy wording pending")).toBeVisible();
});

test("authentication retains entered values and password visibility through mobile reflow", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Design Preview");
  await page.getByLabel("Email", { exact: true }).fill("preview@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Preview-password-123!");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Design Preview");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("preview@example.test");
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("Preview-password-123!");
  await page.getByRole("link", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Forgot password?", exact: true }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});

for (const path of ["/login", "/signup", "/forgot-password", "/reset-password"]) {
  test(`saved light theme remains accessible on ${path}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("closesync-theme", "light"));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await expect(page.locator("html")).toHaveClass(/light/);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
    await page.screenshot({ path: resolve(`.impeccable/review/${path.slice(1)}-light.png`), fullPage: true, animations: "disabled" });
  });
}


test("recovery confirmation stays readable for long email addresses on mobile", async ({ page }) => {
  await page.route("**/auth/v1/recover**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "{}",
  }));
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/forgot-password");
  const email = "a".repeat(64) + "@example.test";
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(email);
  await expect(page.getByRole("status")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.map(({ id }) => id)).toEqual([]);
  await mkdir(resolve(".impeccable/review"), { recursive: true });
  await page.screenshot({ path: resolve(".impeccable/review/recovery-confirmation-320.png"), fullPage: true });
});


for (const theme of ["dark", "light"]) {
  test(`public authentication matches the landing palette with a saved ${theme} theme`, async ({ page }) => {
    await page.addInitScript((savedTheme) => localStorage.setItem("closesync-theme", savedTheme), theme);
    await page.goto("/");
    const landingStyle = await page.locator(".landing-concept").evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, foreground: style.color, font: style.fontFamily };
    });
    for (const path of ["/login", "/signup"]) {
      await page.goto(path);
      await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
      const authStyle = await page.locator(".cs-auth-shell").evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, foreground: style.color, font: style.fontFamily };
      });
      expect(authStyle).toEqual(landingStyle);
      expect(await page.evaluate(() => localStorage.getItem("closesync-theme"))).toBe(theme);
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    }
  });
}
