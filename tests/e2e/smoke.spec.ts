import { expect, test } from "@playwright/test";

test("landing page and login flow surfaces are reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("landing-page")).toBeVisible();

  await page.goto("/login");
  await expect(page.getByTestId("login-form")).toBeVisible();
  await expect(page.getByTestId("login-email-input")).toBeVisible();
  await expect(page.getByTestId("login-submit-button")).toBeVisible();
  await expect(page.getByText(/allowlisted .* configured/i)).toHaveCount(0);
  await expect(page.locator('a[href*="/auth/dev-login"]')).toHaveCount(0);
});
