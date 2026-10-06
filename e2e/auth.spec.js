import { expect, heading, signIn, statusMessage, test } from "./support/app.js";
import { users } from "./support/users.js";

// These start signed out and use their own account (see users.js).
test.use({ storageState: { cookies: [], origins: [] } });

test("the bare address opens the login form", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("input[type=email]")).toBeVisible();
});

test("a wrong password shows an error and stays on the login form", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, { ...users.session, password: "not-the-password" });
  await expect(statusMessage(page)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("a deep link shows the login form, then the page itself after signing in", async ({ page }) => {
  await page.goto("/operations/products");
  await expect(page.locator("input[type=email]")).toBeVisible();
  await expect(page).toHaveURL(/\/operations\/products$/);

  await signIn(page, users.session);
  await expect(heading(page)).toHaveText("Ürünler");
  await expect(page).toHaveURL(/\/operations\/products$/);
});

test("signing out lands on the login form", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, users.session);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.locator(".dashboard-logout").click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("input[type=email]")).toBeVisible();
});
