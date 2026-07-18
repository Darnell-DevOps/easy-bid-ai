/**
 * End-to-end coverage for the contract signing workflow:
 *   1. Owner seeds a contract via the authenticated REST API.
 *   2. Client opens the public /sign/:token URL and signs (typed).
 *   3. Owner opens the dashboard contract page and countersigns.
 *   4. The contract becomes "executed" and the executed PDF is downloadable
 *      from both the owner dashboard and the client's signed-confirmation view.
 *
 * Required env vars (skipped otherwise):
 *   TEST_USER_EMAIL   – a real auth user in the project
 *   TEST_USER_PASSWORD
 */
import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * The executed PDF is produced client-side via html2pdf.js, which rasterises
 * the DOM through html2canvas before handing it to jsPDF. The resulting PDF
 * therefore has no selectable text layer — its pages are JPEGs. To assert on
 * the rendered content we have to OCR the pages with tesseract.
 *
 * Requires `pdftoppm` (poppler) and `tesseract` on PATH; the assertions are
 * skipped (not failed) when those binaries are missing so the test still
 * exercises the download flow in minimal environments.
 */
function hasBinary(bin: string): boolean {
  const locator = process.platform === "win32" ? "where" : "which";
  const res = spawnSync(locator, [bin], { encoding: "utf8" });
  return res.status === 0 && res.stdout.trim().length > 0;
}

function ocrPdf(pdfPath: string): string {
  const workDir = mkdtempSync(path.join(tmpdir(), "contract-pdf-ocr-"));
  // Rasterise the PDF to 200dpi PNGs.
  execFileSync("pdftoppm", ["-r", "200", "-png", pdfPath, path.join(workDir, "page")], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const pages = readdirSync(workDir)
    .filter((f) => f.endsWith(".png"))
    .sort();
  let text = "";
  for (const png of pages) {
    const out = path.join(workDir, png.replace(/\.png$/, ""));
    execFileSync("tesseract", [path.join(workDir, png), out, "-l", "eng", "--psm", "6"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    text += readFileSync(`${out}.txt`, "utf8") + "\n";
  }
  return text;
}

const SUPABASE_URL = "https://avtogztwdoemxuffnwyv.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2dG9nenR3ZG9lbXh1ZmZud3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjMzOTIsImV4cCI6MjA5MTI5OTM5Mn0.YzBeN1hJwep-3enRTATohXbuBC0OoEMVv0KC6yRmhnw";
const STORAGE_KEY = "sb-avtogztwdoemxuffnwyv-auth-token";

const EMAIL = process.env.TEST_USER_EMAIL;
const PASSWORD = process.env.TEST_USER_PASSWORD;

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: { id: string; email: string };
};

async function signIn(api: APIRequestContext): Promise<AuthSession> {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), `Sign-in failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

async function seedContract(api: APIRequestContext, session: AuthSession) {
  const token = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const body = {
    user_id: session.user.id,
    contract_type: "web_design_agreement",
    title: "E2E Sign Flow Contract",
    client_name: "E2E Test Client",
    client_email: "e2e-client@example.com",
    body:
      "This Agreement is between the Service Provider and the Client.\n\n" +
      "Scope: end-to-end signing flow smoke test.\n\nSignatures below.",
    status: "sent",
    signing_token: token,
    currency: "USD",
    amount_cents: 100000,
  };
  const res = await api.post(`${SUPABASE_URL}/rest/v1/contracts`, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    data: body,
  });
  expect(res.ok(), `Seed contract failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const rows = await res.json();
  return rows[0] as { id: string; signing_token: string; user_id: string };
}

async function deleteContract(api: APIRequestContext, session: AuthSession, id: string) {
  await api.delete(`${SUPABASE_URL}/rest/v1/contracts?id=eq.${id}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}` },
  });
}

async function attachOwnerSession(ctx: BrowserContext, session: AuthSession, baseURL: string) {
  const page = await ctx.newPage();
  await page.goto(baseURL);
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [STORAGE_KEY, JSON.stringify(session)] as const,
  );
  await page.close();
}

