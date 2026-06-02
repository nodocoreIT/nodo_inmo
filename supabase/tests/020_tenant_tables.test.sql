-- Test: R3, R4 — Tenant table structure
begin;
select plan(40);

-- -----------------------------------------------------------------------
-- shared.organizations (R3)
-- -----------------------------------------------------------------------
select has_table('shared', 'organizations', 'table shared.organizations exists');
select col_is_pk('shared', 'organizations', 'id', 'organizations.id is primary key');
select has_column('shared', 'organizations', 'name',       'organizations has name');
select has_column('shared', 'organizations', 'tier',       'organizations has tier');
select has_column('shared', 'organizations', 'product',    'organizations has product');
select has_column('shared', 'organizations', 'created_at', 'organizations has created_at');

-- tier check: valid values (uses lives_ok — test passes if no exception raised)
select lives_ok(
  $q$ insert into shared.organizations (id, name, tier)
      values (gen_random_uuid(), 'starter-org', 'starter') $q$,
  'tier starter accepted'
);
select lives_ok(
  $q$ insert into shared.organizations (id, name, tier)
      values (gen_random_uuid(), 'pro-org', 'pro') $q$,
  'tier pro accepted'
);

-- tier check: invalid value rejected (throws_ok matches check_violation)
select throws_ok(
  $q$ insert into shared.organizations (id, name, tier)
      values (gen_random_uuid(), 'bad-org', 'enterprise') $q$,
  '23514',
  null,
  'tier check rejects invalid value (enterprise)'
);

-- -----------------------------------------------------------------------
-- shared.org_members (R4)
-- -----------------------------------------------------------------------
select has_table('shared', 'org_members', 'table shared.org_members exists');
select col_is_pk('shared', 'org_members', array['org_id','user_id'], 'org_members PK is (org_id, user_id)');
select has_column('shared', 'org_members', 'role',       'org_members has role');
select has_column('shared', 'org_members', 'created_at', 'org_members has created_at');

-- Seed org and users for role tests
insert into auth.users (id, email, encrypted_password, created_at, updated_at)
values
  ('00000000-0000-0000-0001-000000000001', 'admin@test.local',  'x', now(), now()),
  ('00000000-0000-0000-0001-000000000002', 'agent@test.local',  'x', now(), now()),
  ('00000000-0000-0000-0001-000000000003', 'owner@test.local',  'x', now(), now()),
  ('00000000-0000-0000-0001-000000000004', 'tenant@test.local', 'x', now(), now()),
  ('00000000-0000-0000-0001-000000000005', 'bad@test.local',    'x', now(), now());

insert into shared.organizations (id, name)
values ('00000000-0000-0000-0002-000000000001', 'role-test-org');

-- valid roles
select lives_ok(
  $q$ insert into shared.org_members (org_id, user_id, role)
      values ('00000000-0000-0000-0002-000000000001','00000000-0000-0000-0001-000000000001','admin') $q$,
  'role admin accepted'
);
select lives_ok(
  $q$ insert into shared.org_members (org_id, user_id, role)
      values ('00000000-0000-0000-0002-000000000001','00000000-0000-0000-0001-000000000002','agent') $q$,
  'role agent accepted'
);
select lives_ok(
  $q$ insert into shared.org_members (org_id, user_id, role)
      values ('00000000-0000-0000-0002-000000000001','00000000-0000-0000-0001-000000000003','owner') $q$,
  'role owner accepted'
);
select lives_ok(
  $q$ insert into shared.org_members (org_id, user_id, role)
      values ('00000000-0000-0000-0002-000000000001','00000000-0000-0000-0001-000000000004','tenant') $q$,
  'role tenant accepted'
);

-- invalid role rejected
insert into shared.organizations (id, name)
values ('00000000-0000-0000-0002-000000000099', 'bad-role-org');
select throws_ok(
  $q$ insert into shared.org_members (org_id, user_id, role)
      values ('00000000-0000-0000-0002-000000000099','00000000-0000-0000-0001-000000000005','superuser') $q$,
  '23514',
  null,
  'role check rejects invalid value (superuser)'
);

-- FK to organizations
select col_is_fk('shared', 'org_members', 'org_id', 'org_members.org_id FK to organizations');

-- user index exists
select has_index('shared', 'org_members', 'org_members_user_idx', 'user index exists on org_members');

-- -----------------------------------------------------------------------
-- shared.user_profiles
-- -----------------------------------------------------------------------
select has_table('shared', 'user_profiles', 'table shared.user_profiles exists');
select col_is_pk('shared', 'user_profiles', 'id', 'user_profiles.id is primary key');
select has_column('shared', 'user_profiles', 'full_name',  'user_profiles has full_name');
select has_column('shared', 'user_profiles', 'avatar_url', 'user_profiles has avatar_url');
select has_column('shared', 'user_profiles', 'created_at', 'user_profiles has created_at');

-- -----------------------------------------------------------------------
-- shared.indices (unique kind+period)
-- -----------------------------------------------------------------------
select has_table('shared', 'indices', 'table shared.indices exists');
select col_is_pk('shared', 'indices', 'id', 'indices.id is primary key');
select has_column('shared', 'indices', 'kind',       'indices has kind');
select has_column('shared', 'indices', 'period',     'indices has period');
select has_column('shared', 'indices', 'value',      'indices has value');
select has_column('shared', 'indices', 'source',     'indices has source');
select has_column('shared', 'indices', 'created_at', 'indices has created_at');

-- unique (kind, period)
insert into shared.indices (kind, period, value) values ('IPC', '2024-01-01', 1.23);
select throws_ok(
  $q$ insert into shared.indices (kind, period, value) values ('IPC', '2024-01-01', 9.99) $q$,
  '23505',
  null,
  'indices unique (kind, period) enforced'
);

-- kind check: invalid value rejected (only IPC / ICL allowed)
select throws_ok(
  $q$ insert into shared.indices (kind, period, value) values ('XYZ', '2024-02-01', 1.0) $q$,
  '23514',
  null,
  'indices kind check rejects invalid value (XYZ)'
);

-- -----------------------------------------------------------------------
-- shared.nodo_id (unique org+product)
-- -----------------------------------------------------------------------
select has_table('shared', 'nodo_id', 'table shared.nodo_id exists');
select col_is_pk('shared', 'nodo_id', 'id', 'nodo_id.id is primary key');
select has_column('shared', 'nodo_id', 'org_id',     'nodo_id has org_id');
select has_column('shared', 'nodo_id', 'product',    'nodo_id has product');
select has_column('shared', 'nodo_id', 'created_at', 'nodo_id has created_at');

-- unique (org_id, product)
insert into shared.organizations (id, name)
values ('00000000-0000-0000-0003-000000000001', 'nodo-id-org');
insert into shared.nodo_id (org_id, product)
values ('00000000-0000-0000-0003-000000000001', 'inmo');
select throws_ok(
  $q$ insert into shared.nodo_id (org_id, product)
      values ('00000000-0000-0000-0003-000000000001', 'inmo') $q$,
  '23505',
  null,
  'nodo_id unique (org_id, product) enforced'
);

select * from finish();
rollback;
