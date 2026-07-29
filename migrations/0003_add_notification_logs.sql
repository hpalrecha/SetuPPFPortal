-- Outbound notification log — one row per delivery attempt (email / whatsapp / sms / push).
-- Written at the transport layer so every send is captured, plus in-app PUSH rows for the bell.
-- `read_at` powers the per-user bell (unread when null).
-- Idempotent: safe to re-run. Can also be applied via `npm run db:push` (drizzle-kit).
CREATE TABLE IF NOT EXISTS notification_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel             text NOT NULL,                 -- EMAIL | WHATSAPP | SMS | PUSH
  status              text NOT NULL,                 -- SENT | FAILED
  recipient           text,                          -- email address or phone number sent to
  recipient_user_id   uuid REFERENCES users(id),
  recipient_name      text,
  event_type          text,                          -- job_card_created, otp, password_reset, sla_ack_overdue, ...
  subject             text,                          -- email subject / WA template name / sms purpose
  body_preview        text,                          -- short plaintext preview
  payload_json        jsonb,                         -- full html/text/template params for detail view
  provider            text,                          -- AWS SES SMTP | Meta WABA | ComBirds | IN_APP | DEV_MODE
  error_message       text,                          -- failure reason when status = FAILED
  related_entity_type text,                          -- job_card | work_order | payout | ...
  related_entity_id   text,
  oem_id              uuid REFERENCES oems(id),
  read_at             timestamp,                     -- per-user in-app read state (null = unread)
  created_at          timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notif_recipient_user_idx ON notification_logs (recipient_user_id);
CREATE INDEX IF NOT EXISTS notif_created_at_idx ON notification_logs (created_at);
