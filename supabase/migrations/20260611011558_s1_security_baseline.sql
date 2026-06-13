-- S1 — Security baseline (gap analysis G1, G2, G3-interim, G12).
-- See nodo-core/docs/architecture/05-gap-analysis.md for the full rationale.
--
-- G1: nodo_core internal tables were readable/writable by ANY authenticated
--     user of the shared Supabase project — including provisioned INMO client
--     users. Every `using (true)` policy is replaced by a team-membership gate.
-- G2: shared.organizations was updatable by any org member (tier self-upgrade).
--     The UPDATE policy is dropped: billing fields are written only by
--     nodo-core through the service role.
-- G3 (interim): tenant admins could insert unlimited org_members rows,
--     including new admins. Client-side writes now cannot create, modify or
--     delete admin memberships; full seat enforcement lands in S2.
-- G12: anon had USAGE on schema shared without needing it.
--
-- Ownership note: the nodo_core schema is owned by the nodo-core app, but this
-- repo hosts the single migration pipeline for the shared database until the
-- monorepo merge (slice S6). The `if not exists` statements below are no-ops
-- against the remote (where nodo_core already exists, created out-of-band) and
-- act as a minimal local fixture so `supabase db reset` and tests work.

-- ---------------------------------------------------------------------------
-- G2 — shared.organizations / shared.nodo_id: drop client-side UPDATE
-- No app updates these tables with the anon key (verified: nodo-inmo never
-- touches them; nodo-core uses the service role). A branding-only policy
-- will be reintroduced in S6 when the branding column exists.
-- ---------------------------------------------------------------------------
drop policy if exists "org_update_own" on shared.organizations;
drop policy if exists "nodo_id_update_own" on shared.nodo_id;

revoke update on shared.organizations from authenticated;
revoke update on shared.nodo_id       from authenticated;

-- ---------------------------------------------------------------------------
-- G3 (interim) — shared.org_members: client-side writes cannot touch admins.
-- Creating or promoting admins is exclusively a nodo-core/service-role
-- operation. USING excludes admin rows (cannot modify/delete an admin);
-- WITH CHECK excludes the admin value (cannot insert/promote to admin).
-- ---------------------------------------------------------------------------
drop policy if exists "members_admin_insert" on shared.org_members;
create policy "members_admin_insert" on shared.org_members
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
    and role <> 'admin'
  );

drop policy if exists "members_admin_update" on shared.org_members;
create policy "members_admin_update" on shared.org_members
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
    and role <> 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
    and role <> 'admin'
  );

drop policy if exists "members_admin_delete" on shared.org_members;
create policy "members_admin_delete" on shared.org_members
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
    and role <> 'admin'
  );

-- ---------------------------------------------------------------------------
-- G12 — anon does not need the shared namespace (it has no table grants).
-- (The landing contact form writes to nodo_core.contact_leads, not shared.)
-- ---------------------------------------------------------------------------
revoke usage on schema shared from anon;

-- ---------------------------------------------------------------------------
-- G1 — nodo_core schema: gate every table to NODO CORE team members.
-- ---------------------------------------------------------------------------
-- No-op on the remote; local fixture for db reset / tests (see header note).
create schema if not exists nodo_core;

create table if not exists nodo_core.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text,
  created_at timestamptz not null default now()
);

create table if not exists nodo_core.contact_leads (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text,
  message    text,
  created_at timestamptz not null default now()
);

-- Make grants explicit and reproducible (the remote ones were applied
-- out-of-band). RLS — not grants — is the row-level boundary here.
grant usage on schema nodo_core to authenticated, anon;
grant select, insert, update, delete on all tables in schema nodo_core to authenticated;
alter default privileges in schema nodo_core
  grant select, insert, update, delete on tables to authenticated;

-- Membership in the internal team == having a row in nodo_core.profiles.
-- SECURITY DEFINER only to read profiles without recursing into its own
-- RLS; it derives identity from auth.uid() and takes no parameters, so it
-- cannot be used to probe other users.
-- WARNING: do NOT change to SECURITY INVOKER — the team_select policy on
-- nodo_core.profiles calls this function; invoker rights would recurse.
create or replace function nodo_core.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from nodo_core.profiles p
    where p.id = (select auth.uid())
  );
$$;

revoke execute on function nodo_core.is_team_member() from public, anon;
grant  execute on function nodo_core.is_team_member() to authenticated;

-- Replace every policy on every nodo_core table with the team gate.
-- Policy names on tables created outside version control are unknown,
-- so all existing policies are dropped dynamically first.
-- DESTRUCTIVE BY DESIGN on the remote policy set: every pre-existing
-- nodo_core policy (all known ones are `using (true)`) is wiped and
-- replaced by the uniform team gate. Per-role hardening inside the team
-- (e.g. vault_entries admin-only) is tracked as S1.1 — product decision.
do $$
declare
  t record;
  pol record;
begin
  for t in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'nodo_core'
      and c.relkind = 'r'
  loop
    -- RLS on, no exceptions (idempotent if already enabled)
    execute format('alter table nodo_core.%I enable row level security', t.table_name);

    for pol in
      select policyname
      from pg_policies
      where schemaname = 'nodo_core' and tablename = t.table_name
    loop
      execute format('drop policy %I on nodo_core.%I', pol.policyname, t.table_name);
    end loop;

    -- Team-only access. Finer per-role rules inside the team are a product
    -- decision tracked for S1.1; this closes the cross-tenant leak now.
    execute format(
      'create policy team_select on nodo_core.%I for select to authenticated
         using ((select nodo_core.is_team_member()))', t.table_name);
    execute format(
      'create policy team_insert on nodo_core.%I for insert to authenticated
         with check ((select nodo_core.is_team_member()))', t.table_name);
    execute format(
      'create policy team_update on nodo_core.%I for update to authenticated
         using ((select nodo_core.is_team_member()))
         with check ((select nodo_core.is_team_member()))', t.table_name);
    execute format(
      'create policy team_delete on nodo_core.%I for delete to authenticated
         using ((select nodo_core.is_team_member()))', t.table_name);
  end loop;
end $$;

-- Exception: the public landing contact form inserts leads anonymously
-- (nodo-core server action runs with the anon key). Reads stay team-only.
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'nodo_core' and c.relname = 'contact_leads' and c.relkind = 'r'
  ) then
    execute 'drop policy if exists team_insert on nodo_core.contact_leads';
    execute 'create policy leads_public_insert on nodo_core.contact_leads
               for insert to anon, authenticated
               with check (true)';
    -- anon needs the table-level INSERT too (RLS alone is not enough).
    execute 'grant insert on nodo_core.contact_leads to anon';
  end if;
end $$;
