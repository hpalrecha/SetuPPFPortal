-- Dedicated job-card statuses for checkup (15-day follow-up) cards, so they don't read
-- as a normal SCHEDULED job and a reschedule keeps them a checkup. Idempotent.
ALTER TYPE job_card_status ADD VALUE IF NOT EXISTS 'CHECKUP_SCHEDULED';
ALTER TYPE job_card_status ADD VALUE IF NOT EXISTS 'CHECKUP_DONE';
