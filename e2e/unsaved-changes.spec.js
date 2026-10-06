import {
  editSalesQuantity,
  expect,
  heading,
  openFromSidebar,
  salesQuantity,
  statusMessage,
  test,
  unsavedDialog,
  waitForData,
} from "./support/app.js";

const editablePages = [
  "/dashboard",
  "/operations",
  "/operations/resources",
  "/operations/data-entry",
  "/sales-strategy",
  "/financial-modelling/girdiler",
  "/simulation/current-situation",
];

for (const path of editablePages) {
  test(`leaving ${path} without edits does not ask`, async ({ page }) => {
    await page.goto(path);
    await waitForData(page);
    await openFromSidebar(page, "Raporlar");
    await expect(page).toHaveURL(/\/reports$/);
    await expect(unsavedDialog(page)).toHaveCount(0);
  });
}

test.describe("with an unsaved sales edit", () => {
  test.beforeEach(async ({ page }) => {
    // Arrive from Reports inside the app, so Back has an in-app page to return to.
    await page.goto("/reports");
    await waitForData(page);
    await openFromSidebar(page, "Satış");
    await waitForData(page);
    await editSalesQuantity(page);
  });

  test("Stay on page keeps the edit and the URL", async ({ page }) => {
    await openFromSidebar(page, "Raporlar");
    await expect(unsavedDialog(page)).toBeVisible();

    await page.getByRole("button", { name: "Sayfada kal" }).click();
    await expect(unsavedDialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/sales-strategy$/);
  });

  test("Leave without saving moves on", async ({ page }) => {
    await openFromSidebar(page, "Raporlar");
    await page.getByRole("button", { name: "Kaydetmeden çık" }).click();
    await expect(page).toHaveURL(/\/reports$/);
    await expect(heading(page)).toHaveText("Rapor İndirme");
  });

  test("the browser Back button waits for the answer", async ({ page }) => {
    await page.goBack();
    await expect(unsavedDialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/sales-strategy$/);

    await page.getByRole("button", { name: "Sayfada kal" }).click();
    await expect(page).toHaveURL(/\/sales-strategy$/);

    await page.goBack();
    await page.getByRole("button", { name: "Kaydetmeden çık" }).click();
    await expect(page).toHaveURL(/\/reports$/);
  });
});

test("Save and continue saves, then moves on", async ({ page }) => {
  await page.goto("/sales-strategy");
  await waitForData(page);
  const before = await editSalesQuantity(page);

  await openFromSidebar(page, "Raporlar");
  await page.getByRole("button", { name: "Kaydet ve devam et" }).click();
  await expect(page).toHaveURL(/\/reports$/);

  await openFromSidebar(page, "Satış");
  await page.locator(".list-item > summary").first().click();
  await expect(salesQuantity(page)).toHaveValue(String(Number(before) + 1));

  // Put the seed value back.
  await salesQuantity(page).fill(before);
  await page.locator(".page-header button.primary").click();
  await expect(statusMessage(page)).toHaveText("Satış stratejisi kaydedildi.");
});
