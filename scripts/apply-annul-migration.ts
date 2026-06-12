/**
 * Applies the annul_payment RPC migration to the linked Supabase database.
 *
 * Usage (remote — get connection string from Supabase Dashboard → Database):
 *   DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
 *   npx tsx scripts/apply-annul-migration.ts
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "Falta DATABASE_URL.\n\n" +
      "1. Abrí https://supabase.com/dashboard/project/iprrlgmhpsxzyrejabtu/settings/database\n" +
      "2. Copiá la connection string (URI) de Postgres\n" +
      "3. Ejecutá en PowerShell:\n\n" +
      '   $env:DATABASE_URL="postgresql://..."\n' +
      "   npx tsx scripts/apply-annul-migration.ts\n",
  );
  process.exit(1);
}

const sqlFile = resolve(
  __dirname,
  "../supabase/migrations/20260612160000_annul_payment_rpc.sql",
);

const migrationSql = readFileSync(sqlFile, "utf8");
const db = postgres(DATABASE_URL, { max: 1 });

try {
  await db.unsafe(migrationSql);
  console.log("✓ Migración annul_payment aplicada correctamente.");

  const check = await db`
    select proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'nodo_inmo' and p.proname = 'annul_payment'
  `;
  if (check.length > 0) {
    console.log("✓ Función nodo_inmo.annul_payment verificada en la base.");
  } else {
    console.warn("⚠ No se encontró la función después de aplicar. Revisá permisos.");
  }
} catch (err) {
  console.error("Error aplicando migración:", err);
  process.exit(1);
} finally {
  await db.end();
}
