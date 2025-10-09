-- Add TATA Motors OEM and TATA brand with 14 vehicle models

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
DO $$
DECLARE
  tata_oem_id UUID := '798eadc0-908f-4efd-ae77-231b706cb559';
BEGIN
  
  -- 3.1 Tiago (Hatchback)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Tiago', 'hatchback', true);

  -- 3.2 Tigor (Sedan)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Tigor', 'sedan', true);

  -- 3.3 Punch (SUV)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Punch', 'suv', true);

  -- 3.4 Altroz (Hatchback)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Altroz', 'hatchback', true);

  -- 3.5 Nexon (SUV)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Nexon', 'suv', true);

  -- 3.6 Harrier (SUV)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Harrier', 'suv', true);

  -- 3.7 Safari (SUV)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Safari', 'suv', true);

  -- 3.8 Curvv (SUV)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Curvv', 'suv', true);

  -- 3.9 Tiago EV (Hatchback)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Tiago EV', 'hatchback', true);

  -- 3.10 Tigor EV (Sedan)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Tigor EV', 'sedan', true);

  -- 3.11 Punch EV (SUV)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Punch EV', 'suv', true);

  -- 3.12 Nexon EV (SUV)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Nexon EV', 'suv', true);

  -- 3.13 Curvv EV (SUV)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Curvv EV', 'suv', true);

  -- 3.14 Harrier EV (SUV)
  INSERT INTO vehicle_models (id, oem_id, model_name, vehicle_type, active)
  VALUES (gen_random_uuid(), tata_oem_id, 'Harrier EV', 'suv', true);

END $$;

-- 4. Verify the additions
SELECT 'OEM Created:' as info, id, name FROM oems WHERE name = 'TATA Motors'
UNION ALL
SELECT 'Brand Created:', id, name FROM brands WHERE name = 'TATA'
UNION ALL
SELECT 'Vehicle Models Created:', COUNT(*)::text::uuid, 'Total' FROM vehicle_models 
WHERE oem_id = '798eadc0-908f-4efd-ae77-231b706cb559';

-- List all TATA vehicles
SELECT vm.id, vm.model_name, vm.vehicle_type, o.name as oem
FROM vehicle_models vm
JOIN oems o ON vm.oem_id = o.id
WHERE o.name = 'TATA Motors'
ORDER BY vm.model_name;
