// Test accounts, created in the seeded company by globalSetup. They exist only
// in the local database.
export const users = {
  // Used by almost every test, through the signed-in state saved by auth.setup.js.
  admin: { email: "e2e-admin@atera.local", password: "e2e-local-password", username: "e2e-admin" },
  // Used where a test signs out: signing out ends all of a user's sessions,
  // which would also end the admin's saved one.
  session: { email: "e2e-session@atera.local", password: "e2e-local-password", username: "e2e-session" },
};

export const adminStatePath = "e2e/.auth/admin.json";
