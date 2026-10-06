// Browser tests against a local Supabase. See "Browser tests" in README.md.
import { defineConfig } from "@playwright/test";
import { getLocalSupabase } from "./e2e/support/localSupabase.js";
import { adminStatePath } from "./e2e/support/users.js";

const supabase = getLocalSupabase();
// A port of its own, so the tests never reuse a dev server that points at a hosted project.
const port = 5180;

export default defineConfig({
  testDir: "e2e",
  // The tests share one database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/support/globalSetup.js",
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    // For machines with a Chromium build Playwright did not install itself.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.js/ },
    {
      name: "app",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.js/,
      use: { storageState: adminStatePath },
    },
  ],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: false,
    env: { VITE_SUPABASE_ANON_KEY: supabase.anonKey, VITE_SUPABASE_URL: supabase.url },
  },
});
