-- Cluster 3 — appointment reminders + reply capture.
-- job_reminders: dedup ledger so each reminder fires once per job card.
-- notification_logs.reply/reply_at: manually-logged reply/outcome shown via the eye button.
-- Idempotent; safe to re-run / apply via `npm run db:push`.
CREATE TABLE IF NOT EXISTS job_reminders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id  uuid NOT NULL REFERENCES job_cards(id),
  reminder_key text NOT NULL,
  sent_at      timestamp DEFAULT now(),
  CONSTRAINT job_reminder_card_key_uq UNIQUE (job_card_id, reminder_key)
);

ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS reply text;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS reply_at timestamp;
