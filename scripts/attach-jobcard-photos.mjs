// Attach already-uploaded photos (app paths /objects/uploads/<id>) to job cards: fills the four
// pre-install slots and adds the same photos as post-installation media (job_card_media IMAGE rows),
// per the "same photos for PRE and POST" import notes. Nothing else on the card changes.
// Skips a card that already has any pre-install photo or post-installation media.
//
//   Usage: node scripts/attach-jobcard-photos.mjs <mapping.json> [--apply]
//   mapping.json: { "JC-0252F9": { "front": "/objects/uploads/…", "back": "…", "left": "…", "right": "…" }, … }
import 'dotenv/config';
import fs from 'fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const APPLY = process.argv.includes('--apply');
const file = process.argv.slice(2).find(a => !a.startsWith('--'));
const mapping = JSON.parse(fs.readFileSync(file, 'utf8'));
const SLOTS = [
  { key: 'front', col: 'pre_installation_photo_front', caption: 'Front View' },
  { key: 'back', col: 'pre_installation_photo_back', caption: 'Rear View' },
  { key: 'left', col: 'pre_installation_photo_left', caption: 'Left Side' },
  { key: 'right', col: 'pre_installation_photo_right', caption: 'Right Side' },
];
const PATH_RE = /^\/objects\/uploads\/[0-9a-f-]{36}$/;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let done = 0, skipped = 0;
try {
  for (const [jcLabel, photos] of Object.entries(mapping)) {
    const suffix = jcLabel.replace(/^JC-/i, '').toLowerCase();
    const slots = SLOTS.filter(s => photos[s.key]);
    const { rows } = await pool.query(
      `SELECT jc.id, jc.status, wo.customer_name, ${SLOTS.map(s => `jc.${s.col}`).join(', ')},
              (SELECT count(*) FROM job_card_media m WHERE m.job_card_id = jc.id) AS media
         FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
        WHERE right(jc.id::text, 6) = $1 AND jc.deleted_at IS NULL AND wo.deleted_at IS NULL`, [suffix]);
    const problems = [];
    if (rows.length !== 1) problems.push(`${rows.length} live job cards end in ${suffix}`);
    const jc = rows[0];
    if (jc && SLOTS.some(s => jc[s.col])) problems.push('already has pre-install photos');
    if (jc && Number(jc.media) > 0) problems.push('already has post-installation media');
    if (slots.some(s => !PATH_RE.test(photos[s.key]))) problems.push('bad photo path');
    if (!slots.length) problems.push('no photos');
    if (problems.length) { skipped++; console.log(`SKIP ${jcLabel}: ${problems.join('; ')}`); continue; }

    console.log(`${APPLY ? 'ATTACH' : 'WOULD ATTACH'} ${jcLabel} ${jc.customer_name} [${jc.status}]: ${slots.map(s => s.caption).join(', ')}`);
    if (!APPLY) { done++; continue; }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `UPDATE job_cards SET ${slots.map((s, i) => `${s.col} = $${i + 2}`).join(', ')}, updated_at = now()
          WHERE id = $1 AND ${SLOTS.map(s => `${s.col} IS NULL`).join(' AND ')}`,
        [jc.id, ...slots.map(s => photos[s.key])]);
      if (res.rowCount !== 1) throw new Error('card changed since check');
      for (const s of slots) {
        await client.query(`INSERT INTO job_card_media (job_card_id, type, url, caption) VALUES ($1, 'IMAGE', $2, $3)`, [jc.id, photos[s.key], s.caption]);
      }
      await client.query('COMMIT');
      done++;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error(`${jcLabel}: ${e.message}`);
    } finally { client.release(); }
  }
  console.log(`\n${APPLY ? 'Attached' : 'DRY RUN — would attach'} ${done} card(s), skipped ${skipped}.${APPLY ? '' : ' Re-run with --apply.'}`);
} catch (err) {
  console.error('❌', err.message || err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
