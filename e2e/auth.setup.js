// Signs the admin in once and saves the session for the other tests.
import { expect, heading, signIn, test } from "./support/app.js";
import { adminStatePath, users } from "./support/users.js";

test("sign in as the test admin", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, users.admin);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(heading(page)).toHaveText("Fizibilite kararı");
  await page.context().storageState({ path: adminStatePath });
});
