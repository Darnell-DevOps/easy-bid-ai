import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "https://avtogztwdoemxuffnwyv.supabase.co";
const USER_ID = "00000000-0000-4000-8000-000000000001";
const CONTRACT_ID = "00000000-0000-4000-8000-000000000002";
const user = {
  id: USER_ID, aud: "authenticated", role: "authenticated",
  email: "workflow-test@example.test", app_metadata: {}, user_metadata: {},
  identities: [], created_at: "2026-01-01T00:00:00Z",
};

async function mockContract(page: Page, initialStatus = "draft", rejectSave = false) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const session = {
    access_token: [encode({ alg: "HS256", typ: "JWT" }), encode({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, iat: exp - 60 }), "test-signature"].join("."),
    refresh_token: "test-refresh-token", expires_at: exp, expires_in: 3600, token_type: "bearer", user,
  };
  await page.addInitScript((value) => localStorage.setItem("sb-avtogztwdoemxuffnwyv-auth-token", JSON.stringify(value)), session);
  const contract = {
    id: CONTRACT_ID, user_id: USER_ID, client_id: null, proposal_id: null,
    contract_type: "service_agreement", title: "Workflow test agreement",
    client_name: "Test client", client_email: "client@example.test", company_name: null,
    body: "# Test agreement\n\nDelivery date: [TBD]", status: initialStatus,
    amount_cents: 150000, currency: "GBP", signing_token: "workflow-test-token",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    sent_at: null, viewed_at: null, signed_at: null,
  };
  const savedBodies: string[] = [];
  await page.route(`${ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let response: unknown = [];
    if (url.pathname === "/auth/v1/user") response = user;
    else if (url.pathname === "/auth/v1/token") response = session;
    else if (url.pathname === "/rest/v1/user_profiles") response = { onboarding_step: "completed", onboarding_completed_at: "2026-01-01T00:00:00Z" };
    else if (url.pathname === "/rest/v1/contracts") {
      if (request.method() === "PATCH") {
        expect(url.searchParams.get("id")).toBe(`eq.${CONTRACT_ID}`);
        expect(url.searchParams.get("status")).toBe("eq.draft");
        if (rejectSave) response = null;
        else {
          const body = request.postDataJSON() as { body: string };
          contract.body = body.body;
          savedBodies.push(body.body);
          response = { id: CONTRACT_ID };
        }
      } else response = contract;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response) });
  });
  return { savedBodies };
}

test("draft agreement edits save and survive a page reload", async ({ page }) => {
  const { savedBodies } = await mockContract(page);
  await page.goto(`/dashboard/contracts/${CONTRACT_ID}`);
  await page.getByRole("button", { name: "Edit draft", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit contract draft" });
  const body = dialog.getByRole("textbox", { name: "Agreement text (Markdown)" });
  await expect(body).toHaveValue(/\[TBD\]/);
  await body.fill("# Test agreement\n\nDelivery date: 30 September 2026");
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Delivery date: 30 September 2026", { exact: true })).toBeVisible();
  expect(savedBodies).toHaveLength(1);
  await page.reload();
  await expect(page.getByText("Delivery date: 30 September 2026", { exact: true })).toBeVisible();
});

test("a stale draft save keeps the edit dialog open and reports the failure", async ({ page }) => {
  await mockContract(page, "draft", true);
  await page.goto(`/dashboard/contracts/${CONTRACT_ID}`);
  await page.getByRole("button", { name: "Edit draft", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit contract draft" });
  await dialog.getByRole("textbox", { name: "Agreement text (Markdown)" }).fill("Revised draft");
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Couldn't save contract draft", { exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
});

test("sent agreements do not expose the draft editor", async ({ page }) => {
  await mockContract(page, "sent");
  await page.goto(`/dashboard/contracts/${CONTRACT_ID}`);
  await expect(page.getByRole("heading", { name: "Workflow test agreement", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit draft", exact: true })).toHaveCount(0);
});

test("the draft editor fits mobile and cancelling does not save changes", async ({ page }) => {
  const { savedBodies } = await mockContract(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/dashboard/contracts/${CONTRACT_ID}`);
  await page.getByRole("button", { name: "Edit draft", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit contract draft" });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await dialog.getByRole("textbox", { name: "Agreement text (Markdown)" }).fill("Uncommitted changes");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(savedBodies).toHaveLength(0);
});
