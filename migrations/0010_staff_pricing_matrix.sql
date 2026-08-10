-- Staff Pricing matrix (Phase A): individual-staff payout rules keyed on
-- staff × billing entity (Company or a Partner) × showroom × service category.
-- Adds a new pricing_type enum value + four nullable columns on pricing_rules,
-- reusing the existing service_category_id / price_amount / effective_* / status.
-- Idempotent; safe to re-run. Apply via: node scripts/apply-roll-used.mjs is unrelated —
-- run: node scripts/apply-staff-pricing.mjs   (then optionally `npm run db:push`).

ALTER TYPE pricing_type ADD VALUE IF NOT EXISTS 'STAFF_PRICING';

ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS staff_user_id uuid REFERENCES users(id);
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS billing_entity_type text;
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS billing_entity_id uuid REFERENCES partners(id);
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS showroom_id uuid REFERENCES showrooms(id);

-- Prevent duplicate ACTIVE staff-pricing rules for the exact same combination.
-- COALESCE gives COMPANY rows (billing_entity_id IS NULL) a stable key so Postgres
-- treats two COMPANY rows for the same combo as equal (distinct NULLs would not collide).
-- The predicate scopes on `staff_user_id IS NOT NULL` rather than the pricing_type enum:
--   * staff_user_id is populated ONLY for STAFF_PRICING rows, so this uniquely targets them;
--   * it is IMMUTABLE (an enum::text cast is only STABLE and is rejected in index predicates);
--   * it avoids referencing the freshly-added 'STAFF_PRICING' enum value, which cannot be
--     used in the same transaction it was added in (this file runs as one batch).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_staff_pricing_combo
  ON pricing_rules (
    staff_user_id,
    billing_entity_type,
    COALESCE(billing_entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    showroom_id,
    service_category_id
  )
  WHERE staff_user_id IS NOT NULL AND status = 'ACTIVE';
