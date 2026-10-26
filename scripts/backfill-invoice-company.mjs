// Backfill job_cards.invoice_company / invoice_raised_at from existing sales_invoice_number,
// and re-snapshot bill_from for cards invoiced by an entity other than the one they carry
// (known case: 340b14c1-f21b-4605-a372-7e173fbe4094, P91TFPL/3/26-27, bill_from still says
// Plus Nine One Inc).
//
// Requires migrations/0015 (node scripts/apply-invoice-company.mjs).
//   Dry run (default, no writes):  node scripts/backfill-invoice-company.mjs
//   Write:                         node scripts/backfill-invoice-company.mjs --apply
//
// Entities come from system_settings.billing_entities when set, else the built-in defaults
// (keep in sync with server/services/billingEntities.ts). The bill_from re-snapshot is
// idempotent: after filling the new entity's GSTIN/address in Settings → Billing Entities,
// re-run with --apply to refresh the snapshot.
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const APPLY = process.argv.includes('--apply');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set.');
  process.exit(1);
}

const DEFAULT_ENTITIES = [
  {
    key: 'plus-nine-one-inc',
    name: 'Plus Nine One Inc',
    addressLine1: 'Ward 117, 49, Bannerghatta Rd, Ayappa Garden, Shanti Nagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560030',
    gstin: '29AMIPP3288M1Z6',
    pan: '',
    invoicePrefix: 'ST',
    effectiveFrom: null,
  },
  {
    key: 'plusnineone-tech-films',
    name: 'PLUSNINEONE TECH FILMS PRIVATE LIMITED',
    addressLine1: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    pan: '',
    invoicePrefix: 'P91TFPL',
    effectiveFrom: null,
  },
];

const snapshot = (e) => ({
  name: e.name,
  addressLine1: e.addressLine1 || '',
  city: e.city || '',
  state: e.state || '',
  pincode: e.pincode || '',
  gstin: e.gstin || '',
  ...(e.pan ? { pan: e.pan } : {}),
  entityKey: e.key,
});

const norm = (v) => String(v || '').trim().toLowerCase();
// Snapshot already reflects this entity (same company and same GSTIN/address) → leave it.
const snapshotCurrent = (bf, e) =>
  !!bf &&
  (bf.entityKey === e.key || norm(bf.name) === norm(e.name)) &&
  norm(bf.gstin) === norm(e.gstin) &&
  norm(bf.addressLine1) === norm(e.addressLine1);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'job_cards' AND column_name IN ('invoice_company','invoice_raised_at')`
  );
  if (cols.rows.length < 2) {
    console.error('❌ job_cards.invoice_company / invoice_raised_at missing — run node scripts/apply-invoice-company.mjs first.');
    process.exit(1);
  }

  const setting = await client.query(`SELECT value FROM system_settings WHERE key = 'billing_entities'`);
  const entities = Array.isArray(setting.rows[0]?.value) && setting.rows[0].value.length ? setting.rows[0].value : DEFAULT_ENTITIES;
  console.log(`Entities (${setting.rows[0] ? 'system_settings' : 'built-in defaults'}): ${entities.map((e) => `${e.invoicePrefix}→${e.key}`).join(', ')}`);

  const { rows } = await client.query(
    `SELECT id, sales_invoice_number, invoice_company, invoice_raised_at, payment_settled_at,
            bill_from, partner_billed_directly
       FROM job_cards
      WHERE sales_invoice_number IS NOT NULL AND trim(sales_invoice_number) <> ''
      ORDER BY payment_settled_at NULLS LAST`
  );

  const plan = [];
  const unmatched = [];
  const blankEntity = [];
  for (const r of rows) {
    const no = String(r.sales_invoice_number).trim().toUpperCase();
    const entity = entities.find((e) => no.startsWith(`${String(e.invoicePrefix).toUpperCase()}/`));
    const change = { id: r.id, no: r.sales_invoice_number };
    if (!entity) {
      unmatched.push(r.sales_invoice_number);
    } else if (r.invoice_company !== entity.key) {
      change.invoiceCompany = entity.key;
    }
    if (!r.invoice_raised_at && r.payment_settled_at) change.invoiceRaisedAt = r.payment_settled_at;
    if (entity && !r.partner_billed_directly && !snapshotCurrent(r.bill_from, entity)) {
      change.billFrom = snapshot(entity);
      change.oldBillFromName = r.bill_from?.name ?? null;
      if (!entity.gstin || !entity.addressLine1) blankEntity.push(`${r.id} (${r.sales_invoice_number}) → ${entity.key}`);
    }
    if (change.invoiceCompany || change.invoiceRaisedAt || change.billFrom) plan.push(change);
  }

  const byCompany = plan.reduce((m, c) => ((m[c.invoiceCompany || '(unchanged)'] = (m[c.invoiceCompany || '(unchanged)'] || 0) + 1), m), {});
  console.log(`\nJob cards with an invoice number: ${rows.length}`);
  console.log(`Rows to update: ${plan.length}`);
  console.log(`  invoice_company set:`, byCompany);
  console.log(`  invoice_raised_at set: ${plan.filter((c) => c.invoiceRaisedAt).length}`);
  const bfChanges = plan.filter((c) => c.billFrom);
  console.log(`  bill_from re-snapshotted: ${bfChanges.length}`);
  for (const c of bfChanges) console.log(`    ${c.id}  ${c.no}  "${c.oldBillFromName}" → "${c.billFrom.name}"`);
  if (blankEntity.length) {
    console.log(`\n⚠️  These get the entity NAME with a still-blank GSTIN/address. Fill the entity in`);
    console.log(`    Settings → Billing Entities and re-run — the snapshot is refreshed on the next run:`);
    for (const s of blankEntity) console.log(`    ${s}`);
  }
  const counts = unmatched.reduce((m, n) => ((m[n] = (m[n] || 0) + 1), m), {});
  console.log(`\nUnmatched invoice numbers left with invoice_company = NULL (${unmatched.length}):`);
  for (const [n, k] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`    ${JSON.stringify(n)} × ${k}`);

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to write.');
  } else {
    await client.query('BEGIN');
    for (const c of plan) {
      await client.query(
        `UPDATE job_cards SET
            invoice_company   = COALESCE($2, invoice_company),
            invoice_raised_at = COALESCE(invoice_raised_at, $3),
            bill_from         = COALESCE($4::jsonb, bill_from),
            updated_at        = now()
          WHERE id = $1`,
        [c.id, c.invoiceCompany ?? null, c.invoiceRaisedAt ?? null, c.billFrom ? JSON.stringify(c.billFrom) : null]
      );
    }
    await client.query('COMMIT');
    console.log(`\n✅ Applied ${plan.length} updates.`);
  }
} catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('❌ Backfill failed:', err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
