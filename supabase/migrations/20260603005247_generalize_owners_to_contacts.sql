-- Generalize nodo_inmo.owners → nodo_inmo.contacts
--
-- People (owners, tenants, guarantors) are one entity playing roles.
-- This migration renames the table, adds the roles column, backfills
-- existing rows, renames indexes and the FK constraint for clarity.
--
-- What survives the rename automatically:
--   - RLS policies (PostgreSQL keeps them on the oid)
--   - updated_at trigger (kept on the oid)
--   - ALTER DEFAULT PRIVILEGES grants on the schema (not per-table)
--   - Column-level NOT NULL and check constraints
--
-- The FK from properties.owner_id → owners follows the rename automatically
-- (PostgreSQL FK is by oid, not by name). We rename the constraint below
-- so the schema stays self-documenting.

-- ---------------------------------------------------------------------------
-- 1. Rename table
-- ---------------------------------------------------------------------------
alter table nodo_inmo.owners rename to contacts;

-- ---------------------------------------------------------------------------
-- 2. Add roles column
--    text[] NOT NULL default '{}' with a check that every element is a
--    known role value. The <@ operator checks array containment:
--    roles <@ allowed means every element of roles is in allowed.
-- ---------------------------------------------------------------------------
alter table nodo_inmo.contacts
  add column roles text[] not null default '{}'
    check (roles <@ array['owner', 'tenant', 'guarantor']::text[]);

-- ---------------------------------------------------------------------------
-- 3. Backfill existing rows: they were all owners
-- ---------------------------------------------------------------------------
update nodo_inmo.contacts
   set roles = array['owner']::text[]
 where roles = '{}';

-- ---------------------------------------------------------------------------
-- 4. Rename org_id index for clarity
-- ---------------------------------------------------------------------------
alter index nodo_inmo.owners_org_id_idx rename to contacts_org_id_idx;

-- ---------------------------------------------------------------------------
-- 5. GIN index on roles for role-filtered queries
-- ---------------------------------------------------------------------------
create index contacts_roles_idx on nodo_inmo.contacts using gin (roles);

-- ---------------------------------------------------------------------------
-- 6. Rename FK constraint on properties for clarity
--    The FK already points to the (now renamed) contacts table; this is
--    purely cosmetic / documentary.
-- ---------------------------------------------------------------------------
alter table nodo_inmo.properties
  rename constraint properties_owner_id_fkey
               to properties_owner_contact_id_fkey;

-- ---------------------------------------------------------------------------
-- Note: RLS policies (org_select, org_insert, org_update, org_delete),
-- the set_updated_at trigger, and the default privileges grant on the
-- nodo_inmo schema all survive the table rename intact.
-- No additional GRANT or policy recreation is needed.
-- ---------------------------------------------------------------------------
