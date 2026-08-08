// Targeted, idempotent apply of migrations/0006_add_reminders_and_reply.sql.
//   Usage:  node scripts/apply-reminders-and-reply.mjs
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
const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '0006_add_reminders_and_reply.sql'), 'utf8');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  console.log('✅ job_reminders table + notification_logs.reply columns are in place.');
} catch (err) {
  console.error('❌ Migration failed:', err);
  process.exit(1);
} finally {
  await pool.end();
}
