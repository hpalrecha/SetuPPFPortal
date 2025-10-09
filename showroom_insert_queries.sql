-- SQL Queries to Add TATA Showrooms to Production Database
-- IMPORTANT: Run these queries in your production database console

-- Step 1: Get TATA OEM ID (replace 'TATA_OEM_ID_HERE' with actual ID from this query)
-- SELECT id FROM oems WHERE name = 'TATA Motors' OR brand_code LIKE '%TATA%';

-- Step 2: Get Dealership IDs (to verify mappings)
-- SELECT id, name, code FROM dealerships WHERE oem_id = 'TATA_OEM_ID_HERE' ORDER BY name;

-- Step 3: Insert Showrooms (Update TATA_OEM_ID and DEALERSHIP_IDs based on above queries)

-- 1. Kropex Auto - Hosur Road
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Kropex Auto' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Kropex Auto - Hosur Road',
  'KRO690-HR',
  '7608074168',
  'Hosur Road',
  'Bangalore',
  true
);

-- 2. Kropex Auto - Sa/Ajur
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Kropex Auto' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Kropex Auto - Sa/Ajur',
  'KRO690-SA',
  '9167524154',
  'Sa/Ajur',
  'Bangalore',
  true
);

-- 3. Kropex Auto - Rajajinagar
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Kropex Auto' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Kropex Auto - Rajajinagar',
  'KRO690-RJ',
  '8291920371',
  'Rajajinagar',
  'Bangalore',
  true
);

-- 4. Prerana Motors - Lalbagh Road
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Prerana Motors' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Prerana Motors - Lalbagh Road',
  'PRE784-LR',
  '7506024202',
  'Lalbagh Road',
  'Bangalore',
  true
);

-- 5. Prerana Motors - BTM Layout
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Prerana Motors' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Prerana Motors - BTM Layout',
  'PRE784-BTM',
  '7506014210',
  'BTM Layout',
  'Bangalore',
  true
);

-- 6. Prerana Motors - Rajajinagar
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Prerana Motors' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Prerana Motors - Rajajinagar',
  'PRE784-RJ',
  '7506024319',
  'Rajajinagar',
  'Bangalore',
  true
);

-- 7. Prerana Motors - Yelahanka
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Prerana Motors' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Prerana Motors - Yelahanka',
  'PRE784-YL',
  '9614944339',
  'Yelahanka',
  'Bangalore',
  true
);

-- 8. Bellad Enterprises Pvt Ltd - Bommanahalli
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Bellad Enterprises Pvt Ltd' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Bellad Enterprises Pvt Ltd - Bommanahalli',
  'BEL185-BM',
  '8123851815 / 9035151610',
  'Bommanahalli',
  'Bangalore',
  true
);

-- 9. Cauvery Motors - Avalahalli
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Cauvery Motors' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Cauvery Motors - Avalahalli',
  'CAU344-AV',
  '8298440980',
  'Avalahalli',
  'Bangalore',
  true
);

-- 10. Cauvery Motors - Mekhri Circle
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Cauvery Motors' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Cauvery Motors - Mekhri Circle',
  'CAU344-MC',
  '2242720689',
  'Mekhri Circle',
  'Bangalore',
  true
);

-- 11. Cauvery Motors - Devanahalli
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Cauvery Motors' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Cauvery Motors - Devanahalli',
  'CAU344-DV',
  '8971731503',
  'Devanahalli',
  'Bangalore',
  true
);

-- 12. Adishakti Cars - Hebbal
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Adishakti Cars' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Adishakti Cars - Hebbal',
  'ADI932-HB',
  '7506028871',
  'Hebbal',
  'Bangalore',
  true
);

-- 13. Adishakti Cars - Dasarahalli
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Adishakti Cars' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Adishakti Cars - Dasarahalli',
  'ADI932-DS',
  '9167524836',
  'Dasarahalli',
  'Bangalore',
  true
);

-- 14. Adishakti Cars - Kalyan Nagar
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Adishakti Cars' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Adishakti Cars - Kalyan Nagar',
  'ADI932-KN',
  '9617630167',
  'Kalyan Nagar',
  'Bangalore',
  true
);

-- 15. KHT Motors - Whitefield
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'KHT Motors' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'KHT Motors - Whitefield',
  'KHT384-WF',
  '7506021981',
  'Whitefield',
  'Bangalore',
  true
);

-- 16. KHT Motors - Domlur
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'KHT Motors' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'KHT Motors - Domlur',
  'KHT384-DM',
  '7506024004',
  'Domlur',
  'Bangalore',
  true
);

-- 17. KHT Motors - Koramangala
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'KHT Motors' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'KHT Motors - Koramangala',
  'KHT384-KM',
  '9731146956',
  'Koramangala',
  'Bangalore',
  true
);

-- 18. Key Motors - Kanakapura Road
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Key Motors' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Key Motors - Kanakapura Road',
  'KEY260-KR',
  '9614955400',
  'Kanakapura Road',
  'Bangalore',
  true
);

