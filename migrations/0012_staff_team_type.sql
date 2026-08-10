-- Team classification on staff users, for payout billing direction:
--   COMPANY (our team), PARTNER (a partner admin's team), FREELANCE (independent).
-- Adds the team_type enum + a nullable users.team_type column. Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_type') THEN
    CREATE TYPE team_type AS ENUM ('COMPANY', 'PARTNER', 'FREELANCE');
  END IF;
END$$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS team_type team_type;
