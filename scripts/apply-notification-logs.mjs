// Targeted, idempotent apply of migrations/0003_add_notification_logs.sql — creates ONLY the
// notification_logs table + indexes. Unlike `drizzle-kit push`, it touches nothing else, so it
// can't reconcile (or truncate) unrelated tables. Safe to re-run.
//   Usage:  node scripts/apply-notification-logs.mjs
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Run this in the same shell where `npm run db:push` connected.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '..', 'migrations', '0003_add_notification_logs.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  console.log('✅ notification_logs table + indexes are in place.');
} catch (err) {
  console.error('❌ Failed to apply notification_logs migration:', err);
  process.exit(1);
} finally {
  await pool.end();
}
