-- Per-team payout lines behind the Payout Settlement card. One TEAM line per team that
-- worked a card (outgoing team captured at each reschedule-handoff, final team at
-- completion) plus manual REWORK lines. Single-team cards freeze the amount from the
-- Staff Pricing rule; multi-team cards leave amount NULL for a manual roll-based split.
-- Idempotent; safe to re-run.
CREATE TABLE IF NOT EXISTS job_card_payout_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id    uuid NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  staff_user_id  uuid NOT NULL REFERENCES users(id),
  team_type      team_type,
  line_type      text NOT NULL,            -- 'TEAM' | 'REWORK'
  paid_by_party  text,                     -- 'COMPANY' | 'PARTNER' (rework)
  roll_used_sqft numeric(10,2),
  amount         numeric(10,2),            -- NULL = to be entered manually at settlement
  amount_source  text,                     -- 'MATRIX' | 'MANUAL'
  pricing_rule_id uuid REFERENCES pricing_rules(id),
  note           text,
  created_at     timestamp DEFAULT now(),
  updated_at     timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_card_payout_lines_job_card_idx ON job_card_payout_lines (job_card_id);
CREATE INDEX IF NOT EXISTS job_card_payout_lines_staff_idx ON job_card_payout_lines (staff_user_id);
