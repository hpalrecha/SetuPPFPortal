// Read-only: rework diagnosis — stuck primaries + stuck rework cards, esp. Dharmaraj.
//   Usage:  node scripts/check-rework-cards.mjs
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL not set.'); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  // 1) All rework cards (rework_of_job_card_id set) with primary + partner + customer.
  const rework = await pool.query(`
    SELECT r.id, r.status, r.rework_of_job_card_id AS primary_id, r.created_at,
           p.status AS primary_status, p.rework_job_card_id AS link,
           wo.customer_name, wo.reg_no, pt.display_name AS partner
    FROM job_cards r
    LEFT JOIN job_cards p  ON p.id = r.rework_of_job_card_id
    LEFT JOIN work_orders wo ON wo.id = r.work_order_id
    LEFT JOIN partners pt   ON pt.id = r.partner_id
    WHERE r.rework_of_job_card_id IS NOT NULL
    ORDER BY pt.display_name, r.created_at DESC;
  `);
  console.log(`\n=== REWORK CARDS: ${rework.rows.length} ===`);
  for (const r of rework.rows) {
    console.log(`  [${r.partner || '—'}] rework JC-${r.id.slice(-6)} [${r.status}] → primary JC-${String(r.primary_id).slice(-6)} [${r.primary_status}]  cust="${r.customer_name||'—'}" reg="${r.reg_no||'—'}" link=${r.link?'set':'NULL'}`);
  }

  // 2) Every primary frozen in REWORK_REQUESTED (whether or not a rework card exists).
  const stuck = await pool.query(`
    SELECT p.id, p.status, p.rework_job_card_id, p.created_at,
           wo.customer_name, wo.reg_no, pt.display_name AS partner
    FROM job_cards p
    LEFT JOIN work_orders wo ON wo.id = p.work_order_id
    LEFT JOIN partners pt   ON pt.id = p.partner_id
    WHERE p.status = 'REWORK_REQUESTED'
    ORDER BY pt.display_name, p.created_at DESC;
  `);
  console.log(`\n=== PRIMARIES FROZEN IN REWORK_REQUESTED: ${stuck.rows.length} ===`);
  for (const s of stuck.rows) {
    // Does a rework card actually exist for this primary, and what state is it in?
    const kids = rework.rows.filter(r => r.primary_id === s.id);
    const kidState = kids.length ? kids.map(k=>`JC-${k.id.slice(-6)}[${k.status}]`).join(',') : 'NO REWORK CARD';
    console.log(`  [${s.partner||'—'}] JC-${s.id.slice(-6)}  cust="${s.customer_name||'—'}" reg="${s.reg_no||'—'}"  reworkCard=${kidState}`);
  }

  // 3) Rework cards stuck in an OPEN/incomplete state (old flow couldn't complete them).
  const OPEN = ['AWAITING_ACK','ACKNOWLEDGED','ASSIGNED','SCHEDULED','RESCHEDULED','REACHED','IN_PROGRESS'];
  const openReworks = rework.rows.filter(r => OPEN.includes(r.status));
  console.log(`\n=== REWORK CARDS STILL OPEN (can't be completed via old flow): ${openReworks.length} ===`);
  for (const r of openReworks) {
    console.log(`  [${r.partner||'—'}] JC-${r.id.slice(-6)} [${r.status}]  cust="${r.customer_name||'—'}" reg="${r.reg_no||'—'}"`);
  }

  // 4) Dharmaraj Pioneer — full status breakdown.
  const dharma = await pool.query(`
    SELECT jc.status, COUNT(*)::int AS n
    FROM job_cards jc JOIN partners pt ON pt.id = jc.partner_id
    WHERE pt.display_name ILIKE '%dharma%'
    GROUP BY jc.status ORDER BY n DESC;
  `);
  console.log(`\n=== DHARMARAJ PIONEER — all job cards by status ===`);
  for (const d of dharma.rows) console.log(`  ${d.status}: ${d.n}`);
} catch (err) {
  console.error('❌ Query failed:', err);
  process.exit(1);
} finally {
  await pool.end();
}
