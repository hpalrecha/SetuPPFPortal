// Targeted, idempotent: adds job_cards.rework_job_card_id (primary → its latest rework card).
//   Usage:  node scripts/apply-rework-link.mjs
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(`ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS rework_job_card_id uuid;`);
  console.log('✅ job_cards.rework_job_card_id column is in place.');
} catch (err) {
  console.error('❌ Migration failed:', err);
  process.exit(1);
} finally {
  await pool.end();
}
