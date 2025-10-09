-- Production SQL: Add TATA Motors OEM, TATA Brand, and 14 Vehicle Models

-- 1. Create TATA Motors OEM
INSERT INTO oems (
  id, 
  name, 
  brand_code,
  contact_person_name, 
  contact_email, 
  contact_phone, 
  address,
  active
)
VALUES (
  '798eadc0-908f-4efd-ae77-231b706cb559',
  'TATA Motors',
  'TATA',
  'Tata Motors Admin',
  'admin@tatamotors.com',
  '+91-9876543210',
  'Tata Motors Ltd, Bombay House, 24 Homi Mody Street, Mumbai, Maharashtra 400001',
  true
);

-- 2. Create TATA brand
INSERT INTO brands (id, name, description, active)
VALUES (
  gen_random_uuid(),
  'TATA',
  'TATA Motors PPF Brand',
  true
);

-- 3. Add 14 TATA vehicle models
INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active) VALUES
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Tiago', 'hatchback', true),
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Tigor', 'sedan', true),
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Punch', 'suv', true),
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Altroz', 'hatchback', true),
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Nexon', 'suv', true),
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Harrier', 'suv', true),
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Safari', 'suv', true),
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Curvv', 'suv', true),
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Tiago EV', 'hatchback', true),
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Tigor EV', 'sedan', true),
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Punch EV', 'suv', true),
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Nexon EV', 'suv', true),
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Curvv EV', 'suv', true),
  (gen_random_uuid(), '798eadc0-908f-4efd-ae77-231b706cb559', 'Harrier EV', 'suv', true);

-- Verification query
SELECT 'Success: Added' as status, COUNT(*) as vehicle_count 
FROM vehicle_models 
WHERE oem_id = '798eadc0-908f-4efd-ae77-231b706cb559';
