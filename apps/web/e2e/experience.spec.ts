import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { AnalyticsEvent } from "../lib/analytics";

type Scenario = "Data flowing" | "Data missing";

async function start(page: Page, scenario: Scenario = "Data flowing") {
  await page.goto("/");
  await page.getByRole("button", { name: scenario, exact: true }).click();
  await page.getByRole("button", { name: "Start walkthrough" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByLabel("Cart: 0 items")).toBeVisible();
}

async function shop(page: Page) {
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.getByLabel("Cart: 1 items")).toBeVisible();
  await page.getByRole("button", { name: "See what Product receives" }).click();
  await expect(page).toHaveURL(/\/results$/);
}

async function inspect(page: Page) {
  await page.getByRole("button", { name: "Inspect what happened" }).click();
  await expect(page).toHaveURL(/\/evidence$/);
}

async function onlyStep(page: Page, step: "landing" | "play" | "results" | "evidence" | "restart") {
  // Check the whole DOM, not just the viewport: scrolling must never reveal a
  // different step. Neither anchors nor CSS-hidden copies satisfy this check.
  await expect(page.locator(".landing")).toHaveCount(step === "landing" ? 1 : 0);
  await expect(page.locator(".phone")).toHaveCount(step === "play" ? 1 : 0);
  await expect(page.locator(".analytics-panel")).toHaveCount(step === "results" ? 1 : 0);
  await expect(page.locator(".evidence")).toHaveCount(step === "evidence" ? 1 : 0);
  await expect(page.locator('a[href^="#"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const scenario of ["Data flowing", "Data missing"] as const) {
  test(`${scenario}: separate routes preserve real session and delivery evidence`, async ({ page, request }) => {
    const healthy = scenario === "Data flowing";
    const prefix = healthy ? "healthy" : "issue";
    const posts: AnalyticsEvent[] = [];
    const sessions: string[] = [];
    const errors: string[] = [];
    const urls: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().endsWith("/api/events")) posts.push(req.postDataJSON());
      const match = req.url().match(/\/api\/sessions\/([^/]+)\/events$/);
      if (match) sessions.push(match[1]);
    });
    await page.goto("/");
    await page.getByRole("button", { name: scenario, exact: true }).click();
    await expect(page.getByRole("button", { name: scenario, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Can you trust the data behind your product decisions?" })).toBeVisible();
    await onlyStep(page, "landing");
    expect(posts).toEqual([]);
    expect(sessions).toEqual([]);
    urls.push(page.url());
    if (healthy) await page.screenshot({ path: "test-results/landing-desktop.png", fullPage: true });

    await page.getByRole("button", { name: "Start walkthrough" }).click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByText("Step 1 of 3", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Cart: 0 items")).toBeVisible();
    await expect(page.getByRole("button", { name: "See what Product receives" })).toBeDisabled();
    await onlyStep(page, "play");
    urls.push(page.url());
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    await expect(page.getByLabel("Cart: 1 items")).toBeVisible();
    await page.screenshot({ path: `test-results/${prefix}-play.png`, fullPage: true });
    await page.getByRole("button", { name: "See what Product receives" }).click();

    await expect(page).toHaveURL(/\/results$/);
    await expect(page.getByText("Step 2 of 3", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: healthy ? "Product has the data it needs" : "Product is missing data", exact: true })).toBeVisible();
    await expect(page.getByLabel("Customer actions and analytics").locator("strong")).toHaveText(["2", healthy ? "2 of 2" : "0 of 2"]);
    await expect(page.getByLabel("Expected behaviors").getByText(healthy ? "Received" : "Missing", { exact: true })).toHaveCount(2);
    await onlyStep(page, "results");
    await expect(page.locator(".event-evidence, .session-meta")).toHaveCount(0);
    urls.push(page.url());
    await page.screenshot({ path: `test-results/${prefix}-results.png`, fullPage: true });

    const sessionId = sessions[0];
    expect(sessionId).toBeTruthy();
    const response = await request.get(`/api/sessions/${sessionId}/events`);
    expect(response.status()).toBe(200);
    const stored: AnalyticsEvent[] = await response.json();
    expect(posts.map((event) => event.event)).toEqual(healthy ? ["product_viewed", "product_added_to_cart"] : []);
    expect(stored.map((event) => ({ ...event, timestamp: new Date(event.timestamp).toISOString() }))).toEqual(posts);

    await inspect(page);
    await expect(page.getByText("Step 3 of 3", { exact: true })).toBeVisible();
    await onlyStep(page, "evidence");
    if (!healthy) await page.locator(".raw-evidence > summary").click();
    await expect(page.getByText(sessionId, { exact: true })).toBeVisible();
    await expect(page.locator(".event-evidence")).toHaveCount(2);
    if (healthy) {
      await expect(page.getByText("Both customer actions were captured, sent to the backend, and stored successfully.", { exact: true })).toBeVisible();
      await expect(page.getByText("Yes — verified by reading SQLite", { exact: true })).toHaveCount(2);
      await expect(page.locator(".event-evidence").getByText("201", { exact: true })).toHaveCount(2);
      await expect(page.getByText("POST /events", { exact: true })).toHaveCount(2);
      for (const event of posts) await expect(page.getByText(event.event_id, { exact: true })).toBeVisible();
    } else {
      await expect(page.locator(".evidence-explanation")).toContainText("The original customer actions occurred, but they did not reach analytics.");
      await expect(page.getByText("Not initialized", { exact: false })).toHaveCount(2);
      await expect(page.getByText("None — no request was made", { exact: true })).toHaveCount(2);
      await expect(page.locator(".event-evidence").getByText("None", { exact: true })).toHaveCount(2);
    }
    urls.push(page.url());
    expect(new Set(sessions)).toEqual(new Set([sessionId]));
    expect(posts).toHaveLength(healthy ? 2 : 0);
    expect(errors).toEqual([]);
    await writeFile(`test-results/${prefix}-session.json`, JSON.stringify({ urls, sessionId, posts, stored }, null, 2));
    await page.screenshot({ path: `test-results/${prefix}-evidence.png`, fullPage: true });
  });
}

test("Back and Forward preserve actions; changing scenario and starting over isolate sessions", async ({ page }) => {
  const posts: AnalyticsEvent[] = [];
  page.on("request", (req) => { if (req.method() === "POST" && req.url().endsWith("/api/events")) posts.push(req.postDataJSON()); });
  await start(page);
  await shop(page);
  await expect(page.getByRole("heading", { name: "Product has the data it needs", exact: true })).toBeVisible();
  await inspect(page);
  const sessionId = await page.locator(".session-meta code").first().innerText();
  const eventIds = await page.locator(".event-evidence dd code").allTextContents();
  await page.goBack();
  await expect(page).toHaveURL(/\/results$/);
  await onlyStep(page, "results");
  await page.goBack();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByLabel("Cart: 1 items")).toBeVisible();
  await onlyStep(page, "play");
  await page.goForward();
  await expect(page).toHaveURL(/\/results$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/evidence$/);
  await expect(page.locator(".session-meta code").first()).toHaveText(sessionId);
  expect(await page.locator(".event-evidence dd code").allTextContents()).toEqual(eventIds);
  expect(posts).toHaveLength(2);

  await page.getByRole("button", { name: "Try other scenario" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.locator(".scenario-tag")).toHaveText("Data missing");
  await expect(page.getByLabel("Cart: 0 items")).toBeVisible();
  await shop(page);
  await expect(page.getByLabel("Customer actions and analytics").locator("strong")).toHaveText(["2", "0 of 2"]);
  await inspect(page);
  const issueSession = await page.locator(".session-meta code").first().innerText();
  expect(issueSession).not.toBe(sessionId);
  expect(posts).toHaveLength(2);

  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await onlyStep(page, "landing");
  await page.goBack();
  await expect(page).toHaveURL(/\/evidence$/);
  await expect(page.getByRole("heading", { name: /A customer taps\.\s*Does Product see it\?/ })).toBeVisible();
  await onlyStep(page, "restart");
  await page.getByRole("button", { name: "Choose a scenario", exact: true }).click();
  await page.getByRole("button", { name: "Start walkthrough" }).click();
  await expect(page.getByLabel("Cart: 0 items")).toBeVisible();
  await shop(page);
  await inspect(page);
  await expect(page.locator(".session-meta code").first()).not.toHaveText(issueSession);
});

for (const route of ["/play", "/results", "/evidence"]) {
  test(`${route}: direct visits and refreshes offer restart without fabricated results`, async ({ page }) => {
    const viewport = route === "/play" ? { width: 390, height: 844 } : route === "/results" ? { width: 900, height: 1000 } : { width: 1440, height: 1000 };
    await page.setViewportSize(viewport);
    const posts: string[] = [];
    page.on("request", (req) => { if (req.method() === "POST") posts.push(req.url()); });
    await page.goto(route);
    await expect(page.getByRole("heading", { name: /A customer taps\.\s*Does Product see it\?/ })).toBeVisible();
    await onlyStep(page, "restart");
    expect(posts).toEqual([]);
    await page.screenshot({ path: `test-results/welcome-${viewport.width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Choose a scenario", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("button", { name: "Data missing", exact: true }).click();
    await page.getByRole("button", { name: "Start walkthrough" }).click();
    await expect(page).toHaveURL(/\/play$/);
    if (route !== "/play") await shop(page);
    if (route === "/evidence") await inspect(page);
    await page.reload();
    expect(new URL(page.url()).pathname).toBe(route);
    await expect(page.getByRole("heading", { name: /A customer taps\.\s*Does Product see it\?/ })).toBeVisible();
    await onlyStep(page, "restart");
    expect(posts).toEqual([]);
    if (route === "/evidence") await page.screenshot({ path: "test-results/refresh-restart.png", fullPage: true });
  });
}

test("delivery completing after navigation updates the same session and evidence", async ({ page }) => {
  // Delay a real request rather than substituting a success response.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let cartRequest!: () => void;
  const cartStarted = new Promise<void>((resolve) => { cartRequest = resolve; });
  await page.route("**/api/events", async (route) => {
    if (route.request().postDataJSON().event === "product_added_to_cart") {
      cartRequest();
      await gate;
    }
    await route.continue();
  });
  await start(page);
  await shop(page);
  await cartStarted;
  await expect(page.getByRole("heading", { name: "Checking what Product received" })).toBeVisible();
  await inspect(page);
  await expect(page.getByText("Waiting for response", { exact: true })).toBeVisible();
  const sessionId = await page.locator(".session-meta code").first().innerText();
  release();
  await expect(page.getByText("Yes — verified by reading SQLite", { exact: true })).toHaveCount(2);
  await expect(page.locator(".session-meta code").first()).toHaveText(sessionId);
  await page.goBack();
  await expect(page.getByLabel("Customer actions and analytics").locator("strong")).toHaveText(["2", "2 of 2"]);
});

test("read outage remains unconfirmed across routes and a retry recovers", async ({ page }) => {
  // Only this test substitutes a storage outage. Scenario acceptance uses real HTTP.
  await page.route("**/api/sessions/*/events", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await start(page);
  await shop(page);
  await expect(page.getByRole("heading", { name: "Unable to verify delivery", exact: true })).toBeVisible();
  await expect(page.getByText("Unconfirmed", { exact: true })).toHaveCount(2);
  await expect(page.getByLabel("Customer actions and analytics").locator("strong")).toHaveText(["2", "—"]);
  await inspect(page);
  await expect(page.locator(".evidence-explanation")).toContainText("we cannot currently confirm what is stored");
  await expect(page.getByText("Unknown — storage could not yet be verified", { exact: true })).toHaveCount(2);
  await page.goBack();
  await page.unroute("**/api/sessions/*/events");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Product has the data it needs", exact: true })).toBeVisible();
});

test("mobile routes keep each step separate without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await onlyStep(page, "play");
  await page.screenshot({ path: "test-results/play-mobile.png", fullPage: true });
  await shop(page);
  await expect(page.getByRole("heading", { name: "Product has the data it needs", exact: true })).toBeVisible();
  await onlyStep(page, "results");
  await page.screenshot({ path: "test-results/results-mobile.png", fullPage: true });
  await inspect(page);
  await onlyStep(page, "evidence");
  await page.screenshot({ path: "test-results/evidence-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await onlyStep(page, "landing");
  await page.screenshot({ path: "test-results/landing-mobile.png", fullPage: true });
});

test("scenario selection and route navigation work with a keyboard", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Data missing", "Start walkthrough", "Add to cart", "See what Product receives", "Inspect what happened"]) {
    await page.getByRole("button", { name, exact: true }).focus();
    await page.keyboard.press("Enter");
    if (name === "Start walkthrough") await expect(page).toHaveURL(/\/play$/);
    if (name === "See what Product receives") await expect(page).toHaveURL(/\/results$/);
    if (name === "Inspect what happened") await expect(page).toHaveURL(/\/evidence$/);
  }
  await expect(page.locator(".scenario-tag")).toHaveText("Data missing");
  await expect(page.getByText("None — no request was made", { exact: true })).toHaveCount(2);
});
