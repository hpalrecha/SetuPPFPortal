-- Initial seed data for SetuPPF application

-- Create OEMs
INSERT INTO oems (id, name, brand_code, logo_url, active) VALUES
  (gen_random_uuid(), 'Tata Motors', 'TATA', null, true),
  (gen_random_uuid(), 'Kia Motors', 'KIA', null, true);

-- Get OEM IDs for reference
DO $$
DECLARE
  tata_oem_id UUID;
  kia_oem_id UUID;
  tata_dealership1_id UUID;
  tata_dealership2_id UUID;
  kia_dealership1_id UUID;
  tata_showroom1_id UUID;
  tata_showroom2_id UUID;
  kia_showroom1_id UUID;
  partner1_id UUID;
  partner2_id UUID;
  service1_id UUID;
  service2_id UUID;
  service3_id UUID;
  brand1_id UUID;
  brand2_id UUID;
  model1_id UUID;
  model2_id UUID;
  model3_id UUID;
BEGIN
  -- Get OEM IDs
  SELECT id INTO tata_oem_id FROM oems WHERE brand_code = 'TATA';
  SELECT id INTO kia_oem_id FROM oems WHERE brand_code = 'KIA';

  -- Create Dealerships
  INSERT INTO dealerships (id, oem_id, name, code, active) VALUES
    (gen_random_uuid(), tata_oem_id, 'Tata Motors Delhi', 'TATA_DEL', true),
    (gen_random_uuid(), tata_oem_id, 'Tata Motors Mumbai', 'TATA_MUM', true),
    (gen_random_uuid(), kia_oem_id, 'Kia Motors Delhi', 'KIA_DEL', true);

  -- Get Dealership IDs
  SELECT id INTO tata_dealership1_id FROM dealerships WHERE code = 'TATA_DEL';
  SELECT id INTO tata_dealership2_id FROM dealerships WHERE code = 'TATA_MUM';
  SELECT id INTO kia_dealership1_id FROM dealerships WHERE code = 'KIA_DEL';

  -- Create Showrooms
  INSERT INTO showrooms (id, dealership_id, name, code, address, city, state, pincode, active) VALUES
    (gen_random_uuid(), tata_dealership1_id, 'Tata Connaught Place', 'TATA_CP', 'Connaught Place', 'Delhi', 'Delhi', '110001', true),
    (gen_random_uuid(), tata_dealership2_id, 'Tata Andheri', 'TATA_ANH', 'Andheri West', 'Mumbai', 'Maharashtra', '400058', true),
    (gen_random_uuid(), kia_dealership1_id, 'Kia Dwarka', 'KIA_DWK', 'Dwarka Sector 12', 'Delhi', 'Delhi', '110075', true);

  -- Get Showroom IDs
  SELECT id INTO tata_showroom1_id FROM showrooms WHERE code = 'TATA_CP';
  SELECT id INTO tata_showroom2_id FROM showrooms WHERE code = 'TATA_ANH';
  SELECT id INTO kia_showroom1_id FROM showrooms WHERE code = 'KIA_DWK';

  -- Create Services
  INSERT INTO services (id, name, code, description) VALUES
    (gen_random_uuid(), 'PPF Full Body', 'PPF_FULL', 'Complete paint protection film coverage'),
    (gen_random_uuid(), 'PPF Partial', 'PPF_PARTIAL', 'Partial paint protection film coverage'),
    (gen_random_uuid(), 'Window Film', 'WINDOW_FILM', 'Window tinting and protection film');

  -- Get Service IDs
  SELECT id INTO service1_id FROM services WHERE code = 'PPF_FULL';
  SELECT id INTO service2_id FROM services WHERE code = 'PPF_PARTIAL';
  SELECT id INTO service3_id FROM services WHERE code = 'WINDOW_FILM';

  -- Create Vehicle Brands
  INSERT INTO vehicle_brands (id, oem_id, name) VALUES
    (gen_random_uuid(), tata_oem_id, 'Tata'),
    (gen_random_uuid(), kia_oem_id, 'Kia');

  -- Get Brand IDs
  SELECT id INTO brand1_id FROM vehicle_brands WHERE name = 'Tata';
  SELECT id INTO brand2_id FROM vehicle_brands WHERE name = 'Kia';

  -- Create Vehicle Models
  INSERT INTO vehicle_models (id, brand_id, model_name, variant) VALUES
    (gen_random_uuid(), brand1_id, 'Harrier', 'XZ+'),
    (gen_random_uuid(), brand1_id, 'Safari', 'XZA+'),
    (gen_random_uuid(), brand2_id, 'Seltos', 'HTX+');

  -- Get Model IDs
  SELECT id INTO model1_id FROM vehicle_models WHERE model_name = 'Harrier';
  SELECT id INTO model2_id FROM vehicle_models WHERE model_name = 'Safari';
  SELECT id INTO model3_id FROM vehicle_models WHERE model_name = 'Seltos';

  -- Create Partners
  INSERT INTO partners (id, type, display_name, gstin, pan, address, city, state, phone, active) VALUES
    (gen_random_uuid(), 'STUDIO', 'DetailCare Studio', 'GST123456789', 'ABCDE1234F', 'Sector 18, Noida', 'Noida', 'Uttar Pradesh', '+919876543210', true),
    (gen_random_uuid(), 'INSTALLER', 'ProShield Installers', 'GST987654321', 'FGHIJ5678K', 'Gurgaon Cyber City', 'Gurgaon', 'Haryana', '+919876543211', true);

  -- Get Partner IDs
  SELECT id INTO partner1_id FROM partners WHERE display_name = 'DetailCare Studio';
  SELECT id INTO partner2_id FROM partners WHERE display_name = 'ProShield Installers';

  -- Create Users
  INSERT INTO users (id, email, phone, password_hash, role, oem_id, dealership_id, showroom_id, partner_id, is_active, name) VALUES
    -- Super Admin
    (gen_random_uuid(), 'admin@setuppf.com', '+919999999999', '$2a$10$example.hash', 'SUPER_ADMIN', null, null, null, null, true, 'Super Admin'),
    
    -- OEM Admins
    (gen_random_uuid(), 'admin@tata.com', '+919999999998', '$2a$10$example.hash', 'OEM_ADMIN', tata_oem_id, null, null, null, true, 'Tata Admin'),
    (gen_random_uuid(), 'admin@kia.com', '+919999999997', '$2a$10$example.hash', 'OEM_ADMIN', kia_oem_id, null, null, null, true, 'Kia Admin'),
    
    -- Showroom Managers
    (gen_random_uuid(), 'manager@tatacp.com', '+919999999996', '$2a$10$example.hash', 'SHOWROOM_MANAGER', tata_oem_id, tata_dealership1_id, tata_showroom1_id, null, true, 'Sarah Johnson'),
    (gen_random_uuid(), 'manager@tataanh.com', '+919999999995', '$2a$10$example.hash', 'SHOWROOM_MANAGER', tata_oem_id, tata_dealership2_id, tata_showroom2_id, null, true, 'Rajesh Gupta'),
    
    -- Sales Persons
    (gen_random_uuid(), 'sales1@tatacp.com', '+919999999994', '$2a$10$example.hash', 'SALES_PERSON', tata_oem_id, tata_dealership1_id, tata_showroom1_id, null, true, 'Rahul Verma'),
    (gen_random_uuid(), 'sales2@tatacp.com', '+919999999993', '$2a$10$example.hash', 'SALES_PERSON', tata_oem_id, tata_dealership1_id, tata_showroom1_id, null, true, 'Priya Sharma'),
    
    -- Partner Users
    (gen_random_uuid(), 'admin@detailcare.com', '+919999999992', '$2a$10$example.hash', 'PARTNER_ADMIN', null, null, null, partner1_id, true, 'DetailCare Admin'),
    (gen_random_uuid(), 'admin@proshield.com', '+919999999991', '$2a$10$example.hash', 'PARTNER_ADMIN', null, null, null, partner2_id, true, 'ProShield Admin');

  -- Create Sales Persons
  INSERT INTO sales_persons (id, showroom_id, name, phone, email, active) VALUES
    (gen_random_uuid(), tata_showroom1_id, 'Rahul Verma', '+919999999994', 'sales1@tatacp.com', true),
    (gen_random_uuid(), tata_showroom1_id, 'Priya Sharma', '+919999999993', 'sales2@tatacp.com', true),
    (gen_random_uuid(), tata_showroom2_id, 'Amit Kumar', '+919999999990', 'sales3@tataanh.com', true);

  -- Create Partner Allocations
  INSERT INTO allocations (id, level, level_id, partner_id, priority, active) VALUES
    -- DetailCare Studio allocated to Tata CP showroom with priority 1
    (gen_random_uuid(), 'SHOWROOM', tata_showroom1_id, partner1_id, 1, true),
    -- ProShield allocated to Tata dealership (all showrooms) with priority 2
    (gen_random_uuid(), 'DEALERSHIP', tata_dealership1_id, partner2_id, 2, true),
    -- DetailCare Studio allocated to Kia showroom with priority 1
    (gen_random_uuid(), 'SHOWROOM', kia_showroom1_id, partner1_id, 1, true);

  -- Create Pricing Rules
  INSERT INTO pricing_rules (id, partner_id, scope, scope_id, vehicle_model_id, service_id, price_amount, currency, effective_from, effective_to, status) VALUES
    -- DetailCare Studio pricing for Tata Harrier PPF Full at CP showroom
    (gen_random_uuid(), partner1_id, 'SHOWROOM', tata_showroom1_id, model1_id, service1_id, 45000.00, 'INR', '2024-01-01', null, 'ACTIVE'),
    -- DetailCare Studio pricing for PPF Partial at CP showroom
    (gen_random_uuid(), partner1_id, 'SHOWROOM', tata_showroom1_id, null, service2_id, 25000.00, 'INR', '2024-01-01', null, 'ACTIVE'),
    -- ProShield pricing for Tata dealership (all models, PPF Full)
    (gen_random_uuid(), partner2_id, 'DEALERSHIP', tata_dealership1_id, null, service1_id, 42000.00, 'INR', '2024-01-01', null, 'ACTIVE'),
    -- ProShield pricing for Kia Seltos PPF Full
    (gen_random_uuid(), partner2_id, 'SHOWROOM', kia_showroom1_id, model3_id, service1_id, 40000.00, 'INR', '2024-01-01', null, 'ACTIVE');

  -- Create Commission Rules
  INSERT INTO commission_rules (id, showroom_id, sales_person_id, service_id, type, value_numeric, cap_amount, floor_amount, effective_from, effective_to, status) VALUES
    -- Rahul Verma commission: 8% with cap 5000, floor 1000
    (gen_random_uuid(), tata_showroom1_id, (SELECT id FROM sales_persons WHERE name = 'Rahul Verma'), null, 'PERCENT', 8.00, 5000.00, 1000.00, '2024-01-01', null, 'ACTIVE'),
    -- Priya Sharma commission: Fixed 3500 for PPF Full Body
    (gen_random_uuid(), tata_showroom1_id, (SELECT id FROM sales_persons WHERE name = 'Priya Sharma'), service1_id, 'AMOUNT', 3500.00, null, null, '2024-01-01', null, 'ACTIVE'),
    -- Default showroom commission: 5%
    (gen_random_uuid(), tata_showroom1_id, null, null, 'PERCENT', 5.00, null, 500.00, '2024-01-01', null, 'ACTIVE');

END $$;

-- Insert configuration data
INSERT INTO idempotency_keys (key, first_seen_at, response_hash) VALUES
  ('setup-complete', NOW(), 'initial-setup') 
ON CONFLICT (key) DO NOTHING;

-- Print completion message
DO $$
BEGIN
  RAISE NOTICE 'Initial seed data inserted successfully!';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '- 2 OEMs (Tata Motors, Kia Motors)';
  RAISE NOTICE '- 3 Dealerships';
  RAISE NOTICE '- 3 Showrooms';
  RAISE NOTICE '- 9 Users (including admin accounts)';
  RAISE NOTICE '- 3 Sales Persons';
  RAISE NOTICE '- 2 Partners';
  RAISE NOTICE '- 3 Allocations';
  RAISE NOTICE '- 4 Pricing Rules';
  RAISE NOTICE '- 3 Commission Rules';
  RAISE NOTICE '- 3 Services';
  RAISE NOTICE '- 2 Vehicle Brands';
  RAISE NOTICE '- 3 Vehicle Models';
END $$;
