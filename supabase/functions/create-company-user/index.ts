// Creates a user inside the caller's company.
//
// The browser can no longer create company users with auth.signUp: sign-up
// metadata is controlled by whoever signs up, so it cannot decide the company.
// This function checks that the caller may write the authorization module,
// then creates the user with the service role and puts the company in
// app_metadata, which handle_new_user trusts.
//
// Deploy: supabase functions deploy create-company-user
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function text(value: unknown, maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authorization = request.headers.get("Authorization") ?? "";

  if (!authorization.startsWith("Bearer ")) return json(401, { error: "Sign in first." });

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });

  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) return json(401, { error: "Sign in first." });

  const { data: canWrite, error: permissionError } = await callerClient.rpc("has_module_permission", {
    p_module_key: "authorization",
    p_permission: "write",
  });
  if (permissionError) return json(500, { error: permissionError.message });
  if (!canWrite) return json(403, { error: "Authorization write permission is required." });

  const { data: callerProfile, error: profileError } = await callerClient
    .from("profiles")
    .select("company_id")
    .eq("id", callerData.user.id)
    .single();
  if (profileError || !callerProfile?.company_id) return json(403, { error: "Your profile is not connected to a company." });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid request body." });
  }

  const email = text(body.email, 320).toLowerCase();
  const password = String(body.password ?? "");
  const username = text(body.username, 80);
  const accessLevel = text(body.accessLevel, 80).toLowerCase() || "user";
  const language = body.language === "tr" ? "tr" : "en";
  const theme = body.theme === "dark" ? "dark" : "light";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "Enter a valid email address." });
  if (password.length < 8) return json(400, { error: "Password must be at least 8 characters." });
  if (!username) return json(400, { error: "Username is required." });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: roles, error: rolesError } = await adminClient
    .from("company_roles")
    .select("name")
    .eq("company_id", callerProfile.company_id);
  if (rolesError) return json(500, { error: rolesError.message });
  const role = (roles ?? []).find((item) => String(item.name).toLowerCase() === accessLevel);
  if (!role) return json(400, { error: "Unknown role for this company." });

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    app_metadata: { access_level: role.name, company_id: callerProfile.company_id },
    email,
    email_confirm: true,
    password,
    user_metadata: {
      department: text(body.department, 120),
      language,
      phone_number: text(body.phoneNumber, 40),
      theme,
      username,
    },
  });
  if (createError) return json(400, { error: createError.message });

  return json(200, { userId: created.user?.id ?? null });
});
