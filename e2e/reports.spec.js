import { expect, test } from "./support/app.js";

test("the XLSX report downloads", async ({ page }) => {
  await page.goto("/reports");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /XLSX/ }).first().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^atera-.+\.xlsx$/);
});

test("the printable report opens with its tables and goes back to Reports", async ({ page }) => {
  await page.goto("/reports/print/full");
  await expect(page.locator(".print-cover h1")).toHaveText("Atera");
  await expect(page.locator(".print-table").first()).toBeVisible();
  await page.getByRole("button", { name: "Geri" }).click();
  await expect(page).toHaveURL(/\/reports$/);
});
