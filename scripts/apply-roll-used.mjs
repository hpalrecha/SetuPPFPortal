// Targeted, idempotent: adds job_cards.roll_used_sqft (sq ft of PPF roll used, captured when a
// STARTED job is rescheduled).  Usage:  node scripts/apply-roll-used.mjs
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
  await pool.query(`ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS roll_used_sqft numeric(10,2);`);
  console.log('✅ job_cards.roll_used_sqft column is in place.');
} catch (err) {
  console.error('❌ Migration failed:', err);
  process.exit(1);
} finally {
  await pool.end();
}
