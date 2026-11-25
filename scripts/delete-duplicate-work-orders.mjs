// One-off: soft-delete duplicate work orders (same car + service entered twice by mistake).
// Same semantics as storage.softDeleteWorkOrder: stamps deleted_at/reason/by on the work order and its
// live job cards; rows stay in the DB and are restored by clearing those three columns.
//
//   Usage:  node scripts/delete-duplicate-work-orders.mjs           (dry run)
//           node scripts/delete-duplicate-work-orders.mjs --apply   (one transaction)
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const APPLY = process.argv.includes('--apply');

// duplicate work order → the closed, invoiced work order it copies (hard-coded allowlist)
const DUPLICATES = [
  { dup: '8f511412-659f-4c0c-8505-38224aee54f1', keep: 'c15c5ca9-416f-4943-844f-def82011c6b1', label: 'Meet Pabri GLE — JC-54FD2F duplicates JC-569FA5 (ST/366/25-26)' },
  { dup: '7ca3f99b-0346-4cd9-a0f7-51cd5cdd9e48', keep: null, label: 'PricewaterhouseCoopers — JC-B0895D duplicates JC-946536 (ST/376/25-26)' },
];
const DELETED_BY_EMAIL = 'tushar@p91.local';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const { rows: [actor] } = await client.query(`SELECT id FROM users WHERE email = $1`, [DELETED_BY_EMAIL]);
  if (!actor) throw new Error(`user ${DELETED_BY_EMAIL} not found`);

  const plan = [];
  for (const d of DUPLICATES) {
    const { rows: [wo] } = await client.query(
      `SELECT id, reg_no, service_id, deleted_at FROM work_orders WHERE id = $1`, [d.dup]);
    const { rows: cards } = await client.query(
      `SELECT id, status, sales_invoice_number, payment_settled_at FROM job_cards WHERE work_order_id = $1 AND deleted_at IS NULL`, [d.dup]);
    // The car must have another live, invoiced work order for the same service — the one we keep.
    const { rows: keepers } = wo ? await client.query(
      `SELECT wo.id, jc.status, jc.sales_invoice_number FROM work_orders wo JOIN job_cards jc ON jc.work_order_id = wo.id
        WHERE wo.id <> $1 AND wo.deleted_at IS NULL AND jc.deleted_at IS NULL AND wo.service_id = $2
          AND upper(trim(wo.reg_no)) = upper(trim($3)) AND jc.status = 'CLOSED' AND jc.sales_invoice_number IS NOT NULL`,
      [d.dup, wo.service_id, wo.reg_no]) : { rows: [] };

    const problems = [];
    if (!wo) problems.push('work order not found');
    else if (wo.deleted_at) problems.push('already deleted');
    if (cards.some(c => c.payment_settled_at || c.sales_invoice_number)) problems.push('duplicate already has an invoice');
    if (cards.some(c => c.status === 'CLOSED')) problems.push('duplicate is closed');
    if (keepers.length === 0) problems.push('no closed, invoiced work order for the same car + service');
    if (problems.length) { console.log(`SKIP ${d.label}: ${problems.join('; ')}`); continue; }
    plan.push({ ...d, cards });
    console.log(`DELETE ${d.label}\n   work order ${d.dup.slice(0, 8)} + ${cards.length} job card(s) [${cards.map(c => c.status).join(', ')}]; keeps ${keepers.map(k => `${k.id.slice(0, 8)} (${k.sales_invoice_number})`).join(', ')}`);
  }

  if (!APPLY) { console.log(`\nDRY RUN — ${plan.length} work order(s) would be soft-deleted. Re-run with --apply.`); }
  else if (plan.length) {
    await client.query('BEGIN');
    for (const p of plan) {
      const reason = `Duplicate work order (same car and service entered twice on 2026-02-09): ${p.label}`;
      await client.query(
        `UPDATE job_cards SET deleted_at = now(), deleted_reason = $2, deleted_by = $3, updated_at = now()
          WHERE work_order_id = $1 AND deleted_at IS NULL`, [p.dup, reason, actor.id]);
      await client.query(
        `UPDATE work_orders SET deleted_at = now(), deleted_reason = $2, deleted_by = $3, updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL`, [p.dup, reason, actor.id]);
    }
    await client.query('COMMIT');
    console.log(`\n✅ Soft-deleted ${plan.length} duplicate work order(s).`);
  }
} catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('❌ Failed, nothing written:', err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
