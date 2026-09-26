import { expect, test } from "@playwright/test";

const concepts = [
  { key: "editorial", title: "A - Editorial record", heading: "Every step, connected.", sample: "View sample proposal", sampleHref: "/sample" },
  { key: "system", title: "B - Workflow system", heading: "From first enquiry to signed, paid and ready to start.", sample: null, sampleHref: null },
  { key: "studio", title: "C - Quiet studio", heading: "A calmer way to close clients.", sample: "View sample proposal", sampleHref: "/sample" },
] as const;

for (const concept of concepts) {
  test(`${concept.title} is usable on desktop and mobile`, async ({ page }) => {
    await page.goto(`/landing-concepts/${concept.key}`);

    await expect(page).toHaveTitle(`${concept.title} | CloseSync landing concepts`);
    await expect(page.getByRole("heading", { level: 1, name: concept.heading })).toBeVisible();
    await expect(page.getByRole("link", { name: "CloseSync AI home" })).toBeVisible();
    await expect(page.locator(".concept-header .concept-brand-mark img")).toHaveAttribute("src", "/closesync-mark.png");
    await expect(page.locator('#landing-main')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("link", { name: "Start free" }).first()).toHaveAttribute("href", "/signup");
    if (concept.sample && concept.sampleHref) {
      const sampleLink = page.getByRole("link", { name: concept.sample }).first();
      await expect(sampleLink).toHaveAttribute("href", concept.sampleHref);
    } else {
      await expect(page.getByRole("link", { name: "View a sample workflow" })).toHaveCount(0);
      await expect(page.locator(".concept-header").getByRole("link", { name: "Start free" })).toHaveCount(0);
      await expect(page.locator(".system-hero-intro").getByRole("link", { name: "Start free" })).toHaveCount(1);
      await expect(page.locator(".concept-header").getByRole("link", { name: "Sign in" })).toBeVisible();
      await expect(page.locator(".system-hero-intro")).toHaveCSS("display", "grid");
    }

    if (concept.key === "system") {
      const workflow = page.getByRole("region", { name: "BrightStone website redesign" });
      const stages = workflow.getByRole("list", { name: "Client workflow stages" });
      await expect(stages.getByRole("listitem")).toHaveCount(7);
      await expect(stages.locator('[aria-current="step"]')).toContainText("Proposal");
      await expect(stages.locator('[aria-current="step"]')).toContainText("Active stage");
      const stagePreview = workflow.getByRole("region", { name: "Proposal sent" });
      await expect(stagePreview).toContainText("Awaiting decision");
      await expect(stagePreview).toContainText("Follow up with BrightStone");

      const workflowLink = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Workflow" });
      await workflowLink.click();
      await expect(page).toHaveURL(/#workflow$/);
      await expect(workflow).toBeInViewport();
      await expect(workflow).toHaveClass(/is-sequenced/);

      await expect(page.getByRole("heading", { name: "The gap between “interested” and “ready to start” creates avoidable work." })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Built for the handoff after “yes”." })).toBeVisible();
      await expect(page.getByText("Designed first for UK freelancers, consultants and small agencies.")).toBeVisible();
      await expect(page.getByText("Free is £0. Pro is £29 per month.")).toBeVisible();
      await expect(page.getByRole("heading", { name: "One client record from enquiry to kickoff." })).toBeVisible();
      await expect(workflow.getByRole("heading", { level: 3, name: "Responsible AI, inside the workflow." })).toBeVisible();

      expect(await page.locator("#landing-main > section").evaluateAll((sections) => (
        sections.map((section) => section.className)
      ))).toEqual([
        "system-hero",
        "system-assurances",
        "system-problem",
        "system-capabilities",
        "concept-pricing",
      ]);

      const pricingColumns = await page.locator("#pricing > *").evaluateAll((columns) => columns.map((column) => {
        const box = column.getBoundingClientRect();
        return { left: box.left, height: box.height };
      }));
      expect(pricingColumns).toHaveLength(3);
      expect(pricingColumns[1].left).toBeGreaterThan(pricingColumns[0].left);
      expect(pricingColumns[2].left).toBeGreaterThan(pricingColumns[1].left);
      expect(Math.abs(pricingColumns[1].height - pricingColumns[2].height)).toBeLessThanOrEqual(1);

      await page.setViewportSize({ width: 800, height: 1000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
      ).toBe(false);
    }

    const selector = page.getByRole("navigation", { name: "Choose a landing page concept" });
    await expect(selector.getByRole("link")).toHaveCount(4);
    await expect(selector.getByRole("link", { name: concept.title })).toHaveAttribute("aria-current", "page");

    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    ).toBe(false);

    for (const link of await selector.getByRole("link").all()) {
      await expect(link).toBeVisible();
    }

    for (const action of await page.locator(".concept-actions a").all()) {
      const box = await action.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }

    if (concept.key === "system") {
      await page.setViewportSize({ width: 320, height: 800 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
      ).toBe(false);
    }
  });
}

test("workflow motion respects the visitor's reduced-motion preference", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/landing-concepts/system");

  const workflow = page.getByRole("region", { name: "BrightStone website redesign" });
  await expect(workflow).toHaveClass(/is-sequenced/);
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
});
