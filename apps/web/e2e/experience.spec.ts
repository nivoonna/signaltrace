import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { AnalyticsEvent } from "../lib/analytics";

test("healthy shopping reaches real storage and exposes actual HTTP evidence", async ({ page, request }) => {
  const posts: AnalyticsEvent[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => { if (req.method() === "POST" && req.url().endsWith("/api/events")) posts.push(req.postDataJSON()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Product view received", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Implementation healthy", exact: true })).toBeVisible();
  await expect(page.getByLabel("Cart: 1 items")).toBeVisible();
  await expect(page.getByLabel("Event counts").getByText("2", { exact: true })).toHaveCount(2);
  await expect(page.getByLabel("Expected behaviors").getByText("Received", { exact: true })).toHaveCount(2);
  expect(posts.map((event) => event.event)).toEqual(["product_viewed", "product_added_to_cart"]);
  const sessionId = posts[0].session_id;
  const response = await request.get(`/api/sessions/${sessionId}/events`);
  expect(response.status()).toBe(200);
  const stored: AnalyticsEvent[] = await response.json();
  expect(stored.map((event) => ({ ...event, timestamp: new Date(event.timestamp).toISOString() }))).toEqual(posts);
  await writeFile("test-results/healthy-session.json", JSON.stringify({ sessionId, posts, stored }, null, 2));
  await page.screenshot({ path: "test-results/healthy-desktop.png", fullPage: true });
  await page.locator("summary").filter({ hasText: "View technical evidence" }).click();
  await expect(page.getByText("Yes — verified by reading SQLite", { exact: true })).toHaveCount(2);
  await expect(page.locator(".event-evidence").getByText("201", { exact: true })).toHaveCount(2);
  await expect(page.getByText("POST /events", { exact: true })).toHaveCount(2);
  for (const event of posts) await expect(page.getByText(event.event_id, { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/healthy-evidence.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("issue mode keeps cart working, sends no ingestion requests, and reads an empty session", async ({ page, request }) => {
  let posts = 0;
  const readSessions: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().endsWith("/api/events")) posts++;
    const match = req.url().match(/\/api\/sessions\/([^/]+)\/events$/);
    if (match) readSessions.push(match[1]);
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Product view received", exact: true })).toBeVisible();
  const healthySession = readSessions.at(-1);
  const initialPosts = posts;
  await page.getByRole("button", { name: "Implementation Issue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Implementation issue", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.getByLabel("Cart: 1 items")).toBeVisible();
  await expect(page.getByLabel("Expected behaviors").getByText("Missing", { exact: true })).toHaveCount(2);
  await expect(page.getByLabel("Event counts").getByText("2", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Event counts").getByText("0", { exact: true })).toBeVisible();
  expect(posts).toBe(initialPosts);
  const sessionId = readSessions.at(-1)!;
  expect(sessionId).not.toBe(healthySession);
  const response = await request.get(`/api/sessions/${sessionId}/events`);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual([]);
  await writeFile("test-results/issue-session.json", JSON.stringify({ sessionId, ingestionRequests: posts - initialPosts }, null, 2));
  await page.screenshot({ path: "test-results/issue-desktop.png", fullPage: true });
  await page.locator("summary").filter({ hasText: "View technical evidence" }).click();
  await expect(page.getByText("Not initialized", { exact: false })).toHaveCount(2);
  await expect(page.getByText("None — no request was made", { exact: true })).toHaveCount(2);
  await expect(page.locator(".event-evidence").getByText("None", { exact: true })).toHaveCount(2);
  await page.screenshot({ path: "test-results/issue-evidence.png", fullPage: true });
  expect(posts).toBe(initialPosts);
});

test("fresh sessions reset the cart and exclude earlier stored activity", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Product view received", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Implementation healthy", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Product view received", exact: true })).toBeVisible();
  await expect(page.getByLabel("Cart: 0 items")).toBeVisible();
  await expect(page.getByLabel("Event counts").getByText("1", { exact: true })).toHaveCount(2);
  await expect(page.locator(".activity-list li")).toHaveCount(1);
  await expect(page.getByText("Awaiting action", { exact: true })).toBeVisible();
});

test("read outage is unconfirmed, shopping still works, and a retry recovers", async ({ page }) => {
  // Explicitly simulated outage; the healthy and issue tests above do not mock transport.
  await page.route("**/api/sessions/*/events", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Unable to verify delivery", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.getByLabel("Cart: 1 items")).toBeVisible();
  await expect(page.getByText("Unconfirmed", { exact: true })).toHaveCount(2);
  await page.screenshot({ path: "test-results/read-unavailable.png", fullPage: true });
  await page.unroute("**/api/sessions/*/events");
  await page.getByRole("button", { name: "Try again", exact: false }).click();
  await expect(page.getByRole("heading", { name: "Implementation healthy", exact: true })).toBeVisible();
});

test("narrow screen supports the full journey without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Product view received", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Implementation healthy", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/healthy-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Implementation Issue", exact: true }).click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.getByLabel("Expected behaviors").getByText("Missing", { exact: true })).toHaveCount(2);
  await page.locator("summary").filter({ hasText: "View technical evidence" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/issue-mobile.png", fullPage: true });
});

test("mode controls and evidence disclosure work with a keyboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Product view received", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Implementation Issue", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Implementation Issue", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Implementation issue", exact: true })).toBeVisible();
  await page.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("details")).toHaveAttribute("open", "");
  await page.keyboard.press("Space");
  await expect(page.locator("details")).not.toHaveAttribute("open");
});
