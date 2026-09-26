import { expect, test, type Page } from "@playwright/test";

const RPC_PATTERN = "**/rest/v1/rpc/**";

async function findLowContrastLandingText(page: Page) {
  return page.locator(".landing-shell").evaluate((root) => {
    const colorParts = (color: string) => {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
    };
    const luminance = (rgb: number[]) => {
      const values = rgb
        .map((value) => value / 255)
        .map((value) => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    };
    const contrast = (first: number[], second: number[]) => {
      const firstLuminance = luminance(first);
      const secondLuminance = luminance(second);
      return (Math.max(firstLuminance, secondLuminance) + 0.05)
        / (Math.min(firstLuminance, secondLuminance) + 0.05);
    };
    const background = (element: Element) => {
      let current: Element | null = element;
      while (current) {
        const color = getComputedStyle(current).backgroundColor;
        const parsed = colorParts(color);
        const values = color.match(/[\d.]+/g) || [];
        if (parsed && (values.length < 4 || Number(values[3]) > 0)) return parsed;
        current = current.parentElement;
      }
      return [255, 255, 255];
    };

    const textElements = new Set<Element>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.textContent?.trim() && node.parentElement) textElements.add(node.parentElement);
      node = walker.nextNode();
    }

    return [...textElements].flatMap((element) => {
      if (element.closest('[aria-hidden="true"]')) return [];
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.visibility === "hidden" || style.display === "none" || (rect.width === 0 && rect.height === 0)) return [];
      const foreground = colorParts(style.color);
      if (!foreground) return [];
      const ratio = contrast(foreground, background(element));
      const size = Number(style.fontSize.replace("px", ""));
      const weight = Number(style.fontWeight) || 400;
      const threshold = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
      if (ratio >= threshold) return [];
      return [{ text: element.textContent?.trim().slice(0, 80), ratio: Number(ratio.toFixed(2)), threshold }];
    });
  });
}

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
  await expect(page).toHaveTitle("CloseSync - Client operations, in one place");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#landing-main")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Notifications (F8)" })).toHaveCount(1);
  await expect(page.locator('[aria-label="Notifications alt+T"]')).toHaveCount(0);

  await expect(page.getByRole("heading", {
    level: 1,
    name: "From first enquiry to signed, paid and ready to start.",
  })).toBeVisible();

  const workflow = page.getByRole("region", { name: "BrightStone website redesign" });
  await expect(workflow).toBeVisible();
  const stages = workflow.getByRole("list", { name: "Client workflow stages" });
  await expect(stages.getByRole("listitem")).toHaveCount(7);
  await expect(stages.locator('[aria-current="step"]')).toContainText("Proposal");
  await expect(stages.locator('[aria-current="step"]')).toContainText("Active stage");
  await expect(workflow.getByRole("region", { name: "Proposal sent" })).toContainText("Awaiting decision");
  await expect(page.locator('.concept-toolbar')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  const focusIndicator = await skipLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: Number(style.outlineWidth.replace("px", "")), style: style.outlineStyle };
  });
  expect(focusIndicator.style).toBe("solid");
  expect(focusIndicator.width).toBeGreaterThanOrEqual(3);
  await page.keyboard.press("Enter");
  await expect(page.locator("#landing-main")).toBeFocused();

  await expect(page.locator("a button, button a")).toHaveCount(0);
  expect(await findLowContrastLandingText(page)).toEqual([]);

  await page.setViewportSize({ width: 320, height: 800 });
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.getByRole("banner").getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle("Sign in | CloseSync AI");
  await expect(page.getByText("Sign in to your account")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to CloseSync AI" })).toBeFocused();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("forced colours preserve keyboard focus and brand text", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/login");

  const googleButton = page.getByRole("button", { name: "Continue with Google" });
  await googleButton.focus();
  const focusIndicator = await googleButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      style: style.outlineStyle,
      width: Number(style.outlineWidth.replace("px", "")),
      shadow: style.boxShadow,
    };
  });
  expect(focusIndicator.style).toBe("solid");
  expect(focusIndicator.width).toBeGreaterThanOrEqual(2);
  expect(focusIndicator.shadow).toBe("none");

  const brandText = page.getByRole("link", { name: "CloseSync AI home" }).locator(".cs-auth-brand-accent");
  await expect(brandText).toHaveText("Sync");
  const textPresentation = await brandText.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundImage: style.backgroundImage,
      color: style.color,
      textFillColor: style.webkitTextFillColor,
    };
  });
  expect(textPresentation.backgroundImage).toBe("none");
  expect(textPresentation.color).not.toBe("rgba(0, 0, 0, 0)");
  expect(textPresentation.textFillColor).not.toBe("rgba(0, 0, 0, 0)");
});

