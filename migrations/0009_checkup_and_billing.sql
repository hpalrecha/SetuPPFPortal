-- 15-day checkup (linked checkup job card) + post-approval billing trail with an editable price.
-- Idempotent; safe to re-run / apply via `npm run db:push`.
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS checkup_of_job_card_id uuid;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS checkup_due_at timestamp;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS checkup_done_at timestamp;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS checkup_notes text;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS billing_trail_json jsonb;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS billing_price numeric(12,2);
