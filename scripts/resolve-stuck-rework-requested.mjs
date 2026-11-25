// One-off data fix for the last three job cards stuck in REWORK_REQUESTED (nothing in the app can move them):
//  - JC-D0AA50  Harman Finochem — real job, invoiced (ST/847/26-27) + warranty done; its rework card
//               JC-48C1D5 was cancelled, so the rework will never complete → CLOSE card + work order.
//  - JC-7D23D1  "abc demo" — test data → soft-delete its work order (and its cards).
//  - JC-190641  "TEST"     — test data → soft-delete its work order (and its cards).
// Soft delete = same as storage.softDeleteWorkOrder (reversible by clearing deleted_at/reason/by).
//
//   Usage:  node scripts/resolve-stuck-rework-requested.mjs           (dry run)
//           node scripts/resolve-stuck-rework-requested.mjs --apply   (one transaction)
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const APPLY = process.argv.includes('--apply');
const CLOSE = 'b73fd86d-f10a-4d96-9181-4d0206d0aa50'; // JC-D0AA50 Harman Finochem
const DELETE = [
  { id: 'fb5e31ea-f832-4e8e-9f9d-b2d1157d23d1', label: 'JC-7D23D1 "abc demo"' },
  { id: '96e58169-db6f-4da5-a4f2-6a7f5e190641', label: 'JC-190641 "TEST"' },
];
const ACTOR_EMAIL = 'tushar@p91.local';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const { rows: [actor] } = await client.query(`SELECT id FROM users WHERE email = $1`, [ACTOR_EMAIL]);
  if (!actor) throw new Error(`user ${ACTOR_EMAIL} not found`);
  const card = async (id) => (await client.query(
    `SELECT jc.id, jc.status, jc.work_order_id, jc.payment_settled_at, jc.sales_invoice_number, jc.deleted_at,
            (jc.e_warranty_applied OR jc.warranty_applied_at IS NOT NULL) AS warranty, wo.status AS wo_status, wo.customer_name,
            (SELECT count(*) FROM job_cards o WHERE o.work_order_id = jc.work_order_id AND o.deleted_at IS NULL) AS cards
       FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id WHERE jc.id = $1`, [id])).rows[0];

  const problems = [];
  const h = await card(CLOSE);
  if (!h) problems.push('Harman card not found');
  else {
    if (h.status !== 'REWORK_REQUESTED') problems.push(`Harman status is ${h.status}`);
    if (!h.payment_settled_at || !h.warranty) problems.push('Harman is not invoiced + warranty-registered');
    const { rows: open } = await client.query(
      `SELECT status FROM job_cards WHERE rework_of_job_card_id = $1 AND deleted_at IS NULL AND status NOT IN ('CANCELLED','CLOSED')`, [CLOSE]);
    if (open.length) problems.push('Harman has an open rework card');
  }
  const dels = [];
  for (const d of DELETE) {
    const c = await card(d.id);
    if (!c) { problems.push(`${d.label} not found`); continue; }
    if (c.deleted_at) problems.push(`${d.label} already deleted`);
    if (c.payment_settled_at || c.sales_invoice_number) problems.push(`${d.label} has an invoice`);
    dels.push({ ...d, c });
  }
  if (problems.length) { console.log('REFUSING:', problems.join('; ')); process.exit(1); }

  console.log(`CLOSE  JC-D0AA50 ${h.customer_name}: ${h.status} → CLOSED | work order ${h.wo_status} → CLOSED`);
  for (const d of dels) console.log(`DELETE ${d.label} (${d.c.status}): work order + ${d.c.cards} job card(s), soft delete`);

  if (!APPLY) { console.log('\nDRY RUN — nothing written. Re-run with --apply.'); }
  else {
    await client.query('BEGIN');
    const note = JSON.stringify([{ at: new Date().toISOString(), type: 'CLOSED_AFTER_REWORK',
      detail: 'Rework card JC-48C1D5 was cancelled; invoice and warranty already done (data fix)', by: 'system', byRole: 'SYSTEM' }]);
    await client.query(
      `UPDATE job_cards SET status = 'CLOSED', updated_at = now(), timeline_trail = COALESCE(timeline_trail, '[]'::jsonb) || $2::jsonb
        WHERE id = $1 AND status = 'REWORK_REQUESTED'`, [CLOSE, note]);
    await client.query(
      `UPDATE work_orders SET status = 'CLOSED', assigned_job_card_id = $2, updated_at = now() WHERE id = $1`, [h.work_order_id, CLOSE]);
    for (const d of dels) {
      const reason = `Test data stuck in REWORK_REQUESTED: ${d.label}`;
      await client.query(
        `UPDATE job_cards SET deleted_at = now(), deleted_reason = $2, deleted_by = $3, updated_at = now()
          WHERE work_order_id = $1 AND deleted_at IS NULL`, [d.c.work_order_id, reason, actor.id]);
      await client.query(
        `UPDATE work_orders SET deleted_at = now(), deleted_reason = $2, deleted_by = $3, updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL`, [d.c.work_order_id, reason, actor.id]);
    }
    await client.query('COMMIT');
    console.log('\n✅ Closed JC-D0AA50 and soft-deleted the two test work orders.');
  }
} catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('❌ Failed, nothing written:', err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
