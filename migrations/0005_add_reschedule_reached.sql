-- Cluster 2 — Reschedule + Reached. Adds the REACHED job-card status and reschedule/reached
-- tracking columns. Idempotent; safe to re-run / apply via `npm run db:push`.
-- (RESCHEDULED already exists in job_card_status.)
ALTER TYPE job_card_status ADD VALUE IF NOT EXISTS 'REACHED';

ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS reschedule_count integer DEFAULT 0;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS reschedule_reason text;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS reached_at timestamp;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS reached_by uuid REFERENCES users(id);
