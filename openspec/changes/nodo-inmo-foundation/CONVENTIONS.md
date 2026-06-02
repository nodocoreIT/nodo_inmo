# nodo-inmo-foundation — Developer Conventions

## RLS Template A — staff-shared

Use for operational tables (properties, contracts, owners, tenants, rent collection).
Any internal staff (`admin` or `agent`) in the org can read and write.

```sql
-- Replace <t> with the actual table name.
alter table nodo_inmo.<t> enable row level security;

create policy "org_select" on nodo_inmo.<t> for select to authenticated
  using ( org_id = (select (auth.jwt() -> 'app_metadata' ->> 'org_id'))::uuid );

create policy "org_insert" on nodo_inmo.<t> for insert to authenticated
  with check ( org_id = (select (auth.jwt() -> 'app_metadata' ->> 'org_id'))::uuid );

create policy "org_update" on nodo_inmo.<t> for update to authenticated
  using  ( org_id = (select (auth.jwt() -> 'app_metadata' ->> 'org_id'))::uuid )
  with check ( org_id = (select (auth.jwt() -> 'app_metadata' ->> 'org_id'))::uuid );

create policy "org_delete" on nodo_inmo.<t> for delete to authenticated
  using ( org_id = (select (auth.jwt() -> 'app_metadata' ->> 'org_id'))::uuid );
```

## RLS Template B — admin-only

Use for sensitive tables (caja/cash movements, bank accounts, financial reports).
Only users with `role = 'admin'` in the org can read or write.

```sql
-- Replace <t> with the actual table name.
alter table nodo_inmo.<t> enable row level security;

create policy "admin_select" on nodo_inmo.<t> for select to authenticated
  using (
    org_id = (select (auth.jwt() -> 'app_metadata' ->> 'org_id'))::uuid
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "admin_insert" on nodo_inmo.<t> for insert to authenticated
  with check (
    org_id = (select (auth.jwt() -> 'app_metadata' ->> 'org_id'))::uuid
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "admin_update" on nodo_inmo.<t> for update to authenticated
  using (
    org_id = (select (auth.jwt() -> 'app_metadata' ->> 'org_id'))::uuid
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    org_id = (select (auth.jwt() -> 'app_metadata' ->> 'org_id'))::uuid
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "admin_delete" on nodo_inmo.<t> for delete to authenticated
  using (
    org_id = (select (auth.jwt() -> 'app_metadata' ->> 'org_id'))::uuid
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
```

## Module → Role Matrix

| Module                       | admin | agent | Template |
|------------------------------|:-----:|:-----:|----------|
| Properties                   |  yes  |  yes  | A        |
| Owners / Tenants             |  yes  |  yes  | A        |
| Contracts                    |  yes  |  yes  | A        |
| Rent collection (payments)   |  yes  |  yes  | A        |
| Cash / Caja movements        |  yes  |  no   | B        |
| Bank accounts                |  yes  |  no   | B        |
| Financial reports            |  yes  |  no   | B        |

Each future module change MUST pick Template A or B explicitly. The UI hides
what the role cannot access, but that is presentation only — the RLS gate
(Template B policy) is the authority (R18).

## refreshSession() convention (R14)

After any operation that changes a user's `role`, `org_id`, or `tier`, the client
MUST call:

```ts
await supabase.auth.refreshSession();
```

This forces the Supabase client to fetch a new JWT so the updated `app_metadata`
claims (synced by the `sync_member_claims` trigger) are reflected in subsequent
requests. Without this call, RLS queries continue to use the stale JWT until the
token naturally expires.

Affected operations:
- Adding a user to an org (`org_members` INSERT)
- Changing a user's role (`org_members` UPDATE role)
- Moving a user to a different org (`org_members` UPDATE org_id)
- Tier change that affects access

This convention applies to all Nodo products using the `shared` schema.

## Integration test (manual, not pgTAP)

To verify end-to-end claim propagation (R13):

1. `supabase start` + `supabase functions serve sync-member-claims`
2. Set `SYNC_CLAIMS_SECRET` in `.env.local` for the function.
3. As an admin, update a user's role in `shared.org_members`.
4. In the client, call `await supabase.auth.refreshSession()`.
5. Inspect the decoded JWT — `app_metadata.role` must reflect the new value.

This cannot be expressed as a pure pgTAP test because it requires a live auth
service and a served Edge Function.
