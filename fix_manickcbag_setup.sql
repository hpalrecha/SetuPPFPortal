-- Step 1: Verify Dealership exists and check OEM linkage
SELECT id, name, code, oem_ids 
FROM dealerships 
WHERE id = 'c1ad5c16-3af9-41c1-a478-fb6bca8dce9e';

-- Step 2: Verify TATA OEM exists
SELECT id, name, brand_code 
FROM oems 
WHERE id = '798eadc0-908f-4efd-ae77-231b706cb559';

-- Step 3: Check if TATA is linked to Manickcbag Automobiles dealership
-- If NOT, you need to add TATA to the dealership's oemIds array:
UPDATE dealerships 
SET oem_ids = array_append(oem_ids, '798eadc0-908f-4efd-ae77-231b706cb559')
WHERE id = 'c1ad5c16-3af9-41c1-a478-fb6bca8dce9e'
AND NOT ('798eadc0-908f-4efd-ae77-231b706cb559' = ANY(oem_ids));

-- Step 4: Check if showroom codes already exist
SELECT code, name FROM showrooms 
WHERE code IN ('MAN353-HB', 'MAN353-DW', 'MAN353-HV', 'MAN353-BG', 'MAN353-GOA', 'MAN353-CK', 'MAN353-KB', 'MAN353-BD', 'MAN353-YD');

-- Step 5: If codes exist, delete them first (CAREFUL - only if safe to do so)
-- DELETE FROM showrooms WHERE code IN ('MAN353-HB', 'MAN353-DW', 'MAN353-HV', 'MAN353-BG', 'MAN353-GOA', 'MAN353-CK', 'MAN353-KB', 'MAN353-BD', 'MAN353-YD');

-- Step 6: Now run the INSERT statements from the original file
-- After fixing the above issues, the original INSERT statements should work
