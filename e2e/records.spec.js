import { expect, statusMessage, test, unsavedDialog, waitForData } from "./support/app.js";

const rowNamed = (page, name) => page.locator(".data-table tbody tr", { hasText: name }).first();

// Every delete asks the browser to confirm first.
test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("a saved product saves again unchanged", async ({ page }) => {
  // Guards against number fields whose step rejects saved decimals, which
  // blocked the form without any message.
  await page.goto("/operations/products");
  await page.locator(".data-table tbody tr.is-clickable").first().click();
  await expect(page.getByLabel("Ürün adı")).toHaveValue("Fonksiyonel Soğuk Zincir İçecek 250 ml");
  await page.locator(".operation-data-form button[type=submit]").click();
  await expect(statusMessage(page)).toHaveText("Operasyon kaydı kaydedildi.");
});

test("the resource plan saves and recalculates", async ({ page }) => {
  await page.goto("/operations/data-entry");
  await page.locator(".process-open-button").click();
  await page.locator(".process-save-panel button[type=submit]").click();
  await expect(statusMessage(page)).toHaveText("Kaynak planı kaydedildi ve hesaplandı.");
});

test("a new material can be added and deleted", async ({ page }) => {
  const name = `E2E Malzeme ${Date.now()}`;
  await page.goto("/operations/resources");
  await page.getByLabel("Malzeme adı").fill(name);
  await page.getByLabel("Malzeme grubu").fill("Test");
  await page.locator(".operations-material-form-card button[type=submit]").click();
  await expect(statusMessage(page)).toHaveText("Operasyon kaydı kaydedildi.");

  // The table may page its rows; search narrows it to the new one.
  const materials = page.locator(".card", { has: page.getByRole("heading", { name: "Malzemeler" }) });
  const search = materials.getByRole("searchbox");
  if (await search.count()) await search.fill(name);
  await rowNamed(page, name).locator(".table-delete-button").click();
  await expect(statusMessage(page)).toHaveText(`"${name}" silindi.`);
  await expect(rowNamed(page, name)).toHaveCount(0);
});

test("a material used by a recipe is not deleted", async ({ page }) => {
  await page.goto("/operations/resources");
  await rowNamed(page, "Startup Arıtılmış Su").locator(".table-delete-button").click();
  await expect(statusMessage(page)).toContainText("hâlâ kullanılıyor");
  await expect(rowNamed(page, "Startup Arıtılmış Su")).toBeVisible();
});

test("copying a record into the form counts as an unsaved edit", async ({ page }) => {
  await page.goto("/operations/resources");
  await waitForData(page);
  await page.locator(".data-table tbody tr.is-clickable").first().click();
  await page.locator(".dashboard-nav-item", { hasText: "Raporlar" }).click();
  await expect(unsavedDialog(page)).toBeVisible();
  await page.getByRole("button", { name: "Kaydetmeden çık" }).click();
  await expect(page).toHaveURL(/\/reports$/);
});

test("financial assumptions and loans save", async ({ page }) => {
  await page.goto("/financial-modelling/girdiler");
  await page.getByRole("button", { name: "Varsayımları Kaydet" }).click();
  await expect(statusMessage(page)).toHaveText("Finansal varsayımlar kaydedildi.");

  await page.goto("/financial-modelling/krediler");
  await page.getByRole("button", { name: "Kredileri Kaydet" }).click();
  await expect(statusMessage(page)).toHaveText("Finansal varsayımlar kaydedildi.");
});

test("an optional expense can be added and deleted", async ({ page }) => {
  const name = `E2E Gider ${Date.now()}`;
  await page.goto("/financial-modelling/girdiler");
  await page.getByLabel("Opsiyonel gider adı").fill(name);
  await page.getByLabel("Tutar").fill("1500");
  await page.getByRole("button", { name: "Opsiyonel Gider Ekle" }).click();
  await expect(statusMessage(page)).toHaveText("Ek finansal gider kaydedildi.");

  await rowNamed(page, name).locator(".table-delete-button").click();
  await expect(statusMessage(page)).toHaveText(`"${name}" silindi.`);
  await expect(rowNamed(page, name)).toHaveCount(0);
});
