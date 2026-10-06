// Creates the test users as admins of the seeded company. Later runs reuse them.
import { createClient } from "@supabase/supabase-js";
import { getLocalSupabase } from "./localSupabase.js";
import { users } from "./users.js";

// A record from supabase/seeds/startup_feasibility_seed.sql; its company is the one with the test data.
const seededMaterial = "Startup Arıtılmış Su";

export default async function globalSetup() {
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

  for (const user of Object.values(users)) {
    if (existing.some((account) => account.email === user.email)) continue;

    const { error: createError } = await supabase.auth.admin.createUser({
      app_metadata: { access_level: "admin", company_id: material.company_id },
      email: user.email,
      email_confirm: true,
      password: user.password,
      user_metadata: { language: "tr", username: user.username },
    });
    if (createError) throw createError;
  }
}
