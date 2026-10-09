// npm run local: the app on this computer with its own database and the demo
// data, separate from the hosted project. Needs Docker.
//
// Starts the local Supabase (the first run downloads its images and loads the
// migrations and supabase/seeds/startup_feasibility_seed.sql), adds a demo
// admin, then starts Vite pointed at it and opens the login page.
// `npm run local:stop` stops the database; its data is kept for next time.
import { spawn, spawnSync } from "node:child_process";
import { addAdminsToSeededCompany, getLocalSupabase } from "./localSupabase.js";

const demoAdmin = { email: "demo@atera.local", password: "atera-demo", username: "demo" };
// Services the app does not use stay off, which also shortens the first download.
const unusedServices = "studio,imgproxy,mailpit,logflare,vector,supavisor,postgres-meta";
const shell = process.platform === "win32";

if (spawnSync("docker", ["info"], { shell, stdio: "ignore" }).status !== 0) {
  console.error("Docker is not running. Start Docker Desktop, then run `npm run local` again.");
  process.exit(1);
}

console.log("Starting the local database. The first time downloads a few GB and takes several minutes.");
const startDatabase = () =>
  spawnSync("npx", ["supabase", "start", "-x", unusedServices], { shell, stdio: "inherit" }).status === 0;
// After Docker was closed with the database running, the database recovers
// first and the first start reports it unhealthy; it starts on the next try.
if (!startDatabase()) {
  console.log("Trying once more in 15 seconds...");
  await new Promise((resolve) => setTimeout(resolve, 15_000));
  if (!startDatabase()) process.exit(1);
}

const supabase = getLocalSupabase();
await addAdminsToSeededCompany([demoAdmin]);
console.log(`\nSign in with ${demoAdmin.email} / ${demoAdmin.password}. Stop with Ctrl+C.\n`);

// Variables set here take precedence over .env, which can stay pointed at the hosted project.
const vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--open", "/login"], {
  env: { ...process.env, VITE_SUPABASE_ANON_KEY: supabase.anonKey, VITE_SUPABASE_URL: supabase.url },
  shell,
  stdio: "inherit",
});
vite.on("exit", (code) => process.exit(code ?? 0));
