# scripts/

Utility scripts for Nodo Inmo. Run with `npx tsx`.

---

## bootstrap-admin.ts

Creates the first admin user + organization. Idempotent.

### Required env vars

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Project URL (local: `http://127.0.0.1:54321`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** service role key — never commit this |
| `ADMIN_EMAIL` | Email for the admin user |
| `ADMIN_PASSWORD` | Password for the admin user |
| `ORG_NAME` | Organization name (default: `"Default Agency"`) |

> **SECURITY**: The service role key bypasses all RLS. Treat it like a root
> password. Never put it in `.env` files that are committed, CI logs, or
> client-side code.

### Local run

Get the service key from `supabase status` (look for `service_role key`).

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<paste-service-role-key-here> \
ADMIN_EMAIL=admin@nodoinmo.test \
ADMIN_PASSWORD=local-dev-only \
ORG_NAME="Mi Agencia" \
npx tsx scripts/bootstrap-admin.ts
```

### Remote run

Get the service key from Supabase Dashboard → Project Settings → API → `service_role` (secret).

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<remote-service-role-key> \
ADMIN_EMAIL=admin@tudominio.com \
ADMIN_PASSWORD=<strong-password> \
ORG_NAME="Mi Agencia" \
npx tsx scripts/bootstrap-admin.ts
```

### After bootstrap

The Custom Access Token Hook fires automatically at every sign-in and injects
`app_metadata.org_id` and `app_metadata.role` into the JWT. No manual step needed.

To verify the claims are present, sign in and decode the access token:

```bash
node -e "
const jwt = '<paste-access-token>';
const [, payload] = jwt.split('.');
console.log(JSON.parse(Buffer.from(payload, 'base64url').toString()));
"
```

Look for `app_metadata.org_id` and `app_metadata.role` in the output.
