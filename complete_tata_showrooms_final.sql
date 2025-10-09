-- ============================================================================
-- COMPLETE SQL SCRIPT FOR ALL TATA SHOWROOMS
-- ============================================================================
-- TATA Motors OEM ID: 798eadc0-908f-4efd-ae77-231b706cb559
-- Default State: Karnataka, Default Pincode: 560004
-- ============================================================================

-- STEP 1: Ensure all dealerships are linked to TATA Motors OEM
-- ============================================================================

-- Add TATA to dealerships (if not already linked)
INSERT INTO dealership_oem_mapping (dealership_id, oem_id, status)
SELECT d.id, '798eadc0-908f-4efd-ae77-231b706cb559', 'active'
FROM dealerships d
WHERE d.name IN (
  'Kropex Auto', 'Prerana Motors', 'Bellad Enterprises Pvt Ltd', 'Cauvery Motors', 
  'Adishakti Cars', 'KHT Motors', 'Key Motors', 'Sree Auto', 
  'Manickcbag Automobiles', 'Bellad Enterprises', 'Autohanger'
)
AND NOT EXISTS (
  SELECT 1 FROM dealership_oem_mapping 
  WHERE dealership_id = d.id 
  AND oem_id = '798eadc0-908f-4efd-ae77-231b706cb559'
);

-- STEP 2: INSERT ALL SHOWROOMS
-- ============================================================================

