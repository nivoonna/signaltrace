import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Any API or external-service request is a failure, even if an API happens
  // to be running locally. Static assets must all respect the Pages base path.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    expect(url.origin).toBe("http://127.0.0.1:4173");
    expect(url.pathname).toMatch(/^\/signaltrace\//);
    expect(url.pathname).not.toContain("/api/");
    await route.continue();
  });
});

for (const scenario of ["Data flowing", "Data missing"] as const) {
  test(`${scenario}: exported routes complete the journey without backend services`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto("./");
    await expect(page.locator(".demo-notice")).toContainText("browser simulation");
    await expect(page.locator(".phone, .analytics-panel, .evidence")).toHaveCount(0);
    await page.getByRole("button", { name: scenario, exact: true }).click();
    await page.getByRole("button", { name: "Start walkthrough" }).click();
    await expect(page).toHaveURL(/\/signaltrace\/play\/$/);
    await expect(page.locator(".phone")).toBeVisible();
    await expect(page.locator(".analytics-panel, .evidence")).toHaveCount(0);
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    await page.getByRole("button", { name: "See what Product receives" }).click();
    await expect(page).toHaveURL(/\/signaltrace\/results\/$/);
    await expect(page.locator(".phone, .evidence")).toHaveCount(0);
    await expect(page.getByLabel("Customer actions and analytics").locator("strong")).toHaveText(["2", scenario === "Data flowing" ? "2 of 2" : "0 of 2"]);
    await page.getByRole("button", { name: "Inspect what happened" }).click();
    await expect(page).toHaveURL(/\/signaltrace\/evidence\/$/);
    await expect(page.locator(".phone, .analytics-panel")).toHaveCount(0);
    if (scenario === "Data missing") {
      await expect(page.getByRole("button", { name: "Apply fix", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Run validation", exact: true })).toHaveCount(0);
      await page.getByText("View technical evidence", { exact: true }).click();
      const failedIds = await page.locator(".event-evidence").evaluateAll((cards) => cards.map((card) => card.querySelectorAll("dd code")[1].textContent));
      await page.getByRole("button", { name: "Diagnose the issue", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Issue found", exact: true })).toBeVisible();
      await expect(page.locator(".diagnosis-facts strong")).toHaveText(["No", "2", "0", "0"]);
      await page.getByRole("button", { name: "Apply fix", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Fix applied", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Implementation restored", exact: true })).toHaveCount(0);
      await expect(page.getByText("Yes — verified in browser memory (simulated)", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Run validation", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Implementation restored", exact: true })).toBeVisible();
      await expect(page.locator(".recovery-comparison dd")).toHaveText(["0 of 2 reached analytics", "2 of 2 reached analytics"]);
      await expect(page.locator(".event-evidence")).toHaveCount(4);
      for (const id of failedIds) await expect(page.getByText(id!, { exact: true })).toBeVisible();
      const ids = await page.locator(".event-evidence").evaluateAll((cards) => cards.map((card) => card.querySelectorAll("dd code")[1].textContent));
      expect(new Set(ids).size).toBe(4);
      await page.getByText("Diagnostic tool results", { exact: true }).click();
      await expect(page.locator(".tool-evidence")).toContainText("browser_memory_simulation");
      await page.goBack();
      await expect(page).toHaveURL(/\/signaltrace\/results\/$/);
      await page.goForward();
      await expect(page.getByRole("heading", { name: "Implementation restored", exact: true })).toBeVisible();
    }
    await expect(page.getByText("Yes — verified in browser memory (simulated)", { exact: true })).toHaveCount(2);
    await expect(page.getByText("Yes — verified by reading SQLite", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Simulated HTTP response", { exact: true })).toHaveCount(scenario === "Data flowing" ? 2 : 4);
    await page.screenshot({ path: `test-results/static/${scenario === "Data flowing" ? "healthy" : "recovered"}.png`, fullPage: true });
    await page.getByRole("button", { name: "Try other scenario", exact: true }).click();
    await expect(page).toHaveURL(/\/signaltrace\/play\/$/);
    await expect(page.locator(".scenario-tag")).toHaveText(scenario === "Data flowing" ? "Data missing" : "Data flowing");
    expect(errors).toEqual([]);
  });
}

for (const route of ["play", "results", "evidence"]) {
  test(`${route}: directory index, assets, direct visit, and refresh work under /signaltrace/`, async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(`./${route}/`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /A customer taps\.\s*Does Product see it\?/ })).toBeVisible();
    await expect(page.locator(".phone, .analytics-panel, .evidence")).toHaveCount(0);
    const assets = await page.locator('script[src], link[rel="stylesheet"], link[rel="icon"]').evaluateAll((elements) => elements.map((el) => el.getAttribute("src") || el.getAttribute("href")));
    expect(assets.length).toBeGreaterThan(0);
    for (const asset of assets) {
      expect(asset).toMatch(/^\/signaltrace\//);
      expect((await request.get(asset!)).status()).toBe(200);
    }
    await page.getByRole("button", { name: "Choose a scenario", exact: true }).click();
    await expect(page).toHaveURL(/\/signaltrace\/$/);
    await page.getByRole("button", { name: "Start walkthrough" }).click();
    if (route !== "play") {
      await page.getByRole("button", { name: "Add to cart", exact: true }).click();
      await page.getByRole("button", { name: "See what Product receives" }).click();
    }
    if (route === "evidence") await page.getByRole("button", { name: "Inspect what happened" }).click();
    await expect(page).toHaveURL(new RegExp(`/signaltrace/${route}/$`));
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/signaltrace/${route}/$`));
    await expect(page.getByRole("button", { name: "Choose a scenario", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
