// Shared steps. Every test fails if the page throws an uncaught error.
import { test as base, expect } from "@playwright/test";

export { expect };

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await use(page);
    expect(errors, "errors thrown in the page").toEqual([]);
  },
});

export async function signIn(page, user) {
  await page.locator("input[type=email]").fill(user.email);
  await page.locator("input[type=password]").fill(user.password);
  await page.locator("form button[type=submit]").click();
}

export const heading = (page) => page.locator("h1").first();
export const statusMessage = (page) => page.locator(".status-message").first();
export const unsavedDialog = (page) => page.locator(".unsaved-changes-dialog");

export async function openFromSidebar(page, name) {
  await page.locator(".dashboard-nav-item", { hasText: name }).click();
}

// Waits until every module's data has loaded (no request for half a second).
export async function waitForData(page) {
  await expect(heading(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
}

// Raises the first sales channel's first-month quantity by one and returns the old value.
export async function editSalesQuantity(page) {
  await page.locator(".list-item > summary").first().click();
  const quantity = salesQuantity(page);
  const before = await quantity.inputValue();
  await quantity.fill(String(Number(before) + 1));
  return before;
}

export const salesQuantity = (page) =>
  page.locator(".list-item").first().locator("label", { hasText: "İlk Ay Satış" }).locator("input");

export const signedInRoutes = [
  ["/dashboard", "Fizibilite kararı"],
  ["/operations", "Operasyon"],
  ["/operations/resources", "Kaynak"],
  ["/operations/products", "Ürünler"],
  ["/operations/machines-equipment", "Makine & Ekipman"],
  ["/operations/data-entry", "Süreç Tanımlama"],
  ["/operations/active-processes", "Mevcut Süreçler"],
  ["/sales-strategy", "Satış Stratejisi"],
  ["/financial-modelling/girdiler", "Girdiler"],
  ["/financial-modelling/krediler", "Krediler"],
  ["/financial-modelling/analiz", "Maliyet & Getiri Analizi"],
  ["/simulation/current-situation", "Mevcut Durum"],
  ["/reports", "Rapor İndirme"],
  ["/reports/print/full", "Atera"],
  ["/authorization", "Yetkilendirme Sayfası"],
];