-- Kropex Auto Showrooms (3)
INSERT INTO showrooms (dealership_id, oem_id, name, code, manager_name, contact_phone, city, state, pincode, active)
VALUES 
  ((SELECT id FROM dealerships WHERE name = 'Kropex Auto' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Kropex Auto - Hosur Road', 'KRO690-HR', 'Kropex Auto - Hosur Road', '7608074168', 'Hosur Road', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Kropex Auto' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Kropex Auto - Sa/Ajur', 'KRO690-SA', 'Kropex Auto - Sa/Ajur', '9167524154', 'Sa/Ajur', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Kropex Auto' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Kropex Auto - Rajajinagar', 'KRO690-RJ', 'Kropex Auto - Rajajinagar', '8291920371', 'Rajajinagar', 'Karnataka', '560004', true);

-- Prerana Motors Showrooms (4)
INSERT INTO showrooms (dealership_id, oem_id, name, code, manager_name, contact_phone, city, state, pincode, active)
VALUES 
  ((SELECT id FROM dealerships WHERE name = 'Prerana Motors' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Prerana Motors - Lalbagh Road', 'PRE784-LR', 'Prerana Motors - Lalbagh Road', '7506024202', 'Lalbagh Road', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Prerana Motors' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Prerana Motors - BTM Layout', 'PRE784-BTM', 'Prerana Motors - BTM Layout', '7506014210', 'BTM Layout', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Prerana Motors' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Prerana Motors - Rajajinagar', 'PRE784-RJ', 'Prerana Motors - Rajajinagar', '7506024319', 'Rajajinagar', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Prerana Motors' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Prerana Motors - Yelahanka', 'PRE784-YL', 'Prerana Motors - Yelahanka', '9614944339', 'Yelahanka', 'Karnataka', '560004', true);

-- Bellad Enterprises Pvt Ltd Showrooms (1)
INSERT INTO showrooms (dealership_id, oem_id, name, code, manager_name, contact_phone, city, state, pincode, active)
VALUES 
  ((SELECT id FROM dealerships WHERE name = 'Bellad Enterprises Pvt Ltd' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Bellad Enterprises Pvt Ltd - Bommanahalli', 'BEL185-BM', 'Bellad Enterprises Pvt Ltd - Bommanahalli', '8123851815', 'Bommanahalli', 'Karnataka', '560004', true);

-- Cauvery Motors Showrooms (3)
INSERT INTO showrooms (dealership_id, oem_id, name, code, manager_name, contact_phone, city, state, pincode, active)
VALUES 
  ((SELECT id FROM dealerships WHERE name = 'Cauvery Motors' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Cauvery Motors - Avalahalli', 'CAU344-AV', 'Cauvery Motors - Avalahalli', '8298440980', 'Avalahalli', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Cauvery Motors' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Cauvery Motors - Mekhri Circle', 'CAU344-MC', 'Cauvery Motors - Mekhri Circle', '2242720689', 'Mekhri Circle', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Cauvery Motors' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Cauvery Motors - Devanahalli', 'CAU344-DV', 'Cauvery Motors - Devanahalli', '8971731503', 'Devanahalli', 'Karnataka', '560004', true);

-- Adishakti Cars Showrooms (3)
INSERT INTO showrooms (dealership_id, oem_id, name, code, manager_name, contact_phone, city, state, pincode, active)
VALUES 
  ((SELECT id FROM dealerships WHERE name = 'Adishakti Cars' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Adishakti Cars - Hebbal', 'ADI932-HB', 'Adishakti Cars - Hebbal', '7506028871', 'Hebbal', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Adishakti Cars' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Adishakti Cars - Dasarahalli', 'ADI932-DS', 'Adishakti Cars - Dasarahalli', '9167524836', 'Dasarahalli', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Adishakti Cars' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Adishakti Cars - Kalyan Nagar', 'ADI932-KN', 'Adishakti Cars - Kalyan Nagar', '9617630167', 'Kalyan Nagar', 'Karnataka', '560004', true);

-- KHT Motors Showrooms (3)
INSERT INTO showrooms (dealership_id, oem_id, name, code, manager_name, contact_phone, city, state, pincode, active)
VALUES 
  ((SELECT id FROM dealerships WHERE name = 'KHT Motors' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'KHT Motors - Whitefield', 'KHT384-WF', 'KHT Motors - Whitefield', '7506021981', 'Whitefield', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'KHT Motors' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'KHT Motors - Domlur', 'KHT384-DM', 'KHT Motors - Domlur', '7506024004', 'Domlur', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'KHT Motors' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'KHT Motors - Koramangala', 'KHT384-KM', 'KHT Motors - Koramangala', '9731146956', 'Koramangala', 'Karnataka', '560004', true);

-- Key Motors Showrooms (3)
INSERT INTO showrooms (dealership_id, oem_id, name, code, manager_name, contact_phone, city, state, pincode, active)
VALUES 
  ((SELECT id FROM dealerships WHERE name = 'Key Motors' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Key Motors - Kanakapura Road', 'KEY260-KR', 'Key Motors - Kanakapura Road', '9614955400', 'Kanakapura Road', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Key Motors' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Key Motors - Banasawadi', 'KEY260-BN', 'Key Motors - Banasawadi', '9614943368', 'Banasawadi', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Key Motors' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Key Motors - J.P. Nagar', 'KEY260-JP', 'Key Motors - J.P. Nagar', '9614955673', 'J.P. Nagar', 'Karnataka', '560004', true);

-- Sree Auto Showrooms (4)
INSERT INTO showrooms (dealership_id, oem_id, name, code, manager_name, contact_phone, city, state, pincode, active)
VALUES 
  ((SELECT id FROM dealerships WHERE name = 'Sree Auto' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Sree Auto - Tumkur', 'SRE221-TK', 'Sree Auto - Tumkur', '7506024181', 'Tumkur', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Sree Auto' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Sree Auto - Tiptur', 'SRE221-TP', 'Sree Auto - Tiptur', '9615030468', 'Tiptur', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Sree Auto' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Sree Auto - Chitballapur', 'SRE221-CB', 'Sree Auto - Chitballapur', '9167028429', 'Chitballapur', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Sree Auto' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Sree Auto - Chikkamagalur', 'SRE221-CM', 'Sree Auto - Chikkamagalur', '8197162478', 'Chikkamagalur', 'Karnataka', '560004', true);

-- Manickcbag Automobiles Showrooms (9)
INSERT INTO showrooms (dealership_id, oem_id, name, code, manager_name, contact_phone, city, state, pincode, active)
VALUES 
  ((SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Manickcbag Automobiles - Hubli', 'MAN353-HB', 'Manickcbag Automobiles - Hubli', '7506014313', 'Hubli', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Manickcbag Automobiles - Dharwad', 'MAN353-DW', 'Manickcbag Automobiles - Dharwad', '8872985898', 'Dharwad', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Manickcbag Automobiles - Haveri', 'MAN353-HV', 'Manickcbag Automobiles - Haveri', '9615048941', 'Haveri', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Manickcbag Automobiles - Belgaum', 'MAN353-BG', 'Manickcbag Automobiles - Belgaum', '9615049831', 'Belgaum', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Manickcbag Automobiles - Goa', 'MAN353-GOA', 'Manickcbag Automobiles - Goa', '9615045770', 'Goa', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Manickcbag Automobiles - Chikodi', 'MAN353-CK', 'Manickcbag Automobiles - Chikodi', '8197192674', 'Chikodi', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Manickcbag Automobiles - Kalburgi', 'MAN353-KB', 'Manickcbag Automobiles - Kalburgi', '9615048434', 'Kalburgi', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Manickcbag Automobiles - Bidar', 'MAN353-BD', 'Manickcbag Automobiles - Bidar', '9121038042', 'Bidar', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Manickcbag Automobiles - Yadgir', 'MAN353-YD', 'Manickcbag Automobiles - Yadgir', '9740746406', 'Yadgir', 'Karnataka', '560004', true);

-- Bellad Enterprises Showrooms (5)
INSERT INTO showrooms (dealership_id, oem_id, name, code, manager_name, contact_phone, city, state, pincode, active)
VALUES 
  ((SELECT id FROM dealerships WHERE name = 'Bellad Enterprises' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Bellad Enterprises - Haliyal', 'BELZ-HL', 'Bellad Enterprises - Haliyal', '7506015245', 'Haliyal', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Bellad Enterprises' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Bellad Enterprises - Dharwad', 'BELZ-DW', 'Bellad Enterprises - Dharwad', '8123053128', 'Dharwad', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Bellad Enterprises' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Bellad Enterprises - Gadag', 'BELZ-GD', 'Bellad Enterprises - Gadag', '8123461234', 'Gadag', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Bellad Enterprises' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Bellad Enterprises - Gokak', 'BELZ-GK', 'Bellad Enterprises - Gokak', '8123474284', 'Gokak', 'Karnataka', '560004', true),
  ((SELECT id FROM dealerships WHERE name = 'Bellad Enterprises' LIMIT 1), '798eadc0-908f-4efd-ae77-231b706cb559', 'Bellad Enterprises - Sindhnur', 'BELZ-SD', 'Bellad Enterprises - Sindhnur', '8105110081', 'Sindhnur', 'Karnataka', '560004', true);

-- STEP 3: VERIFICATION QUERY
-- ============================================================================
-- Run this to verify all showrooms were created successfully
SELECT 
  s.name AS showroom_name, 
  s.code, 
  s.contact_phone, 
  s.city,
  d.name AS dealership_name,
  o.name AS oem_name
FROM showrooms s
JOIN dealerships d ON s.dealership_id = d.id
JOIN oems o ON s.oem_id = o.id
WHERE s.oem_id = '798eadc0-908f-4efd-ae77-231b706cb559'
ORDER BY d.name, s.name;

-- Count by dealership
SELECT d.name AS dealership, COUNT(s.id) AS showroom_count
FROM dealerships d
LEFT JOIN showrooms s ON s.dealership_id = d.id AND s.oem_id = '798eadc0-908f-4efd-ae77-231b706cb559'
WHERE d.name IN (
  'Kropex Auto', 'Prerana Motors', 'Bellad Enterprises Pvt Ltd', 'Cauvery Motors', 
  'Adishakti Cars', 'KHT Motors', 'Key Motors', 'Sree Auto', 
  'Manickcbag Automobiles', 'Bellad Enterprises'
)
GROUP BY d.name
ORDER BY d.name;
