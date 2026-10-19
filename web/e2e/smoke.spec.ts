import { expect, test, type Page } from "@playwright/test";

// The dev token is the user id the backend trusts in AUTH_MODE=dev; a fresh one per test is a fresh account.
test.beforeEach(async ({ page }, info) => {
  const user = `e2e-${info.workerIndex}-${Date.now()}`;
  await page.addInitScript((token) => {
    window.localStorage.setItem("moatmine.token", token);
    window.localStorage.setItem("moatmine.lang", "en");
  }, user);
});

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

test("a first visit opens the welcome tour once, and finishing it lands on the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome\/?$/);
  await expect(page.getByText("Step 1 of 6")).toBeVisible();

  for (let step = 2; step <= 6; step++) {
    await button(page, "Next").click();
    await expect(page.getByText(`Step ${step} of 6`)).toBeVisible();
  }
  await page.getByRole("link", { name: "Go to dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/");
  await expect(page).not.toHaveURL(/welcome/);
});

test("the dashboard reads the signed-in user's data from the API with the dev token", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("moatmine.intro", "seen"));
  await page.goto("/");
  // a brand-new user has no saved risk profile; only an authenticated API answer can say so
  await expect(page.getByText("Set your risk profile first.")).toBeVisible();
  await expect(page.getByText(/Can't reach the API/)).toHaveCount(0);
});

test("a Learn module opens its details and examples and can be marked complete", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("moatmine.intro", "seen"));
  await page.goto("/learn/");
  await expect(page.getByText("0 of 7 modules complete")).toBeVisible();

  await page.getByRole("link", { name: "Start" }).first().click();
  await expect(page.getByRole("heading", { name: "What investing is" })).toBeVisible();

  const example = page.getByText(/Emergency fund: you keep three to six months/);
  await expect(example).toBeHidden();
  await page.getByText("Examples (3)").first().click();
  await expect(example).toBeVisible();

  const detail = page.getByText(/Risk is not only losing money/);
  await expect(detail).toBeHidden();
  await page.getByText("More details").first().click();
  await expect(detail).toBeVisible();

  await button(page, "Mark module as complete").click();
  await page.getByRole("link", { name: "All modules" }).click();
  await expect(page.getByText("1 of 7 modules complete")).toBeVisible();
});

test("a stock page labels mock market data as sample data", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("moatmine.intro", "seen"));
  await page.goto("/stock/?s=AAPL");
  await expect(page.getByText(/sample data/i).first()).toBeVisible();
});
