import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { AnalyticsEvent } from "../lib/analytics";

async function brokenJourney(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Data missing", exact: true }).click();
  await page.getByRole("button", { name: "Start walkthrough" }).click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("button", { name: "See what Product receives" }).click();
  await expect(page.getByRole("heading", { name: "Product is missing data", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Inspect what happened" }).click();
  await expect(page).toHaveURL(/\/evidence$/);
}

async function expectPrimaryAction(page: Page, name: string) {
  // One primary action per state; leaving this scenario is secondary until recovery.
  await expect(page.locator(".primary-cta")).toHaveCount(1);
  await expect(page.getByRole("button", { name, exact: true })).toHaveClass(/primary-cta/);
  await expect(page.locator(".raw-evidence > summary")).toBeVisible();
}

test("diagnose, apply fix, and validate fresh real events in the original session", async ({ page, request }) => {
  const posts: AnalyticsEvent[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => { if (req.method() === "POST" && req.url().endsWith("/api/events")) posts.push(req.postDataJSON()); });
  await brokenJourney(page);
  await expectPrimaryAction(page, "Diagnose the issue");
  await expect(page.getByRole("button", { name: "Apply fix", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run validation", exact: true })).toHaveCount(0);
  await expect(page.getByText("Not initialized", { exact: false }).first()).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Issue found", exact: true })).toHaveCount(0);
  const session = await page.locator(".session-meta code").first().textContent();
  const originalIds = await page.locator(".event-evidence dl > div").filter({ has: page.locator("dt", { hasText: /^Event ID$/ }) }).locator("dd").allTextContents();
  expect(posts).toHaveLength(0);
  await page.screenshot({ path: "test-results/recovery-before.png", fullPage: true });

  await page.getByRole("button", { name: "Diagnose the issue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Issue found", exact: true })).toBeVisible();
  await expectPrimaryAction(page, "Apply fix");
  await expect(page.getByRole("button", { name: "Diagnose the issue", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run validation", exact: true })).toHaveCount(0);
  await expect(page.locator(".diagnosis-result p")).toHaveText("Nova’s analytics integration was not initialized. Customer actions occurred normally, but analytics never attempted to send those events.");
  await expect(page.getByLabel("Investigation checks").locator("li")).toHaveText([
    "Checking implementation state ✓", "Checking event delivery ✓", "Reviewing runtime evidence ✓",
  ]);
  await expect(page.locator(".diagnosis-facts li")).toHaveText(["Analytics initialized: No", "Customer actions: 2", "Delivery attempts: 0", "Events received: 0"]);
  expect(posts).toHaveLength(0);
  await page.screenshot({ path: "test-results/recovery-diagnosis.png", fullPage: true });

  await page.getByRole("button", { name: "Apply fix", exact: true }).click();
  await expect(page.getByRole("button", { name: "Run validation", exact: true })).toBeEnabled();
  await expectPrimaryAction(page, "Run validation");
  await expect(page.getByRole("heading", { name: "Fix applied", exact: true })).toBeVisible();
  await expect(page.locator(".validation-prompt p")).toHaveText("The analytics integration is now initialized, but we still need to prove that new customer actions reach Product.");
  await expect(page.getByRole("button", { name: "Apply fix", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Issue found", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Implementation restored", exact: true })).toHaveCount(0);
  expect(posts).toHaveLength(0);
  expect((await request.get(`/api/diagnostics/sessions/${session}/sdk-state`)).status()).toBe(200);
  expect(await (await request.get(`/api/diagnostics/sessions/${session}/sdk-state`)).json()).toMatchObject({ initialized: true });
  expect(await (await request.get(`/api/sessions/${session}/events`)).json()).toEqual([]);
  await page.screenshot({ path: "test-results/recovery-fix.png", fullPage: true });

  // Hold the second real POST so the validation state is observable. A single
  // delivered event cannot unlock recovery or the prominent scenario-switch CTA.
  let releaseCart!: () => void;
  const cartGate = new Promise<void>((resolve) => { releaseCart = resolve; });
  await page.route("**/api/events", async (route) => {
    if (route.request().postDataJSON().event === "product_added_to_cart") await cartGate;
    await route.continue();
  });
  await page.getByRole("button", { name: "Run validation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Validating fresh delivery…", exact: true })).toBeVisible();
  await expectPrimaryAction(page, "Validating…");
  await expect(page.getByRole("button", { name: "Validating…", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Implementation restored", exact: true })).toHaveCount(0);
  await expect.poll(() => posts.length).toBe(2);
  await page.screenshot({ path: "test-results/recovery-validating.png", fullPage: true });
  releaseCart();
  await expect(page.getByRole("heading", { name: "Implementation restored", exact: true })).toBeVisible();
  await expectPrimaryAction(page, "Try other scenario");
  await expect(page.getByRole("button", { name: "Run validation", exact: true })).toHaveCount(0);
  await expect(page.getByText("2 of 2 fresh customer actions reached analytics.", { exact: true })).toBeVisible();
  await expect(page.locator(".recovery-comparison dt")).toHaveText(["Before fix", "After validation"]);
  await expect(page.locator(".recovery-comparison dd")).toHaveText(["0 of 2 reached analytics", "2 of 2 reached analytics"]);
  await expect(page.locator(".restored-outcome p")).toHaveText("Nova’s Product team is receiving the behavioral data it needs again.");
  expect(posts).toHaveLength(2);
  expect(posts.every((event) => event.session_id === session && !originalIds.includes(event.event_id))).toBe(true);
  const stored: AnalyticsEvent[] = await (await request.get(`/api/sessions/${session}/events`)).json();
  expect(stored.map((event) => ({ ...event, timestamp: new Date(event.timestamp).toISOString() }))).toEqual(posts);
  await page.screenshot({ path: "test-results/recovery-restored.png", fullPage: true });
  await page.locator(".raw-evidence > summary").click();
  await expect(page.locator(".event-evidence")).toHaveCount(4);
  await expect(page.locator(".event-evidence").getByText("Not initialized", { exact: false })).toHaveCount(2);
  await expect(page.getByText("Yes — verified by reading SQLite", { exact: true })).toHaveCount(2);
  for (const id of originalIds) await expect(page.getByText(id, { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/recovery-evidence.png", fullPage: true });
  await page.goBack();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Implementation restored", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("recovery cannot claim success while fresh storage verification is unavailable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await brokenJourney(page);
  await page.getByRole("button", { name: "Diagnose the issue", exact: true }).click();
  await page.getByRole("button", { name: "Apply fix", exact: true }).click();
  await expect(page.getByRole("button", { name: "Run validation", exact: true })).toBeEnabled();
  // The fresh POSTs are real. Only their verification reads are unavailable.
  await page.route("**/api/sessions/*/events", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.getByRole("button", { name: "Run validation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recovery not yet verified", exact: true })).toBeVisible();
  await expectPrimaryAction(page, "Run validation again");
  await expect(page.getByRole("heading", { name: "Implementation restored", exact: true })).toHaveCount(0);
  await expect(page.locator(".validation-prompt")).toContainText("After validation: Unconfirmed");
  await expect(page.locator(".recovery-comparison")).toHaveCount(0);
  await page.unroute("**/api/sessions/*/events");
  await expect(page.getByRole("heading", { name: "Implementation restored", exact: true })).toBeVisible({ timeout: 10000 });
  await expectPrimaryAction(page, "Try other scenario");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/recovery-mobile.png", fullPage: true });
});
