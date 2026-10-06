// The Sprint 4 layout gate: at 1280 px and 390 px no page scrolls sideways and
// no table squeezes a header or cell into a letter-per-line column.
import { expect, signedInRoutes, test } from "./support/app.js";

function findLayoutProblems() {
  const problems = [];
  const overflow = document.documentElement.scrollWidth - window.innerWidth;
  if (overflow > 0) problems.push(`page is ${overflow}px wider than the screen`);

  for (const cell of document.querySelectorAll("table th, table td")) {
    const text = cell.innerText.trim();
    if (!text) continue;
    // Count rendered text lines, not cell height: a row grows with its tallest cell.
    const range = document.createRange();
    range.selectNodeContents(cell);
    const lines = new Set(
      [...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top)),
    ).size;
    const words = text.split(/\s+/);
    const longestWord = Math.max(...words.map((word) => word.length));
    const label = `"${text.slice(0, 30)}"`;

    if (cell.scrollWidth > cell.clientWidth + 1 && getComputedStyle(cell).overflowX === "visible") {
      problems.push(`cell overflows: ${label}`);
    }
    if (longestWord > 3 && cell.clientWidth < 40) problems.push(`cell is ${cell.clientWidth}px wide: ${label}`);
    if (lines > words.length + 1) problems.push(`cell breaks inside words: ${label}`);
  }
  return [...new Set(problems)];
}

for (const width of [1280, 390]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const [path, title] of signedInRoutes) {
      test(`${path} fits`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("h1").first()).toHaveText(title);
        if (path === "/operations/data-entry") await page.locator(".process-open-button").click();
        await page.waitForLoadState("networkidle");
        expect(await page.evaluate(findLayoutProblems)).toEqual([]);
      });
    }
  });
}

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const width of [1280, 390]) {
    test(`/login fits at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/login");
      await expect(page.locator("input[type=email]")).toBeVisible();
      expect(await page.evaluate(findLayoutProblems)).toEqual([]);
    });
  }
});