test("public authentication pages expose accessible form semantics", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to CloseSync AI" })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password");

  await page.goto("/login?expired=1");
  await expect(page.getByRole("status")).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText("Your session expired");
  await expect(
    page.getByRole("region", { name: "Notifications (F8)" }).getByRole("status"),
  ).toHaveCount(0);

  await page.goto("/signup");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Create account" })).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveAttribute("autocomplete", "name");
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "aria-describedby",
    "signup-password-requirements",
  );

  const showPasswordBox = await page.getByRole("button", { name: "Show password" }).boundingBox();
  expect(showPasswordBox).not.toBeNull();
  expect(showPasswordBox!.width).toBeGreaterThanOrEqual(24);
  expect(showPasswordBox!.height).toBeGreaterThanOrEqual(24);

  await page.goto("/forgot-password");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Reset your CloseSync AI password" })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("autocomplete", "email");

  await page.goto("/reset-password");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Set a new password" })).toBeVisible();
  const invalidResetAlert = page.getByRole("alert");
  await expect(invalidResetAlert).toContainText("This password reset link is invalid or has expired");
  await expect(invalidResetAlert).toBeFocused();
  await page.getByRole("link", { name: "Request a new reset link", exact: true }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of ["/login", "/signup", "/forgot-password", "/reset-password"]) {
    await page.goto(path);
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow, `${path} should not overflow horizontally`).toBe(false);
  }
});

test("authentication failures remain visible and move focus to an error summary", async ({ page }) => {
  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ message: "Invalid login credentials" }),
    });
  });
  await page.route("**/auth/v1/signup**", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ message: "Email rate limit exceeded" }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("person@example.com");
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  const loginAlert = page.getByRole("alert");
  await expect(loginAlert).toContainText("Sign-in failed. Invalid login credentials");
  await expect(loginAlert).toBeFocused();
  await expect(page.locator("form")).toHaveAttribute("aria-describedby", "login-auth-error");

  await page.goto("/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Alex Morgan");
  await page.getByLabel("Email", { exact: true }).fill("alex@example.com");
  await page.getByLabel("Password", { exact: true }).fill("secure-pass-123");
  await page.getByRole("button", { name: "Create account" }).click();

  const signupAlert = page.getByRole("alert");
  await expect(signupAlert).toContainText("Account creation failed. Email rate limit exceeded");
  await expect(signupAlert).toBeFocused();
  await expect(page.locator("form")).toHaveAttribute("aria-describedby", "signup-auth-error");
});

test("password reset requests announce persistent success and failure states", async ({ page }) => {
  let shouldFail = false;
  await page.route("**/auth/v1/recover**", async (route) => {
    await route.fulfill({
      status: shouldFail ? 429 : 200,
      contentType: "application/json",
      body: JSON.stringify(shouldFail ? { message: "Too many reset attempts" } : {}),
    });
  });

  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("person@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  const success = page.getByRole("status");
  await expect(success).toContainText("If an account exists for person@example.com");
  await expect(success).toBeFocused();

  shouldFail = true;
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("person@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  const failure = page.getByRole("alert");
  await expect(failure).toContainText("Reset request failed. Too many reset attempts");
  await expect(failure).toBeFocused();
  await expect(page.locator("form")).toHaveAttribute("aria-describedby", "forgot-password-error");
});

test("public booking form exposes labelled customer fields and calendar controls", async ({ page }) => {
  await page.route("**/rest/v1/rpc/public_get_booking_link_by_slug", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "00000000-0000-0000-0000-000000000001",
          user_id: "00000000-0000-0000-0000-000000000002",
          slug: "accessibility-demo",
          name: "Accessibility review call",
          description: "A test booking link.",
          duration_minutes: 30,
          location_type: "phone",
          custom_location: null,
          meeting_url: null,
          available_days: [0, 1, 2, 3, 4, 5, 6],
          start_time: "09:00",
          end_time: "17:00",
          is_active: true,
        },
      ]),
    });
  });
  await page.route("**/rest/v1/availability_settings**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/book/accessibility-demo");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Accessibility review call" })).toBeVisible();

  let selectableDates = page.locator('button[aria-pressed]:not([disabled])');
  if ((await selectableDates.count()) < 2) {
    await page.getByRole("button", { name: "Show next month" }).click();
    selectableDates = page.locator('button[aria-pressed]:not([disabled])');
    await selectableDates.first().click();
  } else {
    await selectableDates.nth(1).click();
  }

  await page.getByRole("button", { name: /Select .* booking time/i }).first().click();
  await page.getByRole("button", { name: /Confirm .* booking time/i }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Your booking details" })).toBeAttached();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveAttribute("autocomplete", "name");
  await expect(page.getByLabel("Your name", { exact: true })).toHaveAttribute("required", "");
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("required", "");
  await expect(page.getByLabel("Message (optional)", { exact: true })).toBeVisible();
});

