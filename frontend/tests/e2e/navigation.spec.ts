import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("iron_log_token", "fake-jwt-token");
  });
  await page.goto("/");
  // Wait past the splash before we start clicking.
  await expect(page.locator(".tabs")).toBeVisible();
});

test("the five sections and their pages", async ({ page }) => {
  const tabs = page.locator(".tabs .tab");
  await expect(tabs).toHaveCount(5);

  await tabs.filter({ hasText: "PROGRESS" }).click();
  await expect(tabs.filter({ hasText: "PROGRESS" })).toHaveClass(/active/);
  const pages = page.locator(".subtabs .subtab");
  await expect(pages.filter({ hasText: "HISTORY" })).toHaveClass(/active/);

  await pages.filter({ hasText: "PRs" }).click();
  await expect(pages.filter({ hasText: "PRs" })).toHaveClass(/active/);

  // A section reopens on the page it was left on.
  await tabs.filter({ hasText: "SOCIAL" }).click();
  await tabs.filter({ hasText: "PROGRESS" }).click();
  await expect(page.locator(".subtabs .subtab").filter({ hasText: "PRs" })).toHaveClass(/active/);

  // Me is profile and settings on one page.
  await tabs.filter({ hasText: "ME" }).click();
  await page.getByRole("button", { name: "Workout", exact: true }).click();
  await expect(page.getByText("Suggested progression")).toBeVisible();
  await page.getByRole("radio", { name: "Fast" }).click();
  await expect(page.getByText(/next 60 kg × 10|next 62.5 kg × 8/)).toBeVisible();
});

test("clicking logout returns to the auth screen", async ({ page }) => {
  await page.locator(".logout-btn", { hasText: "Logout" }).first().click();
  await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
  const token = await page.evaluate(() => localStorage.getItem("iron_log_token"));
  expect(token).toBeNull();
});
