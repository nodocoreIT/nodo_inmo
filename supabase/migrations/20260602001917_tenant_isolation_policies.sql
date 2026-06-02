-- R2, R7–R12: Schema grants + table grants + RLS policies for shared tables.
--
-- Authorization claims come from app_metadata ONLY (never user_metadata).
-- Policies use the InitPlan-friendly form `(select auth.jwt()) -> ...`: this
-- wraps only auth.jwt() in the InitPlan so the JWT object is fetched once per
-- statement and fields are extracted per row. This is the form Supabase's
-- auth_rls_initplan advisor expects and is semantically optimal.
-- Every UPDATE/ALL-equivalent policy carries both USING and WITH CHECK.
-- org_members write access is split into explicit INSERT/UPDATE/DELETE policies
-- (not a single FOR ALL) so there is exactly one permissive SELECT policy.

-- ---------------------------------------------------------------------------
-- Schema and table grants (R2)
-- ---------------------------------------------------------------------------
grant usage on schema shared    to authenticated, anon;
grant usage on schema nodo_inmo to authenticated;

-- shared table grants for authenticated
grant select, insert, update, delete on shared.organizations  to authenticated;
grant select, insert, update, delete on shared.org_members    to authenticated;
grant select, insert, update, delete on shared.user_profiles  to authenticated;
grant select                         on shared.indices         to authenticated;
grant select, insert, update, delete on shared.nodo_id        to authenticated;

-- Default privileges: future nodo_inmo tables inherit grants automatically
alter default privileges in schema nodo_inmo
  grant select, insert, update, delete on tables to authenticated;
-- shared: read-only by default (writable tables get explicit grants above)
alter default privileges in schema shared
  grant select on tables to authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies — shared.organizations
-- R7: a user sees only their own org (SELECT scoped by app_metadata.org_id)
-- R9: UPDATE carries USING + WITH CHECK so org_id cannot be reassigned
-- (no INSERT policy: org creation is server-side via service role at onboarding)
-- ---------------------------------------------------------------------------
create policy "org_read_own" on shared.organizations
  for select to authenticated
  using (
    id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "org_update_own" on shared.organizations
  for update to authenticated
  using (
    id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  with check (
    id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

-- ---------------------------------------------------------------------------
-- RLS policies — shared.org_members
-- R7: members of an org can read the membership of their org (single SELECT)
-- R10: only admins can write membership — explicit INSERT/UPDATE/DELETE.
--      Uses the JWT role claim, NOT a self-join (avoids RLS recursion).
-- ---------------------------------------------------------------------------
create policy "members_read_same_org" on shared.org_members
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "members_admin_insert" on shared.org_members
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "members_admin_update" on shared.org_members
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "members_admin_delete" on shared.org_members
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

-- ---------------------------------------------------------------------------
-- RLS policies — shared.user_profiles
-- R11: a user can read and write only their own profile
-- ---------------------------------------------------------------------------
create policy "profile_own" on shared.user_profiles
  for all to authenticated
  using (
    id = (select auth.uid())
  )
  with check (
    id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RLS policies — shared.indices
-- R12: all authenticated can SELECT; no INSERT/UPDATE/DELETE policy means
--      writes by authenticated are blocked (service role bypasses RLS)
-- ---------------------------------------------------------------------------
create policy "indices_read_all" on shared.indices
  for select to authenticated
  using ( true );

-- ---------------------------------------------------------------------------
-- RLS policies — shared.nodo_id
-- R7: read within own org
-- R9: UPDATE carries USING + WITH CHECK
-- (no INSERT policy: nodo_id rows are created server-side via service role)
-- ---------------------------------------------------------------------------
create policy "nodo_id_read_own" on shared.nodo_id
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );

create policy "nodo_id_update_own" on shared.nodo_id
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
  );