test("contract signing provides typed and drawn signature accessibility", async ({ page }) => {
  await page.route("**/rest/v1/rpc/public_get_contract_by_token", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "00000000-0000-0000-0000-000000000003",
          user_id: "00000000-0000-0000-0000-000000000004",
          proposal_id: null,
          contract_type: "service_agreement",
          title: "Accessible service agreement",
          client_name: "Example Client",
          client_email: "client@example.com",
          company_name: null,
          body: "Service agreement terms for accessibility testing.",
          status: "sent",
          signing_token: "accessible-signing-token",
          signed_at: null,
          amount_cents: null,
          currency: "GBP",
        },
      ]),
    });
  });

  await page.goto("/sign/accessible-signing-token");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Accessible service agreement" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Full legal name/i })).toHaveAttribute("autocomplete", "name");
  await expect(page.getByRole("textbox", { name: "Email" })).toHaveAttribute("autocomplete", "email");
  await expect(page.getByRole("tablist", { name: "Signature method" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Typed signature preview/i })).toBeVisible();

  const agreementBox = await page.getByRole("checkbox").boundingBox();
  expect(agreementBox).not.toBeNull();
  expect(agreementBox!.width).toBeGreaterThanOrEqual(24);
  expect(agreementBox!.height).toBeGreaterThanOrEqual(24);

  await page.getByRole("tab", { name: "Draw signature" }).click();
  await expect(page.getByRole("img", { name: "Empty signature drawing area" })).toBeVisible();
  await expect(page.getByText(/Keyboard and screen-reader users can select Type signature instead/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear drawn signature" })).toBeDisabled();
});

