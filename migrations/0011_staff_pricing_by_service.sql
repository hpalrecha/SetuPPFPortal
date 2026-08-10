-- Staff Pricing now keys on an individual service (service_id) instead of a service
-- category. service_id already exists on pricing_rules, so this only swaps the uniqueness
-- guard from service_category_id → service_id. Idempotent; safe to re-run.
DROP INDEX IF EXISTS uniq_staff_pricing_combo;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_staff_pricing_combo
  ON pricing_rules (
    staff_user_id,
    billing_entity_type,
    COALESCE(billing_entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    showroom_id,
    service_id
  )
  WHERE staff_user_id IS NOT NULL AND status = 'ACTIVE';
