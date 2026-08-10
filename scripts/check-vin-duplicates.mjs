// Read-only: find VINs (reg_no) that carry more than one job card, and show whether
// the extra cards are flagged as rework (reworkOfJobCardId set). Confirms the Rework
// toggle (which hides reworkOfJobCardId cards) catches the real same-VIN duplicates.
//   Usage:  node scripts/check-vin-duplicates.mjs
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL not set.'); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const rows = (await pool.query(`
    SELECT wo.reg_no,
           jc.id, jc.status, jc.rework_of_job_card_id AS rework_of, jc.created_at,
           wo.customer_name
    FROM job_cards jc
    JOIN work_orders wo ON wo.id = jc.work_order_id
    WHERE wo.reg_no IS NOT NULL AND btrim(wo.reg_no) <> ''
    ORDER BY wo.reg_no, jc.created_at
  `)).rows;

  const byVin = new Map();
  for (const r of rows) {
    const k = r.reg_no.trim().toUpperCase();
    if (!byVin.has(k)) byVin.set(k, []);
    byVin.get(k).push(r);
  }

  let dupGroups = 0, extraCards = 0, reworkFlagged = 0, notFlagged = 0;
  const suspicious = [];
  for (const [vin, cards] of byVin) {
    if (cards.length < 2) continue;
    dupGroups++;
    // The extras (beyond the first-created) on a VIN — are they rework-flagged?
    const extras = cards.slice(1);
    extraCards += extras.length;
    for (const e of extras) {
      if (e.rework_of) reworkFlagged++;
      else { notFlagged++; suspicious.push({ vin, ...e, cust: cards[0].customer_name }); }
    }
  }

  console.log(`\nVINs with >1 job card: ${dupGroups}`);
  console.log(`Extra (non-first) cards on those VINs: ${extraCards}`);
  console.log(`  ├─ flagged as rework (hidden by toggle): ${reworkFlagged}`);
  console.log(`  └─ NOT flagged as rework (toggle keeps showing): ${notFlagged}`);

  if (suspicious.length) {
    console.log(`\n=== Same-VIN duplicates NOT flagged as rework (${suspicious.length}) ===`);
    for (const s of suspicious.slice(0, 60)) {
      console.log(`  VIN ${s.vin}  JC-${s.id.slice(-6)} [${s.status}]  cust="${s.cust||'—'}"  created=${s.created_at.toISOString().slice(0,10)}`);
    }
    if (suspicious.length > 60) console.log(`  ...and ${suspicious.length - 60} more`);
  }
} catch (err) {
  console.error('❌ Query failed:', err);
  process.exit(1);
} finally {
  await pool.end();
}