-- 19. Key Motors - Banasawadi
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Key Motors' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Key Motors - Banasawadi',
  'KEY260-BN',
  '9614943368',
  'Banasawadi',
  'Bangalore',
  true
);

-- 20. Key Motors - J.P. Nagar
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Key Motors' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Key Motors - J.P. Nagar',
  'KEY260-JP',
  '9614955673',
  'J.P. Nagar',
  'Bangalore',
  true
);

-- 21. Sree Auto - Tumkur
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Sree Auto' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Sree Auto - Tumkur',
  'SRE221-TK',
  '7506024181',
  'Tumkur',
  'Tumkur',
  true
);

-- 22. Sree Auto - Tiptur
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Sree Auto' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Sree Auto - Tiptur',
  'SRE221-TP',
  '9615030468',
  'Tiptur',
  'Tiptur',
  true
);

-- 23. Sree Auto - Chitballapur
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Sree Auto' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Sree Auto - Chitballapur',
  'SRE221-CB',
  '9167028429',
  'Chitballapur',
  'Chitballapur',
  true
);

-- 24. Sree Auto - Chikkamagalur
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Sree Auto' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Sree Auto - Chikkamagalur',
  'SRE221-CM',
  '8197162478',
  'Chikkamagalur',
  'Chikkamagalur',
  true
);

-- 25. Manickcbag Automobiles - Hubli
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Manickcbag Automobiles - Hubli',
  'MAN353-HB',
  '7506014313',
  'Hubli',
  'Hubli',
  true
);

-- 26. Manickcbag Automobiles - Dharwad
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Manickcbag Automobiles - Dharwad',
  'MAN353-DW',
  '8872985898',
  'Dharwad',
  'Dharwad',
  true
);

-- 27. Manickcbag Automobiles - Haveri
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Manickcbag Automobiles - Haveri',
  'MAN353-HV',
  '9615048941',
  'Haveri',
  'Haveri',
  true
);

-- 28. Manickcbag Automobiles - Belgaum
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Manickcbag Automobiles - Belgaum',
  'MAN353-BG',
  '9615049831',
  'Belgaum',
  'Belgaum',
  true
);

-- 29. Manickcbag Automobiles - Goa
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Manickcbag Automobiles - Goa',
  'MAN353-GOA',
  '9615045770',
  'Goa',
  'Goa',
  true
);

-- 30. Manickcbag Automobiles - Chikodi
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Manickcbag Automobiles - Chikodi',
  'MAN353-CK',
  '8197192674',
  'Chikodi',
  'Chikodi',
  true
);

-- 31. Bellad Enterprises - Haliyal
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Bellad Enterprises' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Bellad Enterprises - Haliyal',
  'BELZ-HL',
  '7506015245',
  'Haliyal',
  'Haliyal',
  true
);

-- 32. Bellad Enterprises - Dharwad
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Bellad Enterprises' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Bellad Enterprises - Dharwad',
  'BELZ-DW',
  '8123053128',
  'Dharwad',
  'Dharwad',
  true
);

-- 33. Bellad Enterprises - Gadag
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Bellad Enterprises' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Bellad Enterprises - Gadag',
  'BELZ-GD',
  '8123461234',
  'Gadag',
  'Gadag',
  true
);

-- 34. Bellad Enterprises - Gokak
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Bellad Enterprises' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Bellad Enterprises - Gokak',
  'BELZ-GK',
  '8123474284',
  'Gokak',
  'Gokak',
  true
);

-- 35. Bellad Enterprises - Sindhnur
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Bellad Enterprises' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Bellad Enterprises - Sindhnur',
  'BELZ-SD',
  '8105110081',
  'Sindhnur',
  'Sindhnur',
  true
);

-- 36. Manickcbag Automobiles - Kalburgi
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Manickcbag Automobiles - Kalburgi',
  'MAN353-KB',
  '9615048434',
  'Kalburgi',
  'Kalburgi',
  true
);

-- 37. Manickcbag Automobiles - Bidar
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Manickcbag Automobiles - Bidar',
  'MAN353-BD',
  '9121038042',
  'Bidar',
  'Bidar',
  true
);

-- 38. Manickcbag Automobiles - Yadgir
INSERT INTO showrooms (dealership_id, oem_id, name, code, contact_phone, address, city, active)
VALUES (
  (SELECT id FROM dealerships WHERE name = 'Manickcbag Automobiles' LIMIT 1),
  'TATA_OEM_ID_HERE',
  'Manickcbag Automobiles - Yadgir',
  'MAN353-YD',
  '9740746406',
  'Yadgir',
  'Yadgir',
  true
);

-- Step 4: Verify insertions
-- SELECT s.id, s.name, s.code, s.contact_phone, s.city, d.name as dealership_name
-- FROM showrooms s
-- JOIN dealerships d ON s.dealership_id = d.id
-- WHERE s.oem_id = 'TATA_OEM_ID_HERE'
-- ORDER BY d.name, s.name;
