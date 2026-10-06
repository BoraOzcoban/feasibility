import { expect, heading, statusMessage, test, unsavedDialog, waitForData } from "./support/app.js";

test("a discount lowers the base result and the variant saves", async ({ page }) => {
  await page.goto("/simulation/current-situation");
  await waitForData(page);
  const baseResult = page.locator(".scenario-outcome.is-base strong");
  const discount = page.locator(".parameter-group label", { hasText: "İndirim" }).locator("input");
  const save = page.locator(".page-header button.primary");
  const before = await baseResult.innerText();

  await discount.fill("10");
  await expect(baseResult).not.toHaveText(before);
  await save.click();
  await expect(statusMessage(page)).toHaveText("Simülasyon varyantı kaydedildi.");

  // Put the seed value back.
  await discount.fill("0");
  await expect(baseResult).toHaveText(before);
  await save.click();
  await expect(statusMessage(page)).toHaveText("Simülasyon varyantı kaydedildi.");
});

test("a new variant opens at once, asks before it is left unsaved, and can be deleted", async ({ page }) => {
  await page.goto("/simulation/current-situation");
  await waitForData(page);
  await page.getByRole("button", { name: "+ Varyant Ekle" }).click();
  await expect(page).toHaveURL(/\/simulation\/variant-\d+$/);
  await expect(unsavedDialog(page)).toHaveCount(0);

  await page.locator(".dashboard-nav-item", { hasText: "Raporlar" }).click();
  await expect(unsavedDialog(page)).toBeVisible();
  await page.getByRole("button", { name: "Sayfada kal" }).click();

  await page.locator(".variant-delete-button").last().click();
  await expect(page).toHaveURL(/\/simulation\/current-situation$/);
  await expect(heading(page)).toHaveText("Mevcut Durum");

  await page.locator(".dashboard-nav-item", { hasText: "Raporlar" }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(unsavedDialog(page)).toHaveCount(0);
});
