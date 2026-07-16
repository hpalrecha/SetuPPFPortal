-- Rework chaining: when a job card is reworked, a NEW job card is created against the
-- same work order and this column points back to the original card it reworks.
-- Soft link (no FK), matching the pattern of work_orders.assigned_job_card_id.
-- Idempotent + nullable + no default => safe, non-locking add on Postgres.
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS rework_of_job_card_id uuid;
