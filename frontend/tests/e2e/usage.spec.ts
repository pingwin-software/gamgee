import { expect, test } from "@playwright/test";
import { defaultState, mockApi } from "./fixtures";

test.beforeEach(async ({ page }) => {
  // An account that has never answered the questionnaire.
  await mockApi(page, { ...defaultState(), usageProfile: null });
  await page.addInitScript(() => {
    window.localStorage.setItem("iron_log_token", "fake-jwt-token");
  });
});

test("an on-the-spot lifter gets only what they need", async ({ page }) => {
  const saved: unknown[] = [];
  await page.route("**/api/auth/preferences", async route => {
    saved.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("/");

  const sheet = page.getByRole("dialog", { name: "How do you put a workout together?" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Next" })).toBeDisabled();
  await sheet.getByRole("radio", { name: /on the spot/ }).click();
  await sheet.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /See my progress/ }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  expect(saved).toContainEqual({ usage_profile: { style: "spot", extras: ["progress"] } });
  // Train, Progress and Me; no Social, no Plans.
  await expect(page.locator(".tabs .tab")).toHaveText(["TRAIN", "PROGRESS", "ME"]);
  await page.locator(".tabs .tab", { hasText: "PROGRESS" }).click();
  await expect(page.locator(".subtabs .subtab")).toHaveText(["HISTORY", "PRs", "TRENDS"]);

  // No plan screen: building goes straight to picking a focus, and back again.
  await page.locator(".tabs .tab", { hasText: "TRAIN" }).click();
  await page.getByRole("button", { name: "BUILD WORKOUT" }).click();
  await expect(page.getByText("How do you want to train?")).toHaveCount(0);
  await page.locator(".wz-back").first().click();
  await expect(page.getByRole("button", { name: "BUILD WORKOUT" })).toBeVisible();

  // The answers can be changed in Settings, or everything brought back.
  await page.locator(".tabs .tab", { hasText: "ME" }).click();
  await page.getByRole("button", { name: "Workout", exact: true }).click();
  await page.getByRole("button", { name: "Show everything" }).click();
  await expect(page.locator(".tabs .tab")).toHaveCount(5);
});

test("a plan follower sees their plan, not the one-off builder", async ({ page }) => {
  await page.goto("/");
  const sheet = page.getByRole("dialog", { name: "How do you put a workout together?" });
  await sheet.getByRole("radio", { name: /follow a plan/ }).click();
  await sheet.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await expect(page.locator(".tabs .tab")).toHaveText(["TRAIN", "PROGRESS", "PLANS", "ME"]);
  await page.getByRole("button", { name: "MY PLAN & TEMPLATES" }).click();
  await expect(page.getByText("Your plan", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /One-Off/ })).toHaveCount(0);
});

test("skipping shows everything", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /show me everything/ }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".tabs .tab")).toHaveCount(5);
});
