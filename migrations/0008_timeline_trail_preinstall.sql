-- Corrected flow: keep one job card and record reschedules/team-changes/pre-install as a trail,
-- and make pre-installation an explicit pass/fail gate. Idempotent; safe to re-run.
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS timeline_trail jsonb;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS pre_install_result text;