test("public lead forms expose labelled dynamic fields and upload controls", async ({ page }) => {
  await page.route("**/rest/v1/rpc/public_get_lead_form_by_slug", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "00000000-0000-0000-0000-000000000005",
          user_id: "00000000-0000-0000-0000-000000000006",
          slug: "accessible-lead-form",
          title: "Tell us about your project",
          description: "A test lead form.",
          fields: [
            {
              id: "name",
              label: "Full name",
              type: "short_text",
              required: true,
              helpText: "Use the name we should address you by.",
              group: "Contact details",
            },
            {
              id: "budget",
              label: "Budget range",
              type: "select",
              required: true,
              options: ["Under £5,000", "£5,000–£10,000"],
              group: "Project details",
            },
            {
              id: "contact_method",
              label: "Preferred contact method",
              type: "radio",
              options: ["Email", "Phone"],
              group: "Project details",
            },
            {
              id: "services",
              label: "Services needed",
              type: "multi_select",
              options: ["Design", "Development"],
              group: "Project details",
            },
            {
              id: "brief",
              label: "Project brief",
              type: "file",
              required: true,
              multiple: true,
              accept: "application/pdf",
              maxSizeMb: 30,
              group: "Project details",
            },
          ],
          submit_label: "Send enquiry",
          success_message: "Thank you. We will be in touch.",
          redirect_url: null,
          is_active: true,
        },
      ]),
    });
  });
  await page.route("**/functions/v1/form-upload-sign", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        path: "public/accessibility/brief.pdf",
        upload_url: "https://uploads.example.test/brief.pdf",
        content_type: "application/pdf",
      }),
    });
  });
  await page.route("https://uploads.example.test/**", async (route) => {
    await route.fulfill({ status: 200, body: "" });
  });

  await page.goto("/f/accessible-lead-form");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Tell us about your project" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Contact details" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toHaveAttribute("aria-required", "true");
  await expect(page.getByRole("combobox", { name: "Budget range" })).toHaveAttribute("aria-required", "true");
  await expect(page.getByRole("radiogroup", { name: "Preferred contact method" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Services needed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload a file for Project brief (required)" })).toBeVisible();

  const designCheckbox = page.getByRole("checkbox", { name: "Design" });
  const checkboxBox = await designCheckbox.boundingBox();
  expect(checkboxBox).not.toBeNull();
  expect(checkboxBox!.width).toBeGreaterThanOrEqual(24);
  expect(checkboxBox!.height).toBeGreaterThanOrEqual(24);

  await page.locator('input[type="file"][name="brief"]').setInputFiles({
    name: "brief.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("accessibility test"),
  });
  const removeFileButton = page.getByRole("button", { name: "Remove brief.pdf" });
  await expect(removeFileButton).toBeVisible();
  const removeBox = await removeFileButton.boundingBox();
  expect(removeBox).not.toBeNull();
  expect(removeBox!.width).toBeGreaterThanOrEqual(24);
  expect(removeBox!.height).toBeGreaterThanOrEqual(24);
  await removeFileButton.click();
  await expect(removeFileButton).toHaveCount(0);

  await page.waitForTimeout(1_600);
  await page.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByRole("alert")).toContainText("Full name");
  await expect(page.getByRole("alert")).toContainText("Budget range");

  await page.setViewportSize({ width: 320, height: 800 });
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("public testimonial forms expose labelled, keyboard-operable review controls", async ({ page }) => {
  await page.route("**/rest/v1/rpc/testimonial_request_get", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        client_name: "Maya Patel",
        from_name: "CloseSync Studio",
        custom_message: "Thank you for working with us.",
        google_review_url: "https://example.test/google-review",
        status: "sent",
      }),
    });
  });

  await page.goto("/testimonial/accessible-testimonial-token");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Leave a review" })).toBeVisible();

  const form = page.locator("form");
  await expect(form).toHaveCount(1);
  await expect(form).toHaveAttribute("aria-busy", "false");

  const ratingOptions = page.getByRole("radio");
  await expect(ratingOptions).toHaveCount(5);
  await expect(page.getByRole("radio", { name: "5 stars" })).toBeChecked();
  await page.getByRole("radio", { name: "3 stars" }).check();
  await expect(page.getByRole("radio", { name: "3 stars" })).toBeChecked();

  const review = page.getByLabel("Your review", { exact: true });
  await expect(review).toHaveAttribute("required", "");
  await expect(review).toHaveAttribute("minlength", "5");
  await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute("autocomplete", "name");
  await expect(page.getByLabel("Company (optional)", { exact: true })).toHaveAttribute("autocomplete", "organization");
  await expect(page.getByLabel("Role / title (optional)", { exact: true })).toHaveAttribute("autocomplete", "organization-title");

  const consent = page.getByRole("checkbox", { name: "Allow this review to be shown publicly" });
  const consentBox = await consent.boundingBox();
  expect(consentBox).not.toBeNull();
  expect(consentBox!.width).toBeGreaterThanOrEqual(24);
  expect(consentBox!.height).toBeGreaterThanOrEqual(24);

  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByRole("alert")).toContainText("at least 5 characters");
  await expect(review).toBeFocused();
  await expect(review).toHaveAttribute("aria-invalid", "true");
  await expect(review).toHaveAttribute("aria-describedby", "testimonial-review-error");

  await review.fill("Clear and thoughtful support.");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(review).toHaveAttribute("aria-invalid", "false");

  await page.setViewportSize({ width: 320, height: 800 });
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  const nameBox = await page.getByLabel("Name", { exact: true }).boundingBox();
  const companyBox = await page.getByLabel("Company (optional)", { exact: true }).boundingBox();
  expect(nameBox).not.toBeNull();
  expect(companyBox).not.toBeNull();
  expect(companyBox!.y).toBeGreaterThan(nameBox!.y);
});

test("invalid public document links fail closed", async ({ page }) => {
  await page.goto("/book/not-a-real-booking-link");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Booking link not found" })).toBeVisible();

  await page.goto("/proposal/view/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { name: "Proposal not found" })).toBeVisible();
  await expect(page.getByText(/invalid or the proposal has been removed/i)).toBeVisible();

  await page.goto("/sign/not-a-real-signing-token");
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Contract not found" })).toBeVisible();
  await expect(page.getByText(/invalid or expired/i)).toBeVisible();
});
