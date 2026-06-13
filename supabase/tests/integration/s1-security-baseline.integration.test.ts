/**
 * Integration test: S1 security baseline (gap analysis G1 / G2 / G3-interim)
 *
 * Proves against the REAL local Supabase stack that:
 *   G1a — An INMO client user (org member, no nodo_core.profiles row) CANNOT
 *         read or write nodo_core tables.
 *   G1b — A NODO CORE team member (has a nodo_core.profiles row) CAN read them.
 *   G1c — anon can still INSERT into nodo_core.contact_leads (landing form),
 *         but cannot read leads back.
 *   G2  — An org admin CANNOT update shared.organizations (tier self-upgrade).
 *   G3  — An org admin CANNOT insert/promote an 'admin' membership client-side,
 *         but CAN still insert a non-admin membership (seats arrive in S2).
 *
 * Prerequisites:
 *   - Local Supabase stack running: `supabase start` (config.toml must expose
 *     the nodo_core schema in [api].schemas)
 *
 * Run (Node 22 required):
 *   ~/.nvm/versions/node/v22.22.0/bin/node \
 *     node_modules/.bin/tsx \
 *     supabase/tests/integration/s1-security-baseline.integration.test.ts
 *
 * If the local stack is NOT running, the test exits 0 with a SKIP notice.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Config — fall back to well-known local dev defaults
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// ---------------------------------------------------------------------------
// Minimal TAP-compatible test harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(condition: boolean, label: string) {
  const n = passed + failed + 1;
  if (condition) {
    console.log(`ok ${n} - ${label}`);
    passed++;
  } else {
    console.log(`not ok ${n} - ${label}`);
    failed++;
    failures.push(label);
  }
}

async function stackIsUp(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { method: "GET" });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function createUser(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error(`createUser failed: ${JSON.stringify(data)}`);
  return data.id;
}

async function deleteUser(userId: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

function clientFor(schema: "nodo_core" | "shared"): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    db: { schema },
  });
}

async function signIn(
  client: SupabaseClient,
  email: string,
  password: string
): Promise<void> {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn failed for ${email}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!(await stackIsUp())) {
    console.log(
      "# SKIP: local Supabase stack is not running.\n" +
        "# Start it with: supabase start"
    );
    process.exit(0);
  }

  console.log("TAP version 13");
  console.log("# S1 security baseline integration test (G1 / G2 / G3)");
  console.log(`# Stack: ${SUPABASE_URL}`);

  const run = Date.now().toString(36);
  const orgId = randomUUID();
  const clientEmail = `int-inmo-admin-${run}@test.local`;
  const teamEmail = `int-core-team-${run}@test.local`;
  const password = "Test123456!";

  let clientUserId = "";
  let teamUserId = "";
  let subUserId = "";

  const sql = postgres(DB_URL, { max: 2 });

  try {
    // ------------------------------------------------------------------
    // Setup: one INMO client org + admin, one CORE team member
    // ------------------------------------------------------------------
    await sql`
      INSERT INTO shared.organizations (id, name, tier)
      VALUES (${orgId}::uuid, ${"Int S1 Org " + run}, 'starter')
    `;

    clientUserId = await createUser(clientEmail, password);
    teamUserId = await createUser(teamEmail, password);
    subUserId = await createUser(`int-sub-${run}@test.local`, password);

    await sql`
      INSERT INTO shared.org_members (org_id, user_id, role)
      VALUES (${orgId}::uuid, ${clientUserId}::uuid, 'admin')
    `;

    // Team membership == row in nodo_core.profiles (service role bypasses RLS)
    await sql`
      INSERT INTO nodo_core.profiles (id, full_name, role)
      VALUES (${teamUserId}::uuid, ${"Int Team " + run}, 'admin')
    `;

    // ------------------------------------------------------------------
    // G1a — INMO client admin cannot read/write nodo_core tables
    // ------------------------------------------------------------------
    const inmoOnCore = clientFor("nodo_core");
    await signIn(inmoOnCore, clientEmail, password);

    const { data: leakRows, error: leakErr } = await inmoOnCore
      .from("profiles")
      .select("id");

    ok(
      leakRows === null || leakRows.length === 0 || leakErr !== null,
      "G1a: INMO client admin sees ZERO rows of nodo_core.profiles"
    );

    const { error: leakWriteErr } = await inmoOnCore
      .from("profiles")
      .update({ full_name: "pwned" })
      .eq("id", teamUserId);
    const afterLeakWrite = await sql`
      SELECT full_name FROM nodo_core.profiles WHERE id = ${teamUserId}::uuid
    `;
    ok(
      afterLeakWrite[0]?.full_name !== "pwned",
      `G1a: INMO client admin cannot UPDATE nodo_core.profiles (${leakWriteErr?.code ?? "0 rows matched"})`
    );

    // ------------------------------------------------------------------
    // G1b — CORE team member CAN read nodo_core tables
    // ------------------------------------------------------------------
    const teamOnCore = clientFor("nodo_core");
    await signIn(teamOnCore, teamEmail, password);

    const { data: teamRows, error: teamErr } = await teamOnCore
      .from("profiles")
      .select("id");

    ok(
      teamErr === null && (teamRows?.length ?? 0) >= 1,
      "G1b: CORE team member can read nodo_core.profiles"
    );

    // ------------------------------------------------------------------
    // G1c — anon can still insert a contact lead (landing form path)
    // ------------------------------------------------------------------
    const anonOnCore = clientFor("nodo_core"); // never signed in => anon
    const { error: leadErr } = await anonOnCore.from("contact_leads").insert({
      name: "Int Test",
      email: `lead-${run}@test.local`,
      message: "S1 integration test",
    });
    ok(
      leadErr === null,
      `G1c: anon can INSERT into nodo_core.contact_leads${leadErr ? ` (${leadErr.message})` : ""}`
    );

    // ...but cannot read leads back
    const { data: anonReadRows, error: anonReadErr } = await anonOnCore
      .from("contact_leads")
      .select("id");
    ok(
      anonReadRows === null || anonReadRows.length === 0 || anonReadErr !== null,
      "G1c: anon CANNOT read nodo_core.contact_leads back"
    );

    // ------------------------------------------------------------------
    // G2 — org admin cannot self-upgrade tier
    // ------------------------------------------------------------------
    const inmoOnShared = clientFor("shared");
    await signIn(inmoOnShared, clientEmail, password);

    await inmoOnShared
      .from("organizations")
      .update({ tier: "pro" })
      .eq("id", orgId);
    const tierAfter = await sql`
      SELECT tier FROM shared.organizations WHERE id = ${orgId}::uuid
    `;
    ok(
      tierAfter[0]?.tier === "starter",
      "G2: org admin CANNOT update shared.organizations.tier (still 'starter')"
    );

    // ------------------------------------------------------------------
    // G3 — org admin cannot create another admin, but CAN add a non-admin
    // ------------------------------------------------------------------
    const { error: adminInsertErr } = await inmoOnShared
      .from("org_members")
      .insert({ org_id: orgId, user_id: subUserId, role: "admin" });
    const adminRows = await sql`
      SELECT 1 AS x FROM shared.org_members
      WHERE org_id = ${orgId}::uuid AND user_id = ${subUserId}::uuid AND role = 'admin'
    `;
    ok(
      adminRows.length === 0,
      `G3: org admin CANNOT insert an 'admin' membership (${adminInsertErr?.code ?? "no error?"})`
    );

    const { error: agentInsertErr } = await inmoOnShared
      .from("org_members")
      .insert({ org_id: orgId, user_id: subUserId, role: "agent" });
    ok(
      agentInsertErr === null,
      `G3: org admin CAN insert a non-admin ('agent') membership${agentInsertErr ? ` (${agentInsertErr.message})` : ""}`
    );

    // ...and cannot promote that member to admin afterwards
    await inmoOnShared
      .from("org_members")
      .update({ role: "admin" })
      .eq("org_id", orgId)
      .eq("user_id", subUserId);
    const promoted = await sql`
      SELECT role FROM shared.org_members
      WHERE org_id = ${orgId}::uuid AND user_id = ${subUserId}::uuid
    `;
    ok(
      promoted[0]?.role === "agent",
      "G3: org admin CANNOT promote a member to 'admin' via UPDATE"
    );
  } finally {
    // Teardown — best-effort
    if (clientUserId) await deleteUser(clientUserId).catch(() => {});
    if (teamUserId) await deleteUser(teamUserId).catch(() => {});
    if (subUserId) await deleteUser(subUserId).catch(() => {});

    await sql`
      DELETE FROM nodo_core.contact_leads WHERE email LIKE ${"lead-" + run + "%"}
    `.catch(() => {});
    await sql`
      DELETE FROM shared.org_members WHERE org_id = ${orgId}::uuid
    `.catch(() => {});
    await sql`
      DELETE FROM shared.organizations WHERE id = ${orgId}::uuid
    `.catch(() => {});

    await sql.end();
  }

  const total = passed + failed;
  console.log(`\n1..${total}`);

  if (failed > 0) {
    console.log(`\n# FAILED ${failed}/${total}`);
    for (const f of failures) console.log(`#   - ${f}`);
    process.exit(1);
  } else {
    console.log(`\n# All ${total} tests passed`);
    process.exit(0);
  }
}

main().catch((err: unknown) => {
  console.error("FATAL:", err);
  process.exit(1);
});
