import { expect, test } from "@playwright/test";

const RPC_PATTERN = "**/rest/v1/rpc/**";

test.beforeEach(async ({ page }) => {
  await page.route(
    RPC_PATTERN,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    },
  );
});

test("landing page links to a usable login form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Run your entire client business/i })).toBeVisible();

  await page.getByRole("link", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Sign in to your account")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("invalid public document links fail closed", async ({ page }) => {
  await page.goto("/proposal/view/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { name: "Proposal not found" })).toBeVisible();
  await expect(page.getByText(/invalid or the proposal has been removed/i)).toBeVisible();

  await page.goto("/sign/not-a-real-signing-token");
  await expect(page.getByRole("heading", { name: "Contract not found" })).toBeVisible();
  await expect(page.getByText(/invalid or expired/i)).toBeVisible();
});
