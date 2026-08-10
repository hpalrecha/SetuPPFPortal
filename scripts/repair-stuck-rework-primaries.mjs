// One-time repair for primaries frozen in REWORK_REQUESTED that can NEVER close
// through the app, because their rework card already terminated (finished/cancelled)
// or never existed. Leaves Group C (reworks still open) untouched — those complete
// normally in-app.
//
//   DRY RUN (default, writes nothing):  node scripts/repair-stuck-rework-primaries.mjs
//   COMMIT:                             node scripts/repair-stuck-rework-primaries.mjs --commit
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL not set.'); process.exit(1); }
const COMMIT = process.argv.includes('--commit');

// Group A: rework finished (INVOICE_RAISED/CLOSED) → primary retired to CLOSED, link backfilled.
const GROUP_A = [
  { primary: 'e39dc4', rework: 'e994a4', cust: 'JAYACHANDRAN' },
  { primary: '5059d2', rework: '47b9d7', cust: 'SANTHOSH KUMAR GV' },
  { primary: 'b96e30', rework: '8dba43', cust: 'Siva Praveen' },
  { primary: '7d23d1', rework: '13f672', cust: 'abc demo (test)' },
];
// Group B: rework cancelled / never created → primary returned to PENDING_APPROVAL for a human to approve+close.
const GROUP_B = [
  { primary: 'd0aa50', rework: '48c1d5', cust: 'HARMAN FINOCHEM LTD' },
  { primary: '190641', rework: null,     cust: 'TEST (test)' },
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Resolve a short JC-suffix to a full id, guarding against ambiguity.
async function resolve(suffix) {
  const r = await pool.query(`SELECT id, status FROM job_cards WHERE id::text LIKE $1`, [`%${suffix}`]);
  if (r.rows.length !== 1) throw new Error(`suffix ${suffix} matched ${r.rows.length} rows`);
  return r.rows[0];
}

try {
  console.log(COMMIT ? '\n*** COMMIT MODE — writing changes ***\n' : '\n--- DRY RUN — no changes written (pass --commit to apply) ---\n');

  console.log('GROUP A → primary status CLOSED + backfill rework_job_card_id:');
  for (const g of GROUP_A) {
    const p = await resolve(g.primary), r = await resolve(g.rework);
    console.log(`  JC-${g.primary} [${p.status}] → CLOSED   link→JC-${g.rework} [${r.status}]   (${g.cust})`);
    if (COMMIT) {
      await pool.query(`UPDATE job_cards SET status='CLOSED', rework_job_card_id=$2, updated_at=now() WHERE id=$1`, [p.id, r.id]);
    }
  }

  console.log('\nGROUP B → primary status PENDING_APPROVAL + backfill link (if any):');
  for (const g of GROUP_B) {
    const p = await resolve(g.primary);
    const r = g.rework ? await resolve(g.rework) : null;
    console.log(`  JC-${g.primary} [${p.status}] → PENDING_APPROVAL   link→${r ? 'JC-'+g.rework+' ['+r.status+']' : 'none'}   (${g.cust})`);
    if (COMMIT) {
      await pool.query(`UPDATE job_cards SET status='PENDING_APPROVAL', approval_requested_at=now(), rework_job_card_id=$2, updated_at=now() WHERE id=$1`, [p.id, r ? r.id : null]);
    }
  }

  console.log(COMMIT ? '\n✅ Repair applied.' : '\n(dry run complete)');
} catch (err) {
  console.error('❌ Repair failed:', err);
  process.exit(1);
} finally {
  await pool.end();
}
