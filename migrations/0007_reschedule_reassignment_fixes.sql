-- Fixes to the Cluster 2 reschedule flow: attribute a reschedule to a party (Super Admin only),
-- and support reassignment-driven reschedule (new job card, old one frozen/superseded).
-- Idempotent; safe to re-run / apply via `npm run db:push`.
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS reschedule_party text;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS superseded_by_job_card_id uuid;
