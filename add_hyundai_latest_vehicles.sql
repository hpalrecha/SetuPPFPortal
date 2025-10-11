-- Latest Hyundai India Vehicle Models and Variants (2024-2025)
-- OEM ID: d5da06c1-bc99-48e0-a907-e8fe279a9f93 (Hyundai India Ltd)

-- ============================================
-- HATCHBACKS
-- ============================================

-- 1. Grand i10 Nios (Hatchback)
INSERT INTO vehicle_models (id, model_name, oem_id, vehicle_type, active, created_at, updated_at)
VALUES (gen_random_uuid(), 'Grand i10 Nios', 'd5da06c1-bc99-48e0-a907-e8fe279a9f93', 'HATCHBACK', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO vehicle_variants (id, model_id, variant_name, fuel_type, transmission, engine_capacity, active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  vm.id,
  variant.name,
  variant.fuel,
  variant.trans,
  variant.engine,
  true,
  NOW(),
  NOW()
FROM vehicle_models vm
CROSS JOIN (
  VALUES 
    ('Era', 'Petrol', 'Manual', '1.2L'),
    ('Magna', 'Petrol', 'Manual', '1.2L'),
    ('Sportz', 'Petrol', 'Manual', '1.2L'),
    ('Sportz AMT', 'Petrol', 'AMT', '1.2L'),
    ('Asta', 'Petrol', 'Manual', '1.2L'),
    ('Asta AMT', 'Petrol', 'AMT', '1.2L'),
    ('Sportz Turbo', 'Petrol', 'Manual', '1.0L Turbo'),
    ('Asta Turbo', 'Petrol', 'Manual', '1.0L Turbo')
) AS variant(name, fuel, trans, engine)
WHERE vm.model_name = 'Grand i10 Nios' AND vm.oem_id = 'd5da06c1-bc99-48e0-a907-e8fe279a9f93'
ON CONFLICT DO NOTHING;

-- 2. i20 (Premium Hatchback)
INSERT INTO vehicle_models (id, model_name, oem_id, vehicle_type, active, created_at, updated_at)
VALUES (gen_random_uuid(), 'i20', 'd5da06c1-bc99-48e0-a907-e8fe279a9f93', 'HATCHBACK', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO vehicle_variants (id, model_id, variant_name, fuel_type, transmission, engine_capacity, active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  vm.id,
  variant.name,
  variant.fuel,
  variant.trans,
  variant.engine,
  true,
  NOW(),
  NOW()
FROM vehicle_models vm
CROSS JOIN (
  VALUES 
    ('Magna', 'Petrol', 'Manual', '1.2L'),
    ('Sportz', 'Petrol', 'Manual', '1.2L'),
    ('Sportz iVT', 'Petrol', 'CVT', '1.2L'),
    ('Asta', 'Petrol', 'Manual', '1.2L'),
    ('Asta iVT', 'Petrol', 'CVT', '1.2L'),
    ('Asta (O)', 'Petrol', 'Manual', '1.2L'),
    ('Asta (O) iVT', 'Petrol', 'CVT', '1.2L')
) AS variant(name, fuel, trans, engine)
WHERE vm.model_name = 'i20' AND vm.oem_id = 'd5da06c1-bc99-48e0-a907-e8fe279a9f93'
ON CONFLICT DO NOTHING;

-- 3. i20 N Line (Sporty Hatchback)
INSERT INTO vehicle_models (id, model_name, oem_id, vehicle_type, active, created_at, updated_at)
VALUES (gen_random_uuid(), 'i20 N Line', 'd5da06c1-bc99-48e0-a907-e8fe279a9f93', 'HATCHBACK', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO vehicle_variants (id, model_id, variant_name, fuel_type, transmission, engine_capacity, active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  vm.id,
  variant.name,
  variant.fuel,
  variant.trans,
  variant.engine,
  true,
  NOW(),
  NOW()
FROM vehicle_models vm
CROSS JOIN (
  VALUES 
    ('N6 MT', 'Petrol', 'Manual', '1.0L Turbo'),
    ('N6 DCT', 'Petrol', 'DCT', '1.0L Turbo'),
    ('N8 MT', 'Petrol', 'Manual', '1.0L Turbo'),
    ('N8 DCT', 'Petrol', 'DCT', '1.0L Turbo'),
    ('N10 DCT', 'Petrol', 'DCT', '1.0L Turbo')
) AS variant(name, fuel, trans, engine)
WHERE vm.model_name = 'i20 N Line' AND vm.oem_id = 'd5da06c1-bc99-48e0-a907-e8fe279a9f93'
ON CONFLICT DO NOTHING;

-- ============================================
-- SEDANS
-- ============================================

-- 4. Aura (Compact Sedan)
INSERT INTO vehicle_models (id, model_name, oem_id, vehicle_type, active, created_at, updated_at)
VALUES (gen_random_uuid(), 'Aura', 'd5da06c1-bc99-48e0-a907-e8fe279a9f93', 'SEDAN', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO vehicle_variants (id, model_id, variant_name, fuel_type, transmission, engine_capacity, active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  vm.id,
  variant.name,
  variant.fuel,
  variant.trans,
  variant.engine,
  true,
  NOW(),
  NOW()
FROM vehicle_models vm
CROSS JOIN (
  VALUES 
    ('E', 'Petrol', 'Manual', '1.2L'),
    ('S', 'Petrol', 'Manual', '1.2L'),
    ('S AMT', 'Petrol', 'AMT', '1.2L'),
    ('SX', 'Petrol', 'Manual', '1.2L'),
    ('SX AMT', 'Petrol', 'AMT', '1.2L'),
    ('SX(O)', 'Petrol', 'Manual', '1.2L'),
    ('S CNG', 'CNG', 'Manual', '1.2L'),
    ('SX CNG', 'CNG', 'Manual', '1.2L')
) AS variant(name, fuel, trans, engine)
WHERE vm.model_name = 'Aura' AND vm.oem_id = 'd5da06c1-bc99-48e0-a907-e8fe279a9f93'
ON CONFLICT DO NOTHING;

-- ============================================
-- SUVs
-- ============================================

-- 5. Exter (Micro SUV)
INSERT INTO vehicle_models (id, model_name, oem_id, vehicle_type, active, created_at, updated_at)
VALUES (gen_random_uuid(), 'Exter', 'd5da06c1-bc99-48e0-a907-e8fe279a9f93', 'SUV', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO vehicle_variants (id, model_id, variant_name, fuel_type, transmission, engine_capacity, active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  vm.id,
  variant.name,
  variant.fuel,
  variant.trans,
  variant.engine,
  true,
  NOW(),
  NOW()
FROM vehicle_models vm
CROSS JOIN (
  VALUES 
    ('EX', 'Petrol', 'Manual', '1.2L'),
    ('S', 'Petrol', 'Manual', '1.2L'),
    ('S AMT', 'Petrol', 'AMT', '1.2L'),
    ('SX', 'Petrol', 'Manual', '1.2L'),
    ('SX AMT', 'Petrol', 'AMT', '1.2L'),
    ('SX(O)', 'Petrol', 'Manual', '1.2L'),
    ('SX(O) AMT', 'Petrol', 'AMT', '1.2L'),
    ('SX(O) Connect', 'Petrol', 'AMT', '1.2L'),
    ('S CNG', 'CNG', 'Manual', '1.2L'),
    ('SX CNG', 'CNG', 'Manual', '1.2L')
) AS variant(name, fuel, trans, engine)
WHERE vm.model_name = 'Exter' AND vm.oem_id = 'd5da06c1-bc99-48e0-a907-e8fe279a9f93'
ON CONFLICT DO NOTHING;

-- 6. Creta (Best-selling SUV)
INSERT INTO vehicle_models (id, model_name, oem_id, vehicle_type, active, created_at, updated_at)
VALUES (gen_random_uuid(), 'Creta', 'd5da06c1-bc99-48e0-a907-e8fe279a9f93', 'SUV', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO vehicle_variants (id, model_id, variant_name, fuel_type, transmission, engine_capacity, active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  vm.id,
  variant.name,
  variant.fuel,
  variant.trans,
  variant.engine,
  true,
  NOW(),
  NOW()
FROM vehicle_models vm
CROSS JOIN (
  VALUES 
    ('E', 'Petrol', 'Manual', '1.5L'),
    ('EX', 'Petrol', 'Manual', '1.5L'),
    ('S', 'Petrol', 'Manual', '1.5L'),
    ('S iVT', 'Petrol', 'CVT', '1.5L'),
    ('SX', 'Petrol', 'Manual', '1.5L'),
    ('SX iVT', 'Petrol', 'CVT', '1.5L'),
    ('SX(O)', 'Petrol', 'Manual', '1.5L'),
    ('SX(O) iVT', 'Petrol', 'CVT', '1.5L'),
    ('Turbo S', 'Petrol', 'Manual', '1.5L Turbo'),
    ('Turbo S DCT', 'Petrol', 'DCT', '1.5L Turbo'),
    ('Turbo SX', 'Petrol', 'Manual', '1.5L Turbo'),
    ('Turbo SX DCT', 'Petrol', 'DCT', '1.5L Turbo'),
    ('Turbo SX(O)', 'Petrol', 'Manual', '1.5L Turbo'),
    ('Turbo SX(O) DCT', 'Petrol', 'DCT', '1.5L Turbo'),
    ('Diesel S', 'Diesel', 'Manual', '1.5L'),
    ('Diesel SX', 'Diesel', 'Manual', '1.5L'),
    ('Diesel SX AT', 'Diesel', 'Automatic', '1.5L'),
    ('Diesel SX(O)', 'Diesel', 'Manual', '1.5L'),
    ('Diesel SX(O) AT', 'Diesel', 'Automatic', '1.5L'),
    ('Knight Edition', 'Petrol', 'DCT', '1.5L Turbo'),
    ('N Line', 'Petrol', 'DCT', '1.5L Turbo')
) AS variant(name, fuel, trans, engine)
WHERE vm.model_name = 'Creta' AND vm.oem_id = 'd5da06c1-bc99-48e0-a907-e8fe279a9f93'
ON CONFLICT DO NOTHING;

-- 7. Tucson (Premium SUV)
INSERT INTO vehicle_models (id, model_name, oem_id, vehicle_type, active, created_at, updated_at)
VALUES (gen_random_uuid(), 'Tucson', 'd5da06c1-bc99-48e0-a907-e8fe279a9f93', 'SUV', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO vehicle_variants (id, model_id, variant_name, fuel_type, transmission, engine_capacity, active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  vm.id,
  variant.name,
  variant.fuel,
  variant.trans,
  variant.engine,
  true,
  NOW(),
  NOW()
FROM vehicle_models vm
CROSS JOIN (
  VALUES 
    ('Platinum', 'Petrol', 'Automatic', '2.0L'),
    ('Platinum AWD', 'Petrol', 'Automatic', '2.0L'),
    ('Signature', 'Petrol', 'Automatic', '2.0L'),
    ('Signature AWD', 'Petrol', 'Automatic', '2.0L'),
    ('Diesel Platinum', 'Diesel', 'Automatic', '2.0L'),
    ('Diesel Platinum AWD', 'Diesel', 'Automatic', '2.0L'),
    ('Diesel Signature', 'Diesel', 'Automatic', '2.0L'),
    ('Diesel Signature AWD', 'Diesel', 'Automatic', '2.0L')
) AS variant(name, fuel, trans, engine)
WHERE vm.model_name = 'Tucson' AND vm.oem_id = 'd5da06c1-bc99-48e0-a907-e8fe279a9f93'
ON CONFLICT DO NOTHING;

-- ============================================
-- ELECTRIC VEHICLES
-- ============================================

-- 8. Creta Electric (Just launched Jan 2025)
INSERT INTO vehicle_models (id, model_name, oem_id, vehicle_type, active, created_at, updated_at)
VALUES (gen_random_uuid(), 'Creta Electric', 'd5da06c1-bc99-48e0-a907-e8fe279a9f93', 'ELECTRIC', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO vehicle_variants (id, model_id, variant_name, fuel_type, transmission, engine_capacity, active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  vm.id,
  variant.name,
  variant.fuel,
  variant.trans,
  variant.engine,
  true,
  NOW(),
  NOW()
FROM vehicle_models vm
CROSS JOIN (
  VALUES 
    ('EX Long Range', 'Electric', 'Automatic', '51.4 kWh'),
    ('SX Long Range', 'Electric', 'Automatic', '51.4 kWh'),
    ('SX(O) Long Range', 'Electric', 'Automatic', '51.4 kWh')
) AS variant(name, fuel, trans, engine)
WHERE vm.model_name = 'Creta Electric' AND vm.oem_id = 'd5da06c1-bc99-48e0-a907-e8fe279a9f93'
ON CONFLICT DO NOTHING;

-- 9. Ioniq 5 (Premium Electric)
INSERT INTO vehicle_models (id, model_name, oem_id, vehicle_type, active, created_at, updated_at)
VALUES (gen_random_uuid(), 'Ioniq 5', 'd5da06c1-bc99-48e0-a907-e8fe279a9f93', 'ELECTRIC', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO vehicle_variants (id, model_id, variant_name, fuel_type, transmission, engine_capacity, active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  vm.id,
  variant.name,
  variant.fuel,
  variant.trans,
  variant.engine,
  true,
  NOW(),
  NOW()
FROM vehicle_models vm
CROSS JOIN (
  VALUES 
    ('Long Range RWD', 'Electric', 'Automatic', '72.6 kWh'),
    ('Long Range AWD', 'Electric', 'Automatic', '72.6 kWh')
) AS variant(name, fuel, trans, engine)
WHERE vm.model_name = 'Ioniq 5' AND vm.oem_id = 'd5da06c1-bc99-48e0-a907-e8fe279a9f93'
ON CONFLICT DO NOTHING;

-- Summary query
SELECT 
  vm.model_name,
  vm.vehicle_type,
  COUNT(vv.id) as variant_count
FROM vehicle_models vm
LEFT JOIN vehicle_variants vv ON vm.id = vv.model_id
WHERE vm.oem_id = 'd5da06c1-bc99-48e0-a907-e8fe279a9f93'
GROUP BY vm.id, vm.model_name, vm.vehicle_type
ORDER BY vm.vehicle_type, vm.model_name;
