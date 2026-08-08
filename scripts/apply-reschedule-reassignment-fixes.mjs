// Targeted, idempotent apply of migrations/0007_reschedule_reassignment_fixes.sql.
//   Usage:  node scripts/apply-reschedule-reassignment-fixes.mjs
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '0007_reschedule_reassignment_fixes.sql'), 'utf8');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  console.log('✅ reschedule_party + superseded_by_job_card_id columns are in place.');
} catch (err) {
  console.error('❌ Migration failed:', err);
  process.exit(1);
} finally {
  await pool.end();
}
