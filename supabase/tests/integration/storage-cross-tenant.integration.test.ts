/**
 * Integration test: storage cross-tenant denial (R18 / R19)
 *
 * Proves the following spec requirements against the REAL local Supabase stack:
 *   R18 — An admin of org A cannot read or create signed URLs for receipts belonging to org B.
 *   R19 — Receipts are never served via the public URL pattern (bucket is private).
 *
 * Prerequisites:
 *   - Local Supabase stack must be running: `supabase start`
 *   - Env vars SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY may be set to override defaults.
 *
 * Run (Node 22 required):
 *   ~/.nvm/versions/node/v22.22.0/bin/node \
 *     node_modules/.bin/tsx \
 *     supabase/tests/integration/storage-cross-tenant.integration.test.ts
 *
 * If the local stack is NOT running, the test exits 0 with a SKIP notice.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Config — fall back to well-known local dev defaults
// ---------------------------------------------------------------------------
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

// Standard local dev service_role JWT (JWT secret: super-secret-jwt-token-with-at-least-32-characters-long)
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Standard local dev anon JWT
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const BUCKET = "property-expense-receipts";
const BRANDING_BUCKET = "org-branding";

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

// ---------------------------------------------------------------------------
// Stack availability check
// ---------------------------------------------------------------------------
async function stackIsUp(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { method: "GET" });
    return res.status < 500;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Auth admin API helpers
// ---------------------------------------------------------------------------
async function createUser(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    // email_confirm: true bypasses email verification for local test users
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const data = (await res.json()) as { id?: string; error?: string };
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

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn failed for ${email}: ${error.message}`);
  return client;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Guard: skip if stack is not reachable
  if (!(await stackIsUp())) {
    console.log(
      "# SKIP: local Supabase stack is not running.\n" +
        "# Start it with: supabase start\n" +
        "# Then re-run: ~/.nvm/versions/node/v22.22.0/bin/node node_modules/.bin/tsx supabase/tests/integration/storage-cross-tenant.integration.test.ts"
    );
    process.exit(0);
  }

  console.log("TAP version 13");
  console.log("# Storage cross-tenant integration test (R18 / R19)");
  console.log(`# Stack: ${SUPABASE_URL}`);

  // Unique suffix to avoid collisions across parallel runs
  const run = Date.now().toString(36);

  // Use proper random UUIDs for org IDs
  const orgAId = randomUUID();
  const orgBId = randomUUID();
  const emailA = `int-admin-a-${run}@test.local`;
  const emailB = `int-admin-b-${run}@test.local`;
  const password = "Test123456!";

  let userAId = "";
  let userBId = "";
  let objectKey = "";
  let brandingObjectKey = "";
  let clientA: SupabaseClient | null = null;
  let clientB: SupabaseClient | null = null;

  // Direct DB connection for shared schema operations (not exposed in PostgREST)
  const sql = postgres(DB_URL, { max: 2 });

  try {
    // ------------------------------------------------------------------
    // Setup: create orgs + users + memberships
    // ------------------------------------------------------------------

    // Insert orgs directly via postgres (shared schema is not in PostgREST by default)
    await sql`
      INSERT INTO shared.organizations (id, name, tier)
      VALUES
        (${orgAId}::uuid, ${"Int Test Org A " + run}, 'starter'),
        (${orgBId}::uuid, ${"Int Test Org B " + run}, 'starter')
    `;

    // Create auth users
    userAId = await createUser(emailA, password);
    userBId = await createUser(emailB, password);

    // Insert memberships — the custom_access_token_hook reads this table on sign-in
    // and injects org_id + role into JWT app_metadata
    await sql`
      INSERT INTO shared.org_members (org_id, user_id, role)
      VALUES
        (${orgAId}::uuid, ${userAId}::uuid, 'admin'),
        (${orgBId}::uuid, ${userBId}::uuid, 'admin')
    `;

    // ------------------------------------------------------------------
    // Sign in both admins — hook enriches JWT with org_id + role
    // ------------------------------------------------------------------
    clientA = await signIn(emailA, password);
    clientB = await signIn(emailB, password);

    // Verify JWT app_metadata is populated (sanity check for the hook)
    const { data: sessionA } = await clientA.auth.getSession();
    const jwtA = sessionA?.session?.access_token;
    if (!jwtA) throw new Error("No session for admin A after sign-in");

    const payloadA = JSON.parse(
      Buffer.from(jwtA.split(".")[1], "base64url").toString("utf8")
    ) as { app_metadata?: { org_id?: string; role?: string } };

    ok(
      payloadA.app_metadata?.org_id === orgAId,
      "Setup: JWT app_metadata.org_id matches org A for admin A (hook fired)"
    );
    ok(
      payloadA.app_metadata?.role === "admin",
      "Setup: JWT app_metadata.role = admin for admin A"
    );

    // ------------------------------------------------------------------
    // R16 — Admin A uploads a receipt to their org's path
    // path format: {orgId}/{propertyId}/{uuid}-{filename}
    // ------------------------------------------------------------------
    const fileName = `receipt-${run}.jpg`;
    objectKey = `${orgAId}/test-prop-id/${run}-${fileName}`;
    // Minimal valid JPEG bytes (SOI + EOI markers) — enough for the MIME check
    const fileContent = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

    const { error: uploadErr } = await clientA.storage
      .from(BUCKET)
      .upload(objectKey, fileContent, {
        contentType: "image/jpeg",
        upsert: false,
      });

    ok(uploadErr === null, "R16: Admin A can upload a receipt to their org path");

    if (uploadErr) {
      // Cannot continue without a real uploaded object
      throw new Error(
        `Upload failed: ${uploadErr.message}. Remaining tests cannot run.`
      );
    }

    // ------------------------------------------------------------------
    // R16 (verify) — Admin A can create a signed URL for their own object
    // ------------------------------------------------------------------
    const { data: ownSignedUrl, error: ownSignedErr } =
      await clientA.storage.from(BUCKET).createSignedUrl(objectKey, 60);

    ok(
      ownSignedErr === null && ownSignedUrl !== null,
      "R16: Admin A can create a signed URL for their own receipt"
    );

    // ------------------------------------------------------------------
    // R18 — Admin B CANNOT create a signed URL for org A's object
    // The storage policy gates on:
    //   (storage.foldername(name))[1] = JWT app_metadata.org_id
    // Admin B's JWT has org_id = orgBId, but the object is under orgAId/...
    // The SELECT policy for the bucket will deny the lookup.
    // ------------------------------------------------------------------
    const { data: crossSignedUrl, error: crossSignedErr } =
      await clientB.storage.from(BUCKET).createSignedUrl(objectKey, 60);

    const crossTenantDenied =
      crossSignedErr !== null ||
      crossSignedUrl === null ||
      crossSignedUrl.signedUrl === null;

    ok(
      crossTenantDenied,
      "R18: Admin B CANNOT create a signed URL for org A receipt (cross-tenant denied)"
    );

    // Extra: if a signed URL was somehow returned, verify it is non-functional
    if (crossSignedUrl?.signedUrl) {
      const probeRes = await fetch(crossSignedUrl.signedUrl);
      ok(
        probeRes.status >= 400,
        `R18 (extra): Cross-org signed URL is non-functional (HTTP ${probeRes.status})`
      );
    } else {
      ok(
        true,
        "R18 (extra): No signed URL was returned for cross-org object (denial confirmed at API level)"
      );
    }

    // ------------------------------------------------------------------
    // R19 — Public URL pattern returns 400 (bucket is private)
    // Accessing /storage/v1/object/public/{bucket}/... without auth must fail.
    // ------------------------------------------------------------------
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectKey}`;
    const publicRes = await fetch(publicUrl);

    ok(
      publicRes.status === 400 || publicRes.status === 404,
      `R19: Public URL returns ${publicRes.status} — bucket is private, not publicly accessible`
    );

    // ==================================================================
    // org-branding bucket — R-A14 / R-A16 / R-A17
    // Same cross-tenant denial pattern as receipts, different bucket.
    // ==================================================================
    console.log("\n# org-branding bucket cross-tenant tests");

    // R-A14 — Admin A uploads logo to their org's path
    const logoFileName = `logo-${run}.jpg`;
    brandingObjectKey = `${orgAId}/logo-${run}-${logoFileName}`;
    const logoContent = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); // minimal JPEG

    const { error: logoUploadErr } = await clientA.storage
      .from(BRANDING_BUCKET)
      .upload(brandingObjectKey, logoContent, {
        contentType: "image/jpeg",
        upsert: false,
      });

    ok(
      logoUploadErr === null,
      "R-A14: Admin A can upload a logo to their org path in org-branding"
    );

    if (logoUploadErr) {
      console.log(`# WARN: branding upload failed: ${logoUploadErr.message}. Skipping remaining branding tests.`);
    } else {
      // R-A14 (verify) — Admin A can create a signed URL for their own logo
      const { data: ownLogoUrl, error: ownLogoErr } =
        await clientA.storage.from(BRANDING_BUCKET).createSignedUrl(brandingObjectKey, 60);

      ok(
        ownLogoErr === null && ownLogoUrl !== null,
        "R-A14: Admin A can create a signed URL for their own logo"
      );

      // R-A16 — Admin B CANNOT create a signed URL for org A's logo
      const { data: crossLogoUrl, error: crossLogoErr } =
        await clientB.storage.from(BRANDING_BUCKET).createSignedUrl(brandingObjectKey, 60);

      const brandingCrossDenied =
        crossLogoErr !== null ||
        crossLogoUrl === null ||
        crossLogoUrl.signedUrl === null;

      ok(
        brandingCrossDenied,
        "R-A16: Admin B CANNOT create a signed URL for org A logo (cross-tenant denied)"
      );

      if (crossLogoUrl?.signedUrl) {
        const crossProbe = await fetch(crossLogoUrl.signedUrl);
        ok(
          crossProbe.status >= 400,
          `R-A16 (extra): Cross-org branding signed URL is non-functional (HTTP ${crossProbe.status})`
        );
      } else {
        ok(
          true,
          "R-A16 (extra): No signed URL returned for cross-org logo (denial at API level)"
        );
      }

      // R-A17 — Public URL returns 400/404 (bucket is private, never public)
      const logoPubUrl = `${SUPABASE_URL}/storage/v1/object/public/${BRANDING_BUCKET}/${brandingObjectKey}`;
      const logoPubRes = await fetch(logoPubUrl);

      ok(
        logoPubRes.status === 400 || logoPubRes.status === 404,
        `R-A17: org-branding public URL returns ${logoPubRes.status} — bucket is private`
      );
    }
  } finally {
    // ------------------------------------------------------------------
    // Teardown — best-effort, order: object → users → members → orgs
    // ------------------------------------------------------------------

    if (clientA && objectKey) {
      await clientA.storage.from(BUCKET).remove([objectKey]).then(
        () => {},
        () => {}
      );
    }

    if (clientA && brandingObjectKey) {
      await clientA.storage.from(BRANDING_BUCKET).remove([brandingObjectKey]).then(
        () => {},
        () => {}
      );
    }

    if (userAId) await deleteUser(userAId).catch(() => {});
    if (userBId) await deleteUser(userBId).catch(() => {});

    // Members and orgs — direct SQL (cascade from user delete may have cleaned them)
    await sql`
      DELETE FROM shared.org_members
      WHERE org_id IN (${orgAId}::uuid, ${orgBId}::uuid)
    `.catch(() => {});

    await sql`
      DELETE FROM shared.organizations
      WHERE id IN (${orgAId}::uuid, ${orgBId}::uuid)
    `.catch(() => {});

    await sql.end();
  }

  // ------------------------------------------------------------------
  // Report
  // ------------------------------------------------------------------
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
