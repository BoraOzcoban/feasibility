// Connection details for the local Supabase that `npx supabase start` runs.
// E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY and E2E_SUPABASE_SERVICE_ROLE_KEY
// override them; otherwise they come from `supabase status`.
import { execFileSync } from "node:child_process";

// The tests create users and change records, so they never run against a
// hosted project.
const localUrl = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/;

export function getLocalSupabase() {
  if (!process.env.E2E_SUPABASE_URL) {
    let status;
    try {
      const output = execFileSync("npx", ["supabase", "status", "--output", "json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      status = JSON.parse(output.slice(output.indexOf("{")));
    } catch (error) {
      throw new Error("Local Supabase is not running. Start it with `npx supabase start` (needs Docker).", {
        cause: error,
      });
    }
    // Workers inherit these, so `supabase status` runs once per test run.
    process.env.E2E_SUPABASE_URL = status.API_URL;
    process.env.E2E_SUPABASE_ANON_KEY = status.ANON_KEY;
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
  }

  const url = process.env.E2E_SUPABASE_URL;
  if (!localUrl.test(url)) {
    throw new Error(`E2E tests only run against a local Supabase, not ${url}.`);
  }

  return {
    anonKey: process.env.E2E_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY,
    url,
  };
}
