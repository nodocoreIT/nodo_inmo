/**
 * bootstrap-admin.ts
 *
 * Creates the first admin user + organization for a Nodo Inmo project.
 * Idempotent: safe to run multiple times (duplicate emails / org names
 * are handled gracefully).
 *
 * Uses:
 *   - Supabase Auth Admin API  (SUPABASE_URL + service role key) for user creation.
 *   - Direct Postgres connection (DATABASE_URL) for shared.organizations and
 *     shared.org_members inserts — bypasses PostgREST so no schema-exposure
 *     grant is needed on the shared schema.
 *
 * Usage (local):
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *   ADMIN_EMAIL=admin@nodoinmo.test \
 *   ADMIN_PASSWORD=super-secret-local \
 *   ORG_NAME="Mi Agencia" \
 *   npx tsx scripts/bootstrap-admin.ts
 *
 * Keys are printed by `supabase status` (local) or found in the Supabase
 * dashboard → Project Settings → API (remote). NEVER commit them.
 */

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

// ---------------------------------------------------------------------------
// Config — resolved from environment variables
// ---------------------------------------------------------------------------
function require_env(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`ERROR: required env var ${name} is not set.`);
    process.exit(1);
  }
  return val;
}

const SUPABASE_URL = require_env("SUPABASE_URL");
const SERVICE_ROLE_KEY = require_env("SUPABASE_SERVICE_ROLE_KEY");
const DATABASE_URL = require_env("DATABASE_URL");
const ADMIN_EMAIL = require_env("ADMIN_EMAIL");
const ADMIN_PASSWORD = require_env("ADMIN_PASSWORD");
const ORG_NAME = process.env["ORG_NAME"] ?? "Default Agency";

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

// Auth Admin API — service role for user management
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Direct Postgres — bypasses PostgREST; full access to all schemas
const sql = postgres(DATABASE_URL, { max: 1 });

async function main() {
  console.log(`\nBootstrapping admin for org: "${ORG_NAME}"`);
  console.log(`  Supabase URL : ${SUPABASE_URL}`);
  console.log(`  Admin email  : ${ADMIN_EMAIL}\n`);

  try {
    // 1. Create the auth user (email_confirm = true skips confirmation email)
    const { data: userData, error: userError } =
      await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });

    let user_id: string;

    if (userError) {
      // If the user already exists, look them up instead of failing.
      if (
        userError.message.includes("already") ||
        userError.message.includes("duplicate")
      ) {
        console.log(
          "User already exists — fetching existing user by email..."
        );
        const { data: listData, error: listError } =
          await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const existing = listData.users.find((u) => u.email === ADMIN_EMAIL);
        if (!existing) {
          throw new Error(
            `User with email ${ADMIN_EMAIL} not found after duplicate error.`
          );
        }
        user_id = existing.id;
      } else {
        throw userError;
      }
    } else {
      user_id = userData.user.id;
    }

    console.log(`User ID: ${user_id}`);

    // 2. Check if user is already an admin member anywhere (idempotency check)
    const [existing_membership] = await sql`
      select om.org_id, om.role, o.name as org_name
      from shared.org_members om
      join shared.organizations o on o.id = om.org_id
      where om.user_id = ${user_id}
        and om.role = 'admin'
      limit 1
    `;

    if (existing_membership) {
      console.log("\nUser already has an admin membership — skipping insert:");
      console.log(`  org_id   : ${existing_membership.org_id}`);
      console.log(`  org_name : ${existing_membership.org_name}`);
      console.log(`  role     : ${existing_membership.role}`);
      return;
    }

    // 2. Insert organization
    const [org] = await sql`
      insert into shared.organizations (name, tier)
      values (${ORG_NAME}, 'starter')
      returning id
    `;
    const org_id: string = org.id;
    console.log(`Org ID:  ${org_id}`);

    // 3. Insert org_members
    await sql`
      insert into shared.org_members (org_id, user_id, role)
      values (${org_id}, ${user_id}, 'admin')
      on conflict (org_id, user_id) do nothing
    `;

    console.log("\nDone. Admin bootstrap complete:");
    console.log(`  org_id  : ${org_id}`);
    console.log(`  user_id : ${user_id}`);
    console.log(`  role    : admin`);
    console.log(
      "\nNOTE: The JWT claim (app_metadata.org_id + role) is injected by the\n" +
        "      Custom Access Token Hook at the next sign-in."
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("\nBootstrap failed:", err.message ?? err);
  process.exit(1);
});
