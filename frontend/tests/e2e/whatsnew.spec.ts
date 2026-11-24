import { expect, test } from "@playwright/test";
import { mockApi } from "./fixtures";

test("a long-standing account is shown What's new once", async ({ page }) => {
  await mockApi(page);
  // Registered after mockApi's own route, so this one answers.
  await page.route("**/api/auth/me", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1, username: "tester", name: "Tester", email: "tester@example.com",
        is_admin: false, is_verified: true, is_trainer: false, created_at: null,
        usage_profile: { style: "both", extras: ["progress", "body", "social", "coach"] },
      }),
    }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem("iron_log_token", "fake-jwt-token");
  });
  await page.goto("/");

  const sheet = page.getByRole("dialog", { name: "What's new" });
  await expect(sheet).toBeVisible();
  // Step through however many entries there are.
  const next = sheet.getByRole("button", { name: "Next" });
  while (await next.count()) await next.click();
  await sheet.getByRole("button", { name: "Got it" }).click();
  await expect(sheet).toBeHidden();

  await page.reload();
  await expect(page.locator(".tabs")).toBeVisible();
  await expect(sheet).toBeHidden();
});
