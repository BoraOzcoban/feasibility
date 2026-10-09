// The local Supabase that `npx supabase start` runs, used by the browser tests
// and by `npm run local`. E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY and
// E2E_SUPABASE_SERVICE_ROLE_KEY override its connection details; otherwise
// they come from `supabase status`.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

// Both create users and change records, so they never run against a hosted project.
const localUrl = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/;

export function getLocalSupabase() {
  if (!process.env.E2E_SUPABASE_URL) {
    let status;
    try {
      const output = execFileSync("npx", ["supabase", "status", "--output", "json"], {
        encoding: "utf8",
        shell: process.platform === "win32",
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
    throw new Error(`This only runs against a local Supabase, not ${url}.`);
  }

  return {
    anonKey: process.env.E2E_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY,
    url,
  };
}

// A record from supabase/seeds/startup_feasibility_seed.sql; its company holds the demo data.
const seededMaterial = "Startup Arıtılmış Su";

// Adds the accounts as admins of the seeded company. Accounts that exist are left as they are.
export async function addAdminsToSeededCompany(accounts) {
  const { serviceRoleKey, url } = getLocalSupabase();
  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: material, error } = await supabase
    .from("operation_materials")
    .select("company_id")
    .eq("name", seededMaterial)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!material) throw new Error("The seed data is missing. Load it with `npx supabase db reset`.");

  const {
    data: { users: existing },
    error: listError,
  } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  for (const account of accounts) {
    if (existing.some((user) => user.email === account.email)) continue;

    const { error: createError } = await supabase.auth.admin.createUser({
      app_metadata: { access_level: "admin", company_id: material.company_id },
      email: account.email,
      email_confirm: true,
      password: account.password,
      user_metadata: { language: "tr", username: account.username },
    });
    if (createError) throw createError;
  }
}
