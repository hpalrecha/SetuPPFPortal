// Import back-dated installation photos from a folder into job cards.
//
// Folder layout: "<root>/JC-<last6> - <model> - <vin6> - <Confirmed|Probable>/" containing any of
// 1_Front_View.jpg, 2_Back_View.jpg, 3_Left_Side_View.jpg, 4_Right_Side_View.jpg (+ JobCard_Details.txt).
// Per the details files, the same photos are used for PRE and POST installation, so each image is:
//   - uploaded once to S3 at <AWS_S3_PREFIX>/<uuid>.jpg (app path /objects/uploads/<uuid>.jpg), and
//   - set as the matching pre_installation_photo_* slot, and
//   - added as a job_card_media IMAGE row (post-installation) with the app's captions.
// Nothing else on the card changes (no status/date changes). Cards that already have any pre-install
// photo or post-installation media are skipped. VIN in the folder name must match the card.
//
//   Usage: node scripts/import-jobcard-photos.mjs <root> [JC-xxxxxx ...] [--apply]
//          (no JC list = every folder; dry run unless --apply)
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const root = args.find(a => !a.startsWith('--') && !/^JC-/i.test(a));
const only = args.filter(a => /^JC-/i.test(a)).map(a => a.slice(3, 9).toLowerCase());
if (!root || !fs.existsSync(root)) { console.error('Usage: node scripts/import-jobcard-photos.mjs <root> [JC-xxxxxx ...] [--apply]'); process.exit(1); }

const BUCKET = process.env.AWS_S3_BUCKET || 'p91-brochures';
const PREFIX = process.env.AWS_S3_PREFIX || 'setuppf-uploads';
const SLOTS = [
  { file: '1_Front_View.jpg', col: 'pre_installation_photo_front', caption: 'Front View' },
  { file: '2_Back_View.jpg', col: 'pre_installation_photo_back', caption: 'Rear View' },
  { file: '3_Left_Side_View.jpg', col: 'pre_installation_photo_left', caption: 'Left Side' },
  { file: '4_Right_Side_View.jpg', col: 'pre_installation_photo_right', caption: 'Right Side' },
];

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let done = 0, skipped = 0;
try {
  const folders = fs.readdirSync(root).filter(d => /^JC-[0-9a-f]{6}\b/i.test(d))
    .filter(d => !only.length || only.includes(d.slice(3, 9).toLowerCase()));
  for (const folder of folders) {
    const suffix = folder.slice(3, 9).toLowerCase();
    const vin6 = (folder.split(' - ')[2] || '').trim().toUpperCase();
    const { rows } = await pool.query(
      `SELECT jc.id, jc.status, wo.reg_no, wo.customer_name,
              jc.pre_installation_photo_front, jc.pre_installation_photo_back, jc.pre_installation_photo_left, jc.pre_installation_photo_right,
              (SELECT count(*) FROM job_card_media m WHERE m.job_card_id = jc.id) AS media
         FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
        WHERE right(jc.id::text, 6) = $1 AND jc.deleted_at IS NULL AND wo.deleted_at IS NULL`, [suffix]);
    const label = `JC-${suffix.toUpperCase()}`;
    const files = SLOTS.filter(s => fs.existsSync(path.join(root, folder, s.file)));
    const problems = [];
    if (rows.length !== 1) problems.push(`${rows.length} live job cards end in ${suffix}`);
    const jc = rows[0];
    if (jc && !(jc.reg_no || '').toUpperCase().includes(vin6)) problems.push(`VIN mismatch (folder ${vin6}, card ${jc.reg_no})`);
    if (jc && SLOTS.some(s => jc[s.col])) problems.push('already has pre-install photos');
    if (jc && Number(jc.media) > 0) problems.push('already has post-installation media');
    if (!files.length) problems.push('no photos in folder');
    if (problems.length) { skipped++; console.log(`SKIP ${label}: ${problems.join('; ')}`); continue; }

    console.log(`${APPLY ? 'IMPORT' : 'WOULD IMPORT'} ${label} ${jc.customer_name} [${jc.status}]: ${files.map(f => f.caption).join(', ')} → pre-install slots + post-installation media`);
    if (!APPLY) { done++; continue; }

    // 1) upload every photo first; only touch the DB when all uploads succeeded
    const uploaded = [];
    for (const s of files) {
      const id = `${randomUUID()}.jpg`;
      const Body = fs.readFileSync(path.join(root, folder, s.file));
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: `${PREFIX}/${id}`, Body, ContentType: 'image/jpeg' }));
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: `${PREFIX}/${id}` }));
      uploaded.push({ ...s, url: `/objects/uploads/${id}`, bytes: Body.length });
    }
    // 2) one transaction per card
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const sets = uploaded.map((u, i) => `${u.col} = $${i + 2}`).join(', ');
      const res = await client.query(
        `UPDATE job_cards SET ${sets}, updated_at = now() WHERE id = $1
           AND pre_installation_photo_front IS NULL AND pre_installation_photo_back IS NULL
           AND pre_installation_photo_left IS NULL AND pre_installation_photo_right IS NULL`,
        [jc.id, ...uploaded.map(u => u.url)]);
      if (res.rowCount !== 1) throw new Error('card changed since check');
      for (const u of uploaded) {
        await client.query(`INSERT INTO job_card_media (job_card_id, type, url, caption) VALUES ($1, 'IMAGE', $2, $3)`, [jc.id, u.url, u.caption]);
      }
      await client.query('COMMIT');
      done++;
      console.log(`   ✅ ${uploaded.length} photo(s): ${uploaded.map(u => `${u.caption} ${Math.round(u.bytes / 1024)}KB`).join(', ')}`);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error(`${label}: ${e.message}`);
    } finally { client.release(); }
  }
  console.log(`\n${APPLY ? 'Imported' : 'DRY RUN — would import'} ${done} card(s), skipped ${skipped}.${APPLY ? '' : ' Re-run with --apply.'}`);
} catch (err) {
  console.error('❌', err.message || err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
