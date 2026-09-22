// One-shot, idempotent migration to add soft-delete columns to work_orders + job_cards.
// We can't use `drizzle-kit push` here because it fails while introspecting a pre-existing
// functional index (uniq_staff_pricing_combo on pricing_rules). This adds only what the
// soft-delete feature needs, using IF NOT EXISTS so it's safe to run more than once.
//
// Run:  npx tsx scripts/add-soft-delete-columns.ts
import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set (check your .env).");
}

const statements = [
  `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS deleted_at timestamp`,
  `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS deleted_reason text`,
  `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id)`,
  `CREATE INDEX IF NOT EXISTS work_orders_deleted_at_idx ON work_orders (deleted_at)`,
  `ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS deleted_at timestamp`,
  `ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS deleted_reason text`,
  `ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id)`,
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const sql of statements) {
      process.stdout.write(`→ ${sql}\n`);
      await pool.query(sql);
    }
    console.log("\n✅ Soft-delete columns are in place.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err);
  process.exit(1);
});