test.describe("Contract sign → countersign → executed PDF", () => {
  test.skip(!EMAIL || !PASSWORD, "Set TEST_USER_EMAIL / TEST_USER_PASSWORD to run this E2E.");
  test.setTimeout(120_000);

  test("full flow", async ({ browser, playwright, baseURL }) => {
    const api = await playwright.request.newContext();
    const session = await signIn(api);
    const contract = await seedContract(api, session);

    try {
      // ---- 1. Client signs via the public /sign/:token page ----
      const clientCtx = await browser.newContext();
      const clientPage = await clientCtx.newPage();
      await clientPage.goto(`${baseURL}/sign/${contract.signing_token}`);

      await expect(clientPage.getByText("E2E Sign Flow Contract", { exact: false })).toBeVisible();

      // Name is pre-filled from contract.client_name; just confirm it's there.
      const nameInput = clientPage.getByPlaceholder("Jane Smith");
      await expect(nameInput).toHaveValue(/E2E Test Client/);

      // "Type signature" tab is selected by default.
      await clientPage.getByRole("checkbox").first().check();
      await clientPage.getByRole("button", { name: /Sign Contract/i }).click();

      // Post-sign UI: awaiting countersignature copy + signed badge.
      await expect(clientPage.getByText(/awaiting countersignature/i)).toBeVisible({ timeout: 15_000 });
      await clientCtx.close();

      // ---- 2. Owner countersigns from dashboard ----
      const ownerCtx = await browser.newContext();
      await attachOwnerSession(ownerCtx, session, baseURL!);
      const ownerPage = await ownerCtx.newPage();
      await ownerPage.goto(`${baseURL}/dashboard/contracts/${contract.id}`);

      await expect(ownerPage.getByRole("button", { name: /Countersign contract/i })).toBeVisible({
        timeout: 15_000,
      });
      await ownerPage.getByRole("button", { name: /Countersign contract/i }).first().click();

      const dialog = ownerPage.getByRole("dialog");
      await expect(dialog.getByText("Countersign contract")).toBeVisible();
      await dialog.getByPlaceholder("Your name").fill("E2E Test Provider");
      await dialog.getByRole("button", { name: /Countersign & execute/i }).click();

      // ---- 3. Verify executed state on owner dashboard ----
      await expect(ownerPage.getByRole("button", { name: /Download Executed PDF/i })).toBeVisible({
        timeout: 15_000,
      });
      await expect(ownerPage.getByRole("button", { name: /Countersign contract/i })).toHaveCount(0);

      // Capture the actual PDF file produced by html2pdf.js.
      const [ownerDownload] = await Promise.all([
        ownerPage.waitForEvent("download", { timeout: 30_000 }),
        ownerPage.getByRole("button", { name: /Download Executed PDF/i }).click(),
      ]);
      const ownerPdfPath = path.join(
        mkdtempSync(path.join(tmpdir(), "contract-pdf-owner-")),
        ownerDownload.suggestedFilename() || "owner.pdf",
      );
      await ownerDownload.saveAs(ownerPdfPath);
      expect(readFileSync(ownerPdfPath).slice(0, 4).toString("utf8")).toBe("%PDF");

      // ---- 4. Verify client side now also sees the executed state + PDF button ----
      const clientCtx2 = await browser.newContext();
      const clientPage2 = await clientCtx2.newPage();
      await clientPage2.goto(`${baseURL}/sign/${contract.signing_token}`);
      const clientDownloadBtn = clientPage2.getByRole("button", { name: /Download Executed PDF/i });
      await expect(clientDownloadBtn).toBeVisible({ timeout: 15_000 });

      const [clientDownload] = await Promise.all([
        clientPage2.waitForEvent("download", { timeout: 30_000 }),
        clientDownloadBtn.click(),
      ]);
      const clientPdfPath = path.join(
        mkdtempSync(path.join(tmpdir(), "contract-pdf-client-")),
        clientDownload.suggestedFilename() || "client.pdf",
      );
      await clientDownload.saveAs(clientPdfPath);
      expect(readFileSync(clientPdfPath).slice(0, 4).toString("utf8")).toBe("%PDF");

      await clientCtx2.close();
      await ownerCtx.close();

      // ---- 5. OCR both PDFs and assert both signatures + the EXECUTED pill ----
      test.skip(
        !hasBinary("pdftoppm") || !hasBinary("tesseract"),
        "pdftoppm and tesseract are required to OCR the executed PDF.",
      );

      for (const [label, pdf] of [
        ["owner", ownerPdfPath],
        ["client", clientPdfPath],
      ] as const) {
        const ocrText = ocrPdf(pdf).replace(/\s+/g, " ");
        // Tesseract output is noisy; use case-insensitive substring checks.
        const lower = ocrText.toLowerCase();
        expect(lower, `${label} PDF should contain the client signer name`).toContain(
          "e2e test client",
        );
        expect(lower, `${label} PDF should contain the provider signer name`).toContain(
          "e2e test provider",
        );
        expect(lower, `${label} PDF should contain the EXECUTED pill`).toContain("executed");
      }
    } finally {
      await deleteContract(api, session, contract.id);
      await api.dispose();
    }
  });
});
