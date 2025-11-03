import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

/**
 * Bulk create showrooms from Excel/CSV file
 * 
 * Excel/CSV Format:
 * | username | dealership_code |
 * |----------|-----------------|
 * | showroom1| DEAL_DEALER1    |
 * | showroom2| DEAL_DEALER1    |
 * 
 * Usage: npx tsx scripts/bulk-create-showrooms.ts <file.xlsx>
 * Example: npx tsx scripts/bulk-create-showrooms.ts showrooms.xlsx
 * 
 * Note: You must provide dealership_code from the dealerships table
 */

interface ShowroomRow {
  username: string;
  dealership_code: string;
}

async function generateBulkShowroomSQL() {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.error('\n❌ Error: File path is required');
    console.log('\nUsage: npx tsx scripts/bulk-create-showrooms.ts <file.xlsx>');
    console.log('Example: npx tsx scripts/bulk-create-showrooms.ts showrooms.xlsx\n');
    console.log('Excel/CSV Format:');
    console.log('| username  | dealership_code |');
    console.log('|-----------|-----------------|');
    console.log('| showroom1 | DEAL_DEALER1    |');
    console.log('| showroom2 | DEAL_DEALER1    |\n');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ Error: File not found: ${filePath}\n`);
    process.exit(1);
  }

  console.log('\n📁 Reading file:', filePath);
  
  // Read Excel/CSV file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<ShowroomRow>(worksheet);

  if (rows.length === 0) {
    console.error('\n❌ Error: No data found in file\n');
    process.exit(1);
  }

  console.log(`✅ Found ${rows.length} showroom(s) to create\n`);

  // Generate SQL statements
  const sqlStatements: string[] = [];
  const credentials: Array<{ username: string; password: string; dealership: string }> = [];

  for (const row of rows) {
    if (!row.username || !row.dealership_code) {
      console.warn('⚠️  Skipping row with missing username or dealership_code:', row);
      continue;
    }

    const username = row.username.trim().toLowerCase();
    const password = `${username}@123`;
    const passwordHash = await bcrypt.hash(password, 10);
    
    const showroomId = randomUUID();
    const userId = randomUUID();
    const showroomCode = `SHW_${username.toUpperCase()}`;
    const dealershipCode = row.dealership_code.trim();

    const sql = `
-- =====================================================
-- Showroom: ${username} (Dealership: ${dealershipCode})
-- =====================================================

-- 1. Create Showroom (linked to dealership via code lookup)
WITH dealership_lookup AS (
  SELECT id, oem_id FROM dealerships WHERE code = '${dealershipCode}' LIMIT 1
),
new_showroom AS (
  INSERT INTO showrooms (
    id, name, code, dealership_id, oem_id,
    contact_person_name, contact_phone, address, city, state, pincode,
    active, created_at, updated_at
  )
  SELECT
    '${showroomId}',
    'Showroom - ${username}',
    '${showroomCode}',
    dealership_lookup.id,
    dealership_lookup.oem_id,
    'To Be Updated',
    '0000000000',
    'To Be Updated',
    'To Be Updated',
    'To Be Updated',
    '000000',
    true,
    NOW(),
    NOW()
  FROM dealership_lookup
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id, dealership_id, oem_id
)

-- 2. Create SHOWROOM_MANAGER User
INSERT INTO users (
  id, username, password_hash, role, oem_id, dealership_id, showroom_id,
  is_active, name, email_verified, phone_verified, profile_completed,
  created_at, updated_at
)
SELECT
  '${userId}',
  '${username}',
  '${passwordHash}',
  'SHOWROOM_MANAGER',
  new_showroom.oem_id,
  new_showroom.dealership_id,
  new_showroom.id,
  true,
  '${username}',
  false,
  false,
  false,
  NOW(),
  NOW()
FROM new_showroom
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_active = true,
  updated_at = NOW();
`;

    sqlStatements.push(sql.trim());
    credentials.push({ username, password, dealership: dealershipCode });
  }

  // Output SQL
  console.log('\n🏪 BULK SHOWROOM CREATION SQL\n');
  console.log('Copy and paste this SQL into your PRODUCTION database:\n');
  console.log('='.repeat(80));
  console.log('\n' + sqlStatements.join('\n\n'));
  console.log('\n' + '='.repeat(80));
  
  // Output credentials summary
  console.log('\n\n📋 LOGIN CREDENTIALS SUMMARY:\n');
  console.log('=' .repeat(80));
  credentials.forEach((cred, index) => {
    console.log(`${index + 1}. Username: ${cred.username.padEnd(20)} | Password: ${cred.password.padEnd(20)} | Dealership: ${cred.dealership}`);
  });
  console.log('=' .repeat(80));
  
  console.log('\n✅ Summary:');
  console.log(`   - ${credentials.length} showroom(s) created`);
  console.log(`   - All linked to their respective dealerships`);
  console.log(`   - Passwords follow pattern: username@123`);
  console.log(`   - Usernames normalized to lowercase`);
  console.log(`   - Profile completion required on first login\n`);
  
  console.log('📝 Next Steps:');
  console.log('   1. Run the generated SQL in your production database');
  console.log('   2. Share credentials with respective showroom managers');
  console.log('   3. Users complete profile (email & phone verification) on first login\n');
  
  console.log('⚠️  Important:');
  console.log('   - Ensure dealership_code values exist in the dealerships table');
  console.log('   - If a dealership_code is not found, the showroom will not be created\n');
}

generateBulkShowroomSQL().catch(console.error);
