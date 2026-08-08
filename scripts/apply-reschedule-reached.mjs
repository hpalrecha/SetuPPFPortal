// Targeted, idempotent apply of migrations/0005_add_reschedule_reached.sql.
// Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so we run each
// statement separately (the neon http/ws query runs them outside an explicit tx).
//   Usage:  node scripts/apply-reschedule-reached.mjs
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set.');
  process.exit(1);
}

const statements = [
  `ALTER TYPE job_card_status ADD VALUE IF NOT EXISTS 'REACHED'`,
  `ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS reschedule_count integer DEFAULT 0`,
  `ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS reschedule_reason text`,
  `ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS reached_at timestamp`,
  `ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS reached_by uuid REFERENCES users(id)`,
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const s of statements) {
    await pool.query(s);
    console.log('✓', s.slice(0, 60));
  }
  console.log('✅ Reschedule/Reached migration applied.');
} catch (err) {
  console.error('❌ Migration failed:', err);
  process.exit(1);
} finally {
  await pool.end();
}
