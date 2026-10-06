import { expect, heading, signedInRoutes, test, waitForData } from "./support/app.js";

for (const [path, title] of signedInRoutes) {
  test(`${path} opens with its heading and no technical terms or fractional units`, async ({ page }) => {
    await page.goto(path);
    await expect(heading(page)).toHaveText(title);
    await expect(page).toHaveURL(new RegExp(`${path}$`));

    const text = await page.locator("body").innerText();
    for (const term of ["Supabase", "backend", "CostEngine"]) expect(text).not.toContain(term);
    expect(text).not.toMatch(/\d+,\d{2} adet/);
  });
}

const redirects = [
  ["/", "/dashboard"],
  ["/login", "/dashboard"],
  ["/dashboard/kisa-ozet", "/dashboard"],
  ["/operations/process", "/operations/data-entry"],
  ["/operations/material-definitions", "/operations/resources"],
  ["/operations/unknown", "/operations"],
  ["/financial-modelling", "/financial-modelling/girdiler"],
  ["/financial-modelling/maliyet-hesaplama/urun-maliyeti", "/financial-modelling/analiz"],
  ["/financial-modelling/unknown", "/financial-modelling/girdiler"],
  ["/simulation", "/simulation/current-situation"],
  ["/simulation/unknown", "/simulation/current-situation"],
  ["/reports/unknown", "/dashboard"],
  ["/product-plus", "/dashboard"],
];

for (const [from, to] of redirects) {
  test(`${from} redirects to ${to}`, async ({ page }) => {
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(`${to}$`));
    await expect(heading(page)).toBeVisible();
  });
}

test("reloading a saved simulation variant stays on it", async ({ page }) => {
  await page.goto("/simulation/current-situation");
  await waitForData(page);
  await page.locator(".tab-row button", { hasText: "Startup Base Case" }).click();
  await expect(heading(page)).toHaveText("Startup Base Case");
  const variantUrl = page.url();

  await page.reload();
  await expect(heading(page)).toHaveText("Startup Base Case");
  expect(page.url()).toBe(variantUrl);
});
