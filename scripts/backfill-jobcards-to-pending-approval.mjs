// Back-fill: move the job cards from the "Sorted by Job Card" photo import up to PENDING_APPROVAL,
// recording the same fields the app's buttons write, step by step (all stamped today):
//   acknowledge → (scheduled, kept) → reached → pre-install PASS → start → complete → PENDING_APPROVAL
// Deliberately NOT done (agreed 2026-11-20): no WhatsApp / push / email notifications, no payouts or
// payout lines, no billing auto-fill. The work order goes ASSIGNED → IN_PROGRESS, as "Start" does.
// Only cards that are SCHEDULED or REACHED, have pre-install photos and match a folder are touched.
//
//   Usage: node scripts/backfill-jobcards-to-pending-approval.mjs <photo-root> [--apply]
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const APPLY = process.argv.includes('--apply');
const root = process.argv.slice(2).find(a => !a.startsWith('--'));
if (!root || !fs.existsSync(root)) { console.error('Usage: node scripts/backfill-jobcards-to-pending-approval.mjs <photo-root> [--apply]'); process.exit(1); }
const ACTOR_EMAIL = 'vishal@stek-india.in'; // the Super Admin doing this back-fill in the portal

const folders = fs.readdirSync(root).filter(d => /^JC-[0-9a-f]{6}\b/i.test(d));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const { rows: [actor] } = await client.query(`SELECT id, role FROM users WHERE email = $1`, [ACTOR_EMAIL]);
  if (!actor) throw new Error(`user ${ACTOR_EMAIL} not found`);

  const plan = [];
  for (const folder of folders) {
    const suffix = folder.slice(3, 9).toLowerCase();
    const label = `JC-${suffix.toUpperCase()}`;
    const { rows } = await client.query(
      `SELECT jc.id, jc.status, jc.acknowledged_at, jc.reached_at, jc.pre_installation_photo_front, jc.billing_value,
              jc.work_order_id, wo.status AS wo_status, wo.customer_name
         FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
        WHERE right(jc.id::text, 6) = $1 AND jc.deleted_at IS NULL AND wo.deleted_at IS NULL`, [suffix]);
    const jc = rows[0];
    const problems = [];
    if (rows.length !== 1) problems.push(`${rows.length} live job cards end in ${suffix}`);
    else {
      if (!['SCHEDULED', 'REACHED'].includes(jc.status)) problems.push(`status is ${jc.status}`);
      if (!jc.pre_installation_photo_front) problems.push('no pre-install photos');
    }
    if (problems.length) { console.log(`SKIP ${label}: ${problems.join('; ')}`); continue; }
    const notes = fs.existsSync(path.join(root, folder, 'JobCard_Details.txt'))
      ? (fs.readFileSync(path.join(root, folder, 'JobCard_Details.txt'), 'utf8').match(/Suggested Pulse note:\s*(.+)/)?.[1] || '').trim() : '';
    plan.push({ label, jc, notes });
    console.log(`${label} ${jc.customer_name}: ${jc.status} → PENDING_APPROVAL | work order ${jc.wo_status} → IN_PROGRESS${jc.billing_value ? '' : ' | (no billing price)'}`);
  }

  if (!APPLY) { console.log(`\nDRY RUN — ${plan.length} card(s) would move to PENDING_APPROVAL. Re-run with --apply.`); }
  else {
    await client.query('BEGIN');
    for (const { jc, notes } of plan) {
      // One timestamp per step, a second apart, in the order the buttons are pressed.
      const t0 = Date.now();
      const at = (i) => new Date(t0 + i * 1000).toISOString();
      const trail = [];
      if (!jc.reached_at) trail.push({ at: at(1), type: 'REACHED', by: actor.id, byRole: actor.role });
      trail.push({ at: at(2), type: 'PRE_INSTALL_PASS', by: actor.id, byRole: actor.role });
      if (notes) trail.push({ at: at(5), type: 'BACKFILL_NOTE', detail: notes, by: actor.id, byRole: actor.role });
      const res = await client.query(
        `UPDATE job_cards SET
            acknowledged_at = COALESCE(acknowledged_at, $2::timestamptz AT TIME ZONE 'UTC'),
            reached_at = COALESCE(reached_at, $3::timestamptz AT TIME ZONE 'UTC'), reached_by = COALESCE(reached_by, $7),
            pre_install_result = 'PASS',
            pre_installation_completed_at = COALESCE(pre_installation_completed_at, $4::timestamptz AT TIME ZONE 'UTC'),
            pre_installation_completed_by = COALESCE(pre_installation_completed_by, $7),
            started_at = $5::timestamptz AT TIME ZONE 'UTC',
            completed_at = $6::timestamptz AT TIME ZONE 'UTC',
            approval_requested_at = $6::timestamptz AT TIME ZONE 'UTC',
            status = 'PENDING_APPROVAL',
            timeline_trail = COALESCE(timeline_trail, '[]'::jsonb) || $8::jsonb,
            updated_at = now()
          WHERE id = $1 AND status IN ('SCHEDULED','REACHED')`,
        [jc.id, at(0), at(1), at(2), at(3), at(4), actor.id, JSON.stringify(trail)]);
      if (res.rowCount !== 1) throw new Error(`${jc.id} changed since check`);
      await client.query(`UPDATE work_orders SET status = 'IN_PROGRESS', updated_at = now() WHERE id = $1`, [jc.work_order_id]);
    }
    await client.query('COMMIT');
    console.log(`\n✅ ${plan.length} card(s) moved to PENDING_APPROVAL (no notifications, no payouts).`);
  }
} catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('❌ Failed, nothing written:', err.message || err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
