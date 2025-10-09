-- CORRECTED: Step-by-step diagnostic and fix for Manickcbag Automobiles showrooms

-- Step 1: Verify Dealership exists
SELECT id, name, code 
FROM dealerships 
WHERE id = 'c1ad5c16-3af9-41c1-a478-fb6bca8dce9e';

-- Step 2: Verify TATA OEM exists
SELECT id, name, brand_code 
FROM oems 
WHERE id = '798eadc0-908f-4efd-ae77-231b706cb559';

-- Step 3: Check if TATA is linked to Manickcbag Automobiles (in mapping table)
SELECT * FROM dealership_oem_mapping 
WHERE dealership_id = 'c1ad5c16-3af9-41c1-a478-fb6bca8dce9e' 
AND oem_id = '798eadc0-908f-4efd-ae77-231b706cb559';

-- Step 4: If NO mapping exists, ADD IT (THIS IS THE FIX):
INSERT INTO dealership_oem_mapping (dealership_id, oem_id, status)
VALUES (
  'c1ad5c16-3af9-41c1-a478-fb6bca8dce9e',
  '798eadc0-908f-4efd-ae77-231b706cb559',
  'active'
)
ON CONFLICT DO NOTHING;

-- Step 5: Check if showroom codes already exist
SELECT code, name FROM showrooms 
WHERE code IN ('MAN353-HB', 'MAN353-DW', 'MAN353-HV', 'MAN353-BG', 'MAN353-GOA', 'MAN353-CK', 'MAN353-KB', 'MAN353-BD', 'MAN353-YD');

-- Step 6: If codes exist and you want to replace them, delete first (CAREFUL!)
-- DELETE FROM showrooms WHERE code IN ('MAN353-HB', 'MAN353-DW', 'MAN353-HV', 'MAN353-BG', 'MAN353-GOA', 'MAN353-CK', 'MAN353-KB', 'MAN353-BD', 'MAN353-YD');

-- Step 7: Now your INSERT statements should work!
-- Copy all INSERT statements from manickcbag_showrooms.sql
