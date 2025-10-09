-- Add TATA Motors OEM and TATA brand with 14 vehicle models

-- 1. Create TATA Motors OEM
INSERT INTO oems (id, name, contact_person, email, phone, address, gstin, status)
VALUES (
  '798eadc0-908f-4efd-ae77-231b706cb559',
  'TATA Motors',
  'Tata Motors Admin',
  'admin@tatamotors.com',
  '+91-9876543210',
  'Tata Motors Ltd, Bombay House, 24 Homi Mody Street, Mumbai, Maharashtra 400001',
  '27AAACT2727Q1ZJ',
  'active'
);

-- 2. Create TATA brand
INSERT INTO brands (id, name, logo_url, status)
VALUES (
  gen_random_uuid(),
  'TATA',
  NULL,
  'active'
);

-- Store TATA brand ID in a variable for reference
DO $$
DECLARE
  tata_brand_id UUID;
  tata_oem_id UUID := '798eadc0-908f-4efd-ae77-231b706cb559';
BEGIN
  -- Get the TATA brand ID
  SELECT id INTO tata_brand_id FROM brands WHERE name = 'TATA';

  -- 3. Add 14 TATA vehicle models
  
  -- 3.1 Tiago
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Tiago', 'Hatchback', 'active');

  -- 3.2 Tigor
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Tigor', 'Sedan', 'active');

  -- 3.3 Punch
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Punch', 'SUV', 'active');

  -- 3.4 Altroz
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Altroz', 'Hatchback', 'active');

  -- 3.5 Nexon
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Nexon', 'SUV', 'active');

  -- 3.6 Harrier
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Harrier', 'SUV', 'active');

  -- 3.7 Safari
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Safari', 'SUV', 'active');

  -- 3.8 Curvv
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Curvv', 'SUV', 'active');

  -- 3.9 Tiago EV
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Tiago EV', 'Hatchback', 'active');

  -- 3.10 Tigor EV
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Tigor EV', 'Sedan', 'active');

  -- 3.11 Punch EV
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Punch EV', 'SUV', 'active');

  -- 3.12 Nexon EV
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Nexon EV', 'SUV', 'active');

  -- 3.13 Curvv EV
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Curvv EV', 'SUV', 'active');

  -- 3.14 Harrier EV
  INSERT INTO vehicle_models (id, oem_id, brand_id, name, model_type, status)
  VALUES (gen_random_uuid(), tata_oem_id, tata_brand_id, 'Harrier EV', 'SUV', 'active');

END $$;

-- 4. Verify the additions
SELECT 'OEM Created:' as info, id, name FROM oems WHERE name = 'TATA Motors'
UNION ALL
SELECT 'Brand Created:', id, name FROM brands WHERE name = 'TATA'
UNION ALL
SELECT 'Vehicle Models Created:', COUNT(*)::text, 'Total' FROM vehicle_models 
WHERE oem_id = '798eadc0-908f-4efd-ae77-231b706cb559';

-- List all TATA vehicles
SELECT vm.id, vm.name, vm.model_type, b.name as brand, o.name as oem
FROM vehicle_models vm
JOIN brands b ON vm.brand_id = b.id
JOIN oems o ON vm.oem_id = o.id
WHERE o.name = 'TATA Motors'
ORDER BY vm.name;
