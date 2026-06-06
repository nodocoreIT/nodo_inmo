/**
 * seed-local.ts
 *
 * Populates the local Supabase DB with realistic fictitious data for testing.
 * Safe to run multiple times — clears existing seed data first (by org).
 *
 * Usage:
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role_key from `supabase status`> \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *   npx tsx scripts/seed-local.ts
 */

import postgres from "postgres";

function require_env(name: string): string {
  const val = process.env[name];
  if (!val) { console.error(`ERROR: ${name} not set`); process.exit(1); }
  return val;
}

const DATABASE_URL = require_env("DATABASE_URL");
const SUPABASE_URL = require_env("SUPABASE_URL");
const SERVICE_ROLE_KEY = require_env("SUPABASE_SERVICE_ROLE_KEY");

const sql = postgres(DATABASE_URL, { max: 1 });

// ── Helpers — pure string arithmetic, no timezone issues ─────────────────────

function addMonths(isoYearMonth: string, n: number): string {
  const [y, m] = isoYearMonth.split('-').map(Number);
  const total = (y * 12 + m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

function firstOfMonth(yearMonth: string): string {
  return `${yearMonth}-01`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Get org_id for the local admin
  const [org] = await sql`
    SELECT org_id FROM shared.org_members LIMIT 1
  `;
  if (!org) {
    console.error("No org found. Run bootstrap-admin first.");
    process.exit(1);
  }
  const ORG_ID = org.org_id as string;
  console.log(`Seeding org: ${ORG_ID}`);

  // 2. Clean previous seed data (contacts cascade to properties, contracts, etc.)
  console.log("Cleaning previous seed data...");
  await sql`DELETE FROM nodo_inmo.property_expenses WHERE org_id = ${ORG_ID}`;
  await sql`DELETE FROM nodo_inmo.cash_movements WHERE org_id = ${ORG_ID}`;
  await sql`DELETE FROM nodo_inmo.owner_settlements WHERE org_id = ${ORG_ID}`;
  await sql`DELETE FROM nodo_inmo.payments WHERE org_id = ${ORG_ID}`;
  await sql`DELETE FROM nodo_inmo.contracts WHERE org_id = ${ORG_ID}`;
  await sql`DELETE FROM nodo_inmo.properties WHERE org_id = ${ORG_ID}`;
  await sql`DELETE FROM nodo_inmo.org_profiles WHERE org_id = ${ORG_ID}`;
  await sql`DELETE FROM nodo_inmo.contacts WHERE org_id = ${ORG_ID}`;

  // 3. Agency profile
  console.log("Inserting agency profile...");
  await sql`
    INSERT INTO nodo_inmo.org_profiles (org_id, legal_name, address, cuit, phone, email)
    VALUES (
      ${ORG_ID},
      'Mi Agencia Inmobiliaria S.R.L.',
      'Av. Santa Fe 1234, CABA',
      '30-71234567-8',
      '011-4567-8901',
      'info@miagencia.com.ar'
    )
  `;

  // 4. Contacts — owners
  console.log("Inserting contacts...");
  const [owner1] = await sql`
    INSERT INTO nodo_inmo.contacts (org_id, name, email, phone, dni, commission_rate, roles)
    VALUES (${ORG_ID}, 'Roberto Fernández', 'roberto@gmail.com', '11-4567-1234', '20345678', 10, ARRAY['owner'])
    RETURNING id
  `;
  const [owner2] = await sql`
    INSERT INTO nodo_inmo.contacts (org_id, name, email, phone, dni, commission_rate, roles)
    VALUES (${ORG_ID}, 'María González', 'maria.gonzalez@hotmail.com', '11-5678-2345', '27456789', 8, ARRAY['owner'])
    RETURNING id
  `;
  const [owner3] = await sql`
    INSERT INTO nodo_inmo.contacts (org_id, name, email, phone, dni, commission_rate, roles)
    VALUES (${ORG_ID}, 'Carlos Méndez', 'cmendez@yahoo.com', '11-6789-3456', '30567890', 12, ARRAY['owner'])
    RETURNING id
  `;

  // Contacts — tenants
  const [tenant1] = await sql`
    INSERT INTO nodo_inmo.contacts (org_id, name, email, phone, dni, commission_rate, roles)
    VALUES (${ORG_ID}, 'Ana García', 'ana.garcia@gmail.com', '11-2345-6789', '35678901', 0, ARRAY['tenant'])
    RETURNING id
  `;
  const [tenant2] = await sql`
    INSERT INTO nodo_inmo.contacts (org_id, name, email, phone, dni, commission_rate, roles)
    VALUES (${ORG_ID}, 'Lucas Martínez', 'lucas.m@gmail.com', '11-3456-7890', '38789012', 0, ARRAY['tenant'])
    RETURNING id
  `;
  const [tenant3] = await sql`
    INSERT INTO nodo_inmo.contacts (org_id, name, email, phone, dni, commission_rate, roles)
    VALUES (${ORG_ID}, 'Sofía López', 'sofia.lopez@outlook.com', '11-4567-8901', '40890123', 0, ARRAY['tenant'])
    RETURNING id
  `;
  const [tenant4] = await sql`
    INSERT INTO nodo_inmo.contacts (org_id, name, email, phone, dni, commission_rate, roles)
    VALUES (${ORG_ID}, 'Diego Ramírez', 'diego.r@gmail.com', '11-5678-9012', '42901234', 0, ARRAY['tenant'])
    RETURNING id
  `;

  // 5. Properties
  console.log("Inserting properties...");
  const [prop1] = await sql`
    INSERT INTO nodo_inmo.properties (org_id, address, property_type, operation, status, currency, rooms, total_sqm, owner_id, commission_rate)
    VALUES (${ORG_ID}, 'Av. Corrientes 1234 3°B, CABA', 'apartment', 'rent', 'rented', 'ARS', 2, 55, ${owner1.id}, 10)
    RETURNING id
  `;
  const [prop2] = await sql`
    INSERT INTO nodo_inmo.properties (org_id, address, property_type, operation, status, currency, rooms, total_sqm, owner_id, commission_rate)
    VALUES (${ORG_ID}, 'Thames 567 1°A, Palermo', 'apartment', 'rent', 'rented', 'ARS', 3, 75, ${owner2.id}, 8)
    RETURNING id
  `;
  const [prop3] = await sql`
    INSERT INTO nodo_inmo.properties (org_id, address, property_type, operation, status, currency, rooms, total_sqm, owner_id, commission_rate)
    VALUES (${ORG_ID}, 'Av. Cabildo 890 PH, Belgrano', 'apartment', 'rent', 'rented', 'ARS', 4, 120, ${owner1.id}, 10)
    RETURNING id
  `;
  const [prop4] = await sql`
    INSERT INTO nodo_inmo.properties (org_id, address, property_type, operation, status, currency, rooms, total_sqm, owner_id, commission_rate)
    VALUES (${ORG_ID}, 'Defensa 432 PB, San Telmo', 'commercial', 'rent', 'available', 'ARS', null, 80, ${owner3.id}, 12)
    RETURNING id
  `;

  // 6. Contracts (3 active, 1 draft without tenant)
  console.log("Inserting contracts...");

  const [contract1] = await sql`
    INSERT INTO nodo_inmo.contracts
      (org_id, property_id, tenant_id, status, currency, rent_amount, start_date, end_date, adjustment_index, adjustment_period_months, expenses_paid_by, deposit_amount)
    VALUES
      (${ORG_ID}, ${prop1.id}, ${tenant1.id}, 'active', 'ARS', 250000, '2026-01-01', '2027-01-01', 'ICL', 3, 'tenant', 500000)
    RETURNING id
  `;
  const [contract2] = await sql`
    INSERT INTO nodo_inmo.contracts
      (org_id, property_id, tenant_id, status, currency, rent_amount, start_date, end_date, adjustment_index, adjustment_period_months, expenses_paid_by, deposit_amount)
    VALUES
      (${ORG_ID}, ${prop2.id}, ${tenant2.id}, 'active', 'ARS', 320000, '2026-02-01', '2027-02-01', 'IPC', 3, 'tenant', 640000)
    RETURNING id
  `;
  const [contract3] = await sql`
    INSERT INTO nodo_inmo.contracts
      (org_id, property_id, tenant_id, status, currency, rent_amount, start_date, end_date, adjustment_index, adjustment_period_months, expenses_paid_by, deposit_amount)
    VALUES
      (${ORG_ID}, ${prop3.id}, ${tenant3.id}, 'active', 'ARS', 180000, '2026-03-01', '2027-03-01', 'ICL', 3, 'owner', 360000)
    RETURNING id
  `;

  // 7. Payments — pure string-based dates, no timezone issues
  console.log("Inserting payments...");

  type PaymentInsert = {
    org_id: string;
    contract_id: string;
    currency: string;
    amount: number;
    period: string;
    due_date: string;
    status: string;
  };

  const payments: PaymentInsert[] = [];

  // Contract 1: Jan–Jun 2026. Jan-Apr paid, May-Jun pending (overdue/current)
  for (const [i, status] of (['paid','paid','paid','paid','pending','pending'] as const).entries()) {
    const ym = addMonths('2026-01', i);
    payments.push({ org_id: ORG_ID, contract_id: contract1.id, currency: 'ARS', amount: 250000, period: ym, due_date: firstOfMonth(ym), status });
  }

  // Contract 2: Feb–Jun 2026. Feb-Apr paid, May-Jun pending
  for (const [i, status] of (['paid','paid','paid','pending','pending'] as const).entries()) {
    const ym = addMonths('2026-02', i);
    payments.push({ org_id: ORG_ID, contract_id: contract2.id, currency: 'ARS', amount: 320000, period: ym, due_date: firstOfMonth(ym), status });
  }

  // Contract 3: Mar–Jun 2026. Mar paid, Apr-Jun pending (overdue/current)
  for (const [i, status] of (['paid','pending','pending','pending'] as const).entries()) {
    const ym = addMonths('2026-03', i);
    payments.push({ org_id: ORG_ID, contract_id: contract3.id, currency: 'ARS', amount: 180000, period: ym, due_date: firstOfMonth(ym), status });
  }

  // Insert all payments as 'pending' first (trigger fires on status change to 'paid')
  const insertedPayments: { id: string; contract_id: string; status: string; due_date: string; amount: number }[] = [];
  for (const p of payments) {
    const [row] = await sql`
      INSERT INTO nodo_inmo.payments
        (org_id, contract_id, currency, amount, period, due_date, status)
      VALUES
        (${p.org_id}, ${p.contract_id}, ${p.currency}, ${p.amount}, ${p.period}, ${p.due_date}, 'pending')
      RETURNING id, contract_id, due_date, amount
    `;
    insertedPayments.push({ ...row, status: p.status });
  }

  // Update paid ones → triggers post_payment_to_caja
  console.log("Marking payments as paid (triggering caja cascade)...");
  for (const p of insertedPayments) {
    if (p.status === 'paid') {
      await sql`
        UPDATE nodo_inmo.payments
        SET status = 'paid', paid_date = ${p.due_date}, paid_amount = ${p.amount}, payment_method = 'transfer'
        WHERE id = ${p.id}
      `;
    }
  }

  // 8. Property expenses
  console.log("Inserting property expenses...");
  await sql`
    INSERT INTO nodo_inmo.property_expenses (org_id, property_id, type, amount, expense_date, description, charged_to_owner)
    VALUES
      (${ORG_ID}, ${prop1.id}, 'arreglo', 15000, '2026-05-10', 'Reparación canilla baño', true),
      (${ORG_ID}, ${prop1.id}, 'compra_accesorio', 8500, '2026-04-20', 'Cerradura nueva puerta entrada', false),
      (${ORG_ID}, ${prop2.id}, 'arreglo', 32000, '2026-05-15', 'Pintura interior departamento', true),
      (${ORG_ID}, ${prop3.id}, 'arreglo', 12000, '2026-04-05', 'Reparación persiana living', true),
      (${ORG_ID}, ${prop3.id}, 'compra_accesorio', 25000, '2026-05-22', 'Termotanque nuevo', true),
      (${ORG_ID}, ${prop4.id}, 'arreglo', 45000, '2026-05-30', 'Pintura frente local', false)
  `;

  // 9. Summary
  const [pmtCount] = await sql`SELECT count(*) FROM nodo_inmo.payments WHERE org_id = ${ORG_ID}`;
  const [paidCount] = await sql`SELECT count(*) FROM nodo_inmo.payments WHERE org_id = ${ORG_ID} AND status = 'paid'`;
  const [settlCount] = await sql`SELECT count(*) FROM nodo_inmo.owner_settlements WHERE org_id = ${ORG_ID}`;
  const [movCount] = await sql`SELECT count(*) FROM nodo_inmo.cash_movements WHERE org_id = ${ORG_ID}`;

  console.log("\n✓ Seed complete:");
  console.log(`  Contacts:           3 owners + 4 tenants`);
  console.log(`  Properties:         4 (3 alquiladas, 1 disponible)`);
  console.log(`  Contracts:          3 activos`);
  console.log(`  Payments total:     ${pmtCount.count}`);
  console.log(`  Payments paid:      ${paidCount.count} (trigger fired)`);
  console.log(`  Owner settlements:  ${settlCount.count} (pending)`);
  console.log(`  Cash movements:     ${movCount.count}`);
  console.log(`  Property expenses:  6`);
  console.log("\nDashboard preview:");
  console.log(`  Pagos vencidos:     4 (May x2, Apr-May contract3)`);
  console.log(`  A rendir:           ~3 propietarios con saldo pendiente`);
  console.log(`  Contratos activos:  3`);
}

main()
  .catch((err) => { console.error("\nSeed failed:", err.message ?? err); process.exit(1); })
  .finally(() => sql.end());
