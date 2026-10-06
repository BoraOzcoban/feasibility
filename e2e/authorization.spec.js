import { expect, test } from "./support/app.js";

test("a new role becomes an access level for users", async ({ page }) => {
  const role = `e2e-rol-${Date.now()}`;
  await page.goto("/authorization");
  await page.getByRole("tab", { name: "Yetki tanımlama" }).click();
  await page.getByLabel("Yetki adı").fill(role);
  await page.getByRole("button", { name: "Yetki yarat" }).click();
  await expect(page.getByLabel("Yetki adı")).toHaveValue("");

  await page.getByRole("tab", { name: "Kullanıcı tanımlama" }).click();
  await expect(page.getByLabel("Yetki seviyesi").locator(`option[value="${role}"]`)).toHaveCount(1);
});

test("an admin creates a user in the same company", async ({ page }) => {
  // Goes through the create-company-user Edge Function, which fetches its
  // imports from jsr.io when it starts. Behind a TLS-intercepting proxy that
  // fails; set E2E_SKIP_EDGE_FUNCTIONS=1 there.
  test.skip(process.env.E2E_SKIP_EDGE_FUNCTIONS === "1", "Edge Functions are not available");
  const name = `e2e-kullanici-${Date.now()}`;
  await page.goto("/authorization");
  await page.getByRole("tab", { name: "Kullanıcı tanımlama" }).click();
  await page.getByLabel("Kullanıcı adı").fill(name);
  await page.getByLabel("Mail adresi").fill(`${name}@atera.local`);
  await page.getByLabel("Şifre").fill("e2e-local-password");
  await page.getByRole("button", { name: "Kullanıcı oluştur" }).click();
  await expect(page.locator(".data-table tbody tr", { hasText: name })).toBeVisible();
});
