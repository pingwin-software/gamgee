import { expect, test, type Page } from "@playwright/test";
import { defaultState, mockApi } from "./fixtures";

test.beforeEach(async ({ page }) => {
  // An account that has never answered the questionnaire.
  await mockApi(page, { ...defaultState(), usageProfile: null });
  await page.addInitScript(() => {
    window.localStorage.setItem("iron_log_token", "fake-jwt-token");
  });
});

/** Answer the four questions: toggles on the any-of steps, a radio for weights. */
async function answer(page: Page, ways: RegExp[], weights: RegExp, logging: RegExp[], extras: RegExp[]) {
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Next" })).toBeDisabled();
  for (const w of ways) await sheet.getByRole("button", { name: w }).click();
  await sheet.getByRole("button", { name: "Next" }).click();
  await expect(sheet.getByRole("button", { name: "Next" })).toBeDisabled();
  await sheet.getByRole("radio", { name: weights }).click();
  await sheet.getByRole("button", { name: "Next" }).click();
  for (const l of logging) await sheet.getByRole("button", { name: l }).click();
  await sheet.getByRole("button", { name: "Next" }).click();
  for (const e of extras) await sheet.getByRole("button", { name: e }).click();
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();
}

test("an impromptu lifter gets only what they need", async ({ page }) => {
  const saved: unknown[] = [];
  await page.route("**/api/auth/preferences", async route => {
    saved.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("/");
  await answer(page, [/Impromptu/], /decide myself/, [], [/See my progress/]);

  expect(saved).toContainEqual({ usage_profile: { ways: ["spot"], progression: "manual", fixedStepKg: 2.5, logging: [], extras: ["progress"] } });
  // Train, History and Me; no Social, no Plans. No suggestions, so no Trends.
  await expect(page.locator(".tabs .tab")).toHaveText(["TRAIN", "HISTORY", "ME"]);
  await page.locator(".tabs .tab", { hasText: "HISTORY" }).click();
  await expect(page.locator(".subtabs .subtab")).toHaveText(["SESSIONS", "PRs"]);

  // No plan screen: building goes straight to picking a focus, and back again.
  await page.locator(".tabs .tab", { hasText: "TRAIN" }).click();
  await page.getByRole("button", { name: "BUILD WORKOUT" }).click();
  await expect(page.getByText("How do you want to train?")).toHaveCount(0);
  await page.locator(".wz-back").first().click();
  await expect(page.getByRole("button", { name: "BUILD WORKOUT" })).toBeVisible();

  // Settings show only what is on, and can bring everything back.
  await page.locator(".tabs .tab", { hasText: "ME" }).click();
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Workout", exact: true }).click();
  await expect(page.getByText("Suggested progression")).toHaveCount(0);
  await page.getByRole("button", { name: "Show everything" }).click();
  await expect(page.locator(".tabs .tab")).toHaveCount(5);
});

test("a templates-only lifter sees their templates, nothing else", async ({ page }) => {
  await page.goto("/");
  await answer(page, [/Templates/], /Same jump/, [/Rest timer/], []);

  await expect(page.locator(".tabs .tab")).toHaveText(["TRAIN", "HISTORY", "PLANS", "ME"]);
  await page.getByRole("button", { name: "MY TEMPLATES" }).click();
  await expect(page.getByText("Your templates", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /One-Off/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Weekly Regime/ })).toHaveCount(0);

  // Plans holds only the templates.
  await page.locator(".wz-back").first().click();
  await page.locator(".tabs .tab", { hasText: "PLANS" }).click();
  await expect(page.getByText("My templates")).toBeVisible();
  await expect(page.getByText("My regimes")).toHaveCount(0);
});

test("a weekly-regime lifter gets the plan without templates", async ({ page }) => {
  await page.goto("/");
  await answer(page, [/A weekly regime/], /Suggest them/, [], []);
  await page.getByRole("button", { name: "MY PLAN" }).click();
  await expect(page.getByText("Your plan", { exact: true })).toBeVisible();
  await expect(page.getByText("Your Templates")).toHaveCount(0);
});

test("skipping shows everything", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /show me everything/ }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".tabs .tab")).toHaveCount(5);
});
