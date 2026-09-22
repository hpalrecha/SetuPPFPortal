/**
 * Backfill P91 warranty codes onto job cards that lost them.
 *
 * WHY: until 2026-09-19 the P91 cross-app flow (`request-e-warranty`) registered the
 * warranty in P91Elite but never persisted the returned code — it only came back in the
 * HTTP response. Every job card registered before that fix has `e_warranty_applied = true`
 * and `warranty_reference_number = NULL`, so Pulse VAS has no pointer to a warranty that
 * genuinely exists in Elite.
 *
 * HOW: Elite creates the warranty and Setu stamps `e_warranty_applied_at` milliseconds
 * later, so (VIN, creation time) identifies the pair almost exactly. We match
 * work_orders.reg_no against warranty_registrations.vehicle_vin, and where a VIN carries
 * more than one warranty we take the one created closest to our stamp — requiring the
 * runner-up to be clearly further away, so a genuine ambiguity is reported, never guessed.
 *
 * SAFETY:
 *   - dry run by default; pass --commit to write
 *   - only ever fills rows where warranty_reference_number IS NULL (idempotent, re-runnable)
 *   - aborts before writing if two job cards resolve to the same warranty code
 *   - prints the affected ids so the write can be undone by setting them back to NULL
 *
 * USAGE (from the repo root, with both .env files present):
 *   node scripts/backfill-warranty-codes.mjs
 *   node scripts/backfill-warranty-codes.mjs --commit
 */
import fs from 'fs';
import path from 'path';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const COMMIT = process.argv.includes('--commit');
const ELITE_ENV = process.env.ELITE_ENV_PATH || 'D:/p91/p91/p91web/P91Elite/.env';
const SETU_ENV = process.env.SETU_ENV_PATH || path.resolve('.env');

/** Tolerance for "same moment". Observed gaps are 0s; this is generous headroom. */
const MATCH_WINDOW_MS = 5 * 60 * 1000;

function readDatabaseUrl(envPath) {
  const text = fs.readFileSync(envPath, 'utf8');
  const match = text.match(/^DATABASE_URL\s*=\s*(.*)$/m);
  if (!match) throw new Error(`No DATABASE_URL in ${envPath}`);
  return match[1].trim().replace(/^["']|["']$/g, '');
}

const normalizeVin = (v) => (v || '').trim().toUpperCase();

async function main() {
  const setu = new Pool({ connectionString: readDatabaseUrl(SETU_ENV) });
  const elite = new Pool({ connectionString: readDatabaseUrl(ELITE_ENV) });

  try {
    const { rows: cards } = await setu.query(`
      select jc.id, jc.e_warranty_applied_at as at, wo.reg_no, wo.customer_name
      from job_cards jc
      join work_orders wo on wo.id = jc.work_order_id
      where jc.e_warranty_applied = true
        and (jc.warranty_reference_number is null or jc.warranty_reference_number = '')
      order by jc.e_warranty_applied_at`);

    const { rows: warranties } = await elite.query(
      `select id, warranty_code, vehicle_vin, created_at, name from warranty_registrations`);

    const byVin = new Map();
    for (const w of warranties) {
      const key = normalizeVin(w.vehicle_vin);
      if (!key) continue;
      if (!byVin.has(key)) byVin.set(key, []);
      byVin.get(key).push(w);
    }

    const planned = [];
    const skipped = [];

    for (const card of cards) {
      const hits = byVin.get(normalizeVin(card.reg_no)) || [];
      if (hits.length === 0) {
        skipped.push({ card, reason: 'no warranty in Elite for this VIN' });
        continue;
      }
      if (!card.at) {
        if (hits.length === 1) planned.push({ card, warranty: hits[0], gapSec: null });
        else skipped.push({ card, reason: `${hits.length} warranties on VIN and no timestamp to separate them` });
        continue;
      }

      const stamp = new Date(card.at).getTime();
      const ranked = hits
        .map((w) => ({ w, delta: Math.abs(new Date(w.created_at).getTime() - stamp) }))
        .sort((a, b) => a.delta - b.delta);

      const [best, runnerUp] = ranked;
      if (best.delta > MATCH_WINDOW_MS) {
        skipped.push({ card, reason: `closest warranty is ${Math.round(best.delta / 1000)}s away` });
      } else if (runnerUp && runnerUp.delta <= MATCH_WINDOW_MS) {
        skipped.push({ card, reason: 'two warranties equally close in time — needs a human' });
      } else {
        planned.push({ card, warranty: best.w, gapSec: Math.round(best.delta / 1000) });
      }
    }

    // A warranty belongs to exactly one job card. If two claim the same code the
    // matching rule is wrong, so refuse to write anything at all.
    const claims = new Map();
    for (const p of planned) {
      if (!claims.has(p.warranty.warranty_code)) claims.set(p.warranty.warranty_code, []);
      claims.get(p.warranty.warranty_code).push(p.card.id);
    }
    const collisions = [...claims].filter(([, ids]) => ids.length > 1);

    console.log(`Job cards missing a code: ${cards.length}`);
    console.log(`  matched:   ${planned.length}`);
    console.log(`  skipped:   ${skipped.length}`);
    for (const s of skipped) {
      console.log(`    - ${s.card.id}  ${(s.card.reg_no || '').trim() || '(no reg)'}  → ${s.reason}`);
    }
    const worst = planned.reduce((m, p) => Math.max(m, p.gapSec ?? 0), 0);
    console.log(`  worst time gap among matches: ${worst}s`);

    if (collisions.length) {
      console.error('\nABORTING — the same warranty was matched to multiple job cards:');
      for (const [code, ids] of collisions) console.error(`  ${code} → ${ids.join(', ')}`);
      process.exitCode = 1;
      return;
    }

    if (!COMMIT) {
      console.log('\nDRY RUN — nothing written. Re-run with --commit to apply:');
      for (const p of planned) {
        console.log(`  ${p.card.id}  ${(p.card.reg_no || '').trim()}  ← ${p.warranty.warranty_code}`);
      }
      return;
    }

    let written = 0;
    for (const p of planned) {
      // The NULL guard keeps this idempotent and stops it clobbering a code that
      // arrived by another route between the read above and this write.
      const res = await setu.query(
        `update job_cards set warranty_reference_number = $1
         where id = $2 and (warranty_reference_number is null or warranty_reference_number = '')`,
        [p.warranty.warranty_code, p.card.id]);
      written += res.rowCount;
    }

    console.log(`\nWrote ${written} warranty codes.`);
    console.log('To undo:');
    console.log(`  update job_cards set warranty_reference_number = null where id in (\n    ${planned.map((p) => `'${p.card.id}'`).join(',\n    ')}\n  );`);
  } finally {
    await setu.end();
    await elite.end();
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
