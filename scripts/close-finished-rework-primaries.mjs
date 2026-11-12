// One-off data fix: close primary job cards stuck in REWORK_REQUESTED whose rework is finished.
//
// Before commit a02c3e1 (2026-08-10) a completed rework card went through its own approval/invoice
// cycle and never released its primary, so these primaries sit in REWORK_REQUESTED forever. Each one
// listed here was already approved, invoiced and warranty-registered before the rework, and its
// rework card was completed on 2026-08-08 — so both cards are done and get CLOSED.
//
//   Usage:  node scripts/close-finished-rework-primaries.mjs           (dry run — prints the plan)
//           node scripts/close-finished-rework-primaries.mjs --apply   (writes, one transaction)
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const APPLY = process.argv.includes('--apply');

// primary → its rework card (hard-coded allowlist; nothing is matched at run time)
const PAIRS = [
  { primary: '1dab5382-a887-4638-a8c7-fa0126e39dc4', rework: '49a89ba7-2442-43c2-b6a4-93a7f1e994a4' }, // JAYACHANDRAN, Incheo Kia - Thrissur
  { primary: '148ef62e-4491-4792-9f37-7bc559b96e30', rework: '7d84c235-7320-43f9-87ae-11748f8dba43' }, // Siva Praveen, Incheon Kia - Ayathil, Kollam
  { primary: '36172701-9b7d-421e-bb5f-f162f95059d2', rework: '1bf1d42b-39f6-4708-9e04-5e684d47b9d7' }, // SANTHOSH KUMAR GV, Incheon Kia - Nettoor
];

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(1); }
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  const plan = [];
  for (const { primary, rework } of PAIRS) {
    const { rows: [p] } = await client.query(
      `SELECT jc.id, jc.status, jc.work_order_id, jc.payment_settled_at, jc.e_warranty_applied, jc.warranty_applied_at,
              wo.status AS wo_status, wo.customer_name
         FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id WHERE jc.id = $1`, [primary]);
    const { rows: [r] } = await client.query(
      `SELECT id, status, completed_at, rework_of_job_card_id FROM job_cards WHERE id = $1`, [rework]);

    // Guards: refuse anything that no longer matches what was reviewed.
    const problems = [];
    if (!p) problems.push('primary not found');
    if (!r) problems.push('rework card not found');
    if (p && p.status !== 'REWORK_REQUESTED') problems.push(`primary status is ${p.status}, expected REWORK_REQUESTED`);
    if (p && !p.payment_settled_at) problems.push('primary has no invoice/payment recorded');
    if (p && !(p.e_warranty_applied || p.warranty_applied_at)) problems.push('primary has no warranty');
    if (r && r.rework_of_job_card_id !== primary) problems.push('rework card is not linked to this primary');
    if (r && !r.completed_at) problems.push('rework card is not completed');
    if (problems.length) {
      console.log(`SKIP ${primary.slice(0, 8)} (${p?.customer_name ?? '?'}): ${problems.join('; ')}`);
      continue;
    }
    plan.push({ p, r });
    console.log(
      `${primary.slice(0, 8)} ${p.customer_name}: primary ${p.status} → CLOSED | rework ${rework.slice(0, 8)} ${r.status} → CLOSED` +
      ` | work order ${p.wo_status} → CLOSED | rework completed ${r.completed_at.toISOString().slice(0, 16)}`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — ${plan.length} pair(s) would be closed. Re-run with --apply to write.`);
  } else if (plan.length) {
    const note = (detail) => JSON.stringify([{ at: new Date().toISOString(), type: 'CLOSED_AFTER_REWORK', detail, by: 'system', byRole: 'SYSTEM' }]);
    await client.query('BEGIN');
    for (const { p, r } of plan) {
      await client.query(
        `UPDATE job_cards SET status = 'CLOSED', rework_job_card_id = $2, rework_completed_at = $3, updated_at = now(),
                timeline_trail = COALESCE(timeline_trail, '[]'::jsonb) || $4::jsonb
          WHERE id = $1 AND status = 'REWORK_REQUESTED'`,
        [p.id, r.id, r.completed_at, note(`Rework ${r.id.slice(0, 8)} was completed; invoice and warranty were already done (data fix)`)]);
      if (r.status !== 'CLOSED') {
        await client.query(
          `UPDATE job_cards SET status = 'CLOSED', updated_at = now(),
                  timeline_trail = COALESCE(timeline_trail, '[]'::jsonb) || $2::jsonb
            WHERE id = $1`,
          [r.id, note(`Rework card closed — rework completed ${r.completed_at.toISOString().slice(0, 10)} (data fix)`)]);
      }
      await client.query(
        `UPDATE work_orders SET status = 'CLOSED', assigned_job_card_id = $2, updated_at = now() WHERE id = $1`,
        [p.work_order_id, p.id]);
    }
    await client.query('COMMIT');
    console.log(`\n✅ Closed ${plan.length} primary job card(s), their rework cards and work orders.`);
  }
} catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('❌ Failed, nothing written:', err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
