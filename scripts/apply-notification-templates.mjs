// Targeted, idempotent apply of migrations/0004_add_notification_templates.sql — creates ONLY
// the notification_templates table. Touches nothing else. Safe to re-run.
//   Usage:  node scripts/apply-notification-templates.mjs
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
const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '0004_add_notification_templates.sql'), 'utf8');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  console.log('✅ notification_templates table is in place.');
} catch (err) {
  console.error('❌ Failed to apply notification_templates migration:', err);
  process.exit(1);
} finally {
  await pool.end();
}
