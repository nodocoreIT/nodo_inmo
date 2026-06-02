/**
 * sync-member-claims
 *
 * Called by the shared.sync_member_claims() Postgres trigger via pg_net after
 * every INSERT or UPDATE of (role, org_id) on shared.org_members.
 *
 * Responsibilities:
 *   1. Verify the request comes from the trusted trigger (shared secret).
 *   2. Patch app_metadata for the affected user via the Supabase Admin API.
 *   3. Remain idempotent — patching the same values twice has no side effect.
 *   4. Log failures so they can be re-synced manually; never throw 5xx silently.
 *
 * Required environment variables (set via `supabase secrets set`):
 *   SUPABASE_URL              — project URL (auto-injected by Supabase)
 *   SUPABASE_SERVICE_ROLE_KEY — service-role JWT (auto-injected by Supabase)
 *   SYNC_CLAIMS_SECRET        — shared secret between trigger and this function
 *
 * The trigger sends:
 *   Authorization: Bearer <SYNC_CLAIMS_SECRET>
 *   Body: { user_id: string, org_id: string, role: string }
 */

// Pin to a stable Supabase JS release to avoid supply-chain drift.
// Update intentionally when upgrading the project's Supabase JS version.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

interface ClaimsPayload {
  user_id: string;
  org_id: string;
  role: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // ------------------------------------------------------------------
  // 1. Verify method
  // ------------------------------------------------------------------
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // ------------------------------------------------------------------
  // 2. Verify shared secret (trigger authentication)
  // ------------------------------------------------------------------
  const syncSecret = Deno.env.get("SYNC_CLAIMS_SECRET");
  if (!syncSecret) {
    console.error("sync-member-claims: SYNC_CLAIMS_SECRET not configured");
    return new Response("Internal Server Error: secret not configured", {
      status: 500,
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (token !== syncSecret) {
    console.warn("sync-member-claims: unauthorized request (bad secret)");
    return new Response("Unauthorized", { status: 401 });
  }

  // ------------------------------------------------------------------
  // 3. Parse payload
  // ------------------------------------------------------------------
  let payload: ClaimsPayload;
  try {
    payload = await req.json() as ClaimsPayload;
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  const { user_id, org_id, role } = payload;
  if (!user_id || !org_id || !role) {
    return new Response("Bad Request: missing user_id, org_id, or role", {
      status: 400,
    });
  }

  // ------------------------------------------------------------------
  // 4. Patch app_metadata via Supabase Admin API
  //    Uses service-role key (auto-injected by Supabase runtime).
  // ------------------------------------------------------------------
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "sync-member-claims: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set",
    );
    return new Response("Internal Server Error: admin client not configured", {
      status: 500,
    });
  }

  // createClient with service role bypasses RLS; used only for admin.updateUserById.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await adminClient.auth.admin.updateUserById(user_id, {
    app_metadata: { org_id, role },
  });

  if (error) {
    // Log the error so it can be investigated and manually re-synced.
    // Return 200 to prevent pg_net from retrying (retries are not idempotent
    // in pg_net's current fire-and-forget model; failures are visible in
    // net._http_response for manual inspection).
    console.error(
      `sync-member-claims: failed to update app_metadata for user ${user_id}`,
      error,
    );
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  console.log(
    `sync-member-claims: patched app_metadata for user ${user_id} → org_id=${org_id} role=${role}`,
  );

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
