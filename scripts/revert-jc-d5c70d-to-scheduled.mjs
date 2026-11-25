// One-off data fix: JC-D5C70D (91f0c6d4…, Maneesha Nazar, Nippon Toyota - Kollam, Dharmaraj Pioneer)
// was clicked through Reached → pre-install PASS → Start → Complete by mistake on 2026-11-13 07:47-07:48
// UTC. Puts it back to SCHEDULED: clears everything after scheduling, removes the ₹0 payout + payout line
// that completion auto-created, and returns the work order to ASSIGNED. Notifications already sent stay.
//
//   Usage:  node scripts/revert-jc-d5c70d-to-scheduled.mjs           (dry run)
//           node scripts/revert-jc-d5c70d-to-scheduled.mjs --apply   (one transaction)
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const APPLY = process.argv.includes('--apply');
const JOB_CARD = '91f0c6d4-6725-4ff9-99b1-527aa4d5c70d';
const PAYOUT = 'f2a7216d-ee02-48a3-aa59-0a6540419208';
const PAYOUT_LINE = '0b966c18-833a-4805-8a9d-87f3f15cd100';
const MISTAKE_FROM = '2026-11-13T07:40:00Z';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const { rows: [jc] } = await client.query(
    `SELECT jc.status, jc.completed_at >= '2026-11-13 07:40' AS mistaken_completion, jc.timeline_trail, jc.work_order_id, wo.status AS wo_status
       FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id WHERE jc.id = $1`, [JOB_CARD]);
  const { rows: payouts } = await client.query(`SELECT id, net_amount, status FROM payouts WHERE job_card_id = $1`, [JOB_CARD]);
  const { rows: lines } = await client.query(`SELECT id, amount FROM job_card_payout_lines WHERE job_card_id = $1`, [JOB_CARD]);

  const problems = [];
  if (!jc) problems.push('job card not found');
  else {
    if (jc.status !== 'PENDING_APPROVAL') problems.push(`status is ${jc.status}, expected PENDING_APPROVAL`);
    if (!jc.mistaken_completion) problems.push('completion is not the 2026-11-13 mistake');
  }
  if (payouts.length !== 1 || payouts[0].id !== PAYOUT || Number(payouts[0].net_amount) !== 0) problems.push(`unexpected payouts: ${JSON.stringify(payouts)}`);
  if (lines.length !== 1 || lines[0].id !== PAYOUT_LINE) problems.push(`unexpected payout lines: ${JSON.stringify(lines)}`);
  if (problems.length) { console.log('REFUSING:', problems.join('; ')); process.exit(1); }

  // Keep trail entries from before the mistake; drop the REACHED / PRE_INSTALL_PASS ones it added.
  const trail = (Array.isArray(jc.timeline_trail) ? jc.timeline_trail : []).filter(e => !e.at || e.at < MISTAKE_FROM);
  trail.push({ at: new Date().toISOString(), type: 'REVERTED_TO_SCHEDULED', detail: 'Reached/start/complete on 2026-11-13 were a mistake (data fix)', by: 'system', byRole: 'SYSTEM' });

  console.log(`JC-D5C70D: ${jc.status} → SCHEDULED | work order ${jc.wo_status} → ASSIGNED`);
  console.log(`  clear: reached, pre-install result/time, started, completed, approval requested, checklist, remarks`);
  console.log(`  delete payout ${PAYOUT.slice(0, 8)} (₹${payouts[0].net_amount}, ${payouts[0].status}) and payout line ${PAYOUT_LINE.slice(0, 8)}`);
  console.log(`  timeline: ${jc.timeline_trail?.length ?? 0} → ${trail.length} entries`);

  if (!APPLY) { console.log('\nDRY RUN — nothing written. Re-run with --apply.'); }
  else {
    await client.query('BEGIN');
    await client.query(`DELETE FROM job_card_payout_lines WHERE id = $1 AND job_card_id = $2`, [PAYOUT_LINE, JOB_CARD]);
    await client.query(`DELETE FROM payouts WHERE id = $1 AND job_card_id = $2`, [PAYOUT, JOB_CARD]);
    await client.query(
      `UPDATE job_cards SET status = 'SCHEDULED', reached_at = NULL, reached_by = NULL, pre_install_result = NULL,
              pre_installation_completed_at = NULL, started_at = NULL, completed_at = NULL, approval_requested_at = NULL,
              checklist_json = NULL, remarks = NULL, timeline_trail = $2::jsonb, updated_at = now()
        WHERE id = $1 AND status = 'PENDING_APPROVAL'`, [JOB_CARD, JSON.stringify(trail)]);
    await client.query(`UPDATE work_orders SET status = 'ASSIGNED', updated_at = now() WHERE id = $1`, [jc.work_order_id]);
    await client.query('COMMIT');
    console.log('\n✅ JC-D5C70D is back to SCHEDULED.');
  }
} catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('❌ Failed, nothing written:', err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
