// Creates the test users as admins of the seeded company. Later runs reuse them.
import { addAdminsToSeededCompany } from "../../scripts/localSupabase.js";
import { users } from "./users.js";

export default async function globalSetup() {
  await addAdminsToSeededCompany(Object.values(users));
}
