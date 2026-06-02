-- R3, R4: shared tenant tables

-- ---------------------------------------------------------------------------
-- 3.1 organizations (tenant anchor)
-- ---------------------------------------------------------------------------
create table shared.organizations (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  tier       text        not null default 'starter'
                         check (tier in ('starter', 'pro')),
  product    text        not null default 'inmo',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3.2 org_members (user ↔ org ↔ role)
-- ---------------------------------------------------------------------------
create table shared.org_members (
  org_id     uuid not null references shared.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null
             check (role in ('admin', 'agent', 'owner', 'tenant')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on shared.org_members (user_id);

-- ---------------------------------------------------------------------------
-- 3.3 user_profiles (cross-nodo identity / display)
-- ---------------------------------------------------------------------------
create table shared.user_profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3.4 indices (IPC/ICL reference data)
-- ---------------------------------------------------------------------------
create table shared.indices (
  id         uuid           primary key default gen_random_uuid(),
  kind       text           not null check (kind in ('IPC', 'ICL')),
  period     date           not null,
  value      numeric(15, 6) not null,
  source     text           not null default 'INDEC',
  created_at timestamptz    not null default now(),
  unique (kind, period)
);

-- ---------------------------------------------------------------------------
-- 3.5 nodo_id (Pro / Phase 2 placeholder — structure only)
-- ---------------------------------------------------------------------------
create table shared.nodo_id (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null references shared.organizations(id) on delete cascade,
  product    text        not null,
  created_at timestamptz not null default now(),
  unique (org_id, product)
);
