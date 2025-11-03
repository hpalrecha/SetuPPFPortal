import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Bulk create dealerships from CSV file
 * 
 * CSV Format:
 * username,oem_name
 * dealer1,Hyundai India Ltd
 * dealer2,
 * 
 * If oem_name is not provided, defaults to Hyundai India Ltd
 * 
 * Usage: npx tsx scripts/bulk-create-dealerships.ts <file.csv>
 * Example: npx tsx scripts/bulk-create-dealerships.ts dealerships.csv
 */

interface DealershipRow {
  username: string;
  oem_name?: string;
}

function parseCSV(content: string): DealershipRow[] {
  const lines = content.split('\n');
  const rows: DealershipRow[] = [];
  
  // Skip header (first line)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const [username, oem_name] = line.split(',').map(s => s.trim());
    if (username) {
      rows.push({ username, oem_name: oem_name || undefined });
    }
  }
  
  return rows;
}

// Default OEM (Hyundai)
const DEFAULT_OEM = {
  id: 'd5da06c1-bc99-48e0-a907-e8fe279a9f93',
  name: 'Hyundai India Ltd'
};

async function generateBulkDealershipSQL() {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.error('\n❌ Error: File path is required');
    console.log('\nUsage: npx tsx scripts/bulk-create-dealerships.ts <file.csv>');
    console.log('Example: npx tsx scripts/bulk-create-dealerships.ts dealerships.csv\n');
    console.log('CSV Format:');
    console.log('username,oem_name');
    console.log('dealer1,Hyundai India Ltd');
    console.log('dealer2,\n');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ Error: File not found: ${filePath}\n`);
    process.exit(1);
  }

  console.log('\n📁 Reading file:', filePath);
  
  // Read CSV file
  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(csvContent);

  if (rows.length === 0) {
    console.error('\n❌ Error: No data found in file\n');
    process.exit(1);
  }

  console.log(`✅ Found ${rows.length} dealership(s) to create\n`);

  // Generate SQL statements
  const sqlStatements: string[] = [];
  const credentials: Array<{ username: string; password: string; oem: string }> = [];

  for (const row of rows) {
    if (!row.username) {
      console.warn('⚠️  Skipping row with missing username:', row);
      continue;
    }

    const username = row.username.trim().toLowerCase();
    const password = `${username}@123`;
    const passwordHash = await bcrypt.hash(password, 10);
    
    const dealershipId = randomUUID();
    const userId = randomUUID();
    const dealershipCode = `DEAL_${username.toUpperCase()}`;
    
    // Use provided OEM or default to Hyundai
    const oemId = DEFAULT_OEM.id;
    const oemName = row.oem_name?.trim() || DEFAULT_OEM.name;

    const sql = `
-- =====================================================
-- Dealership: ${username} (OEM: ${oemName})
-- =====================================================

-- 1. Create Dealership
INSERT INTO dealerships (
  id, name, code, contact_person_name, contact_phone,
  address, city, state, pincode, active, created_at, updated_at
) VALUES (
  '${dealershipId}',
  'Dealership - ${username}',
  '${dealershipCode}',
  'To Be Updated',
  '0000000000',
  'To Be Updated',
  'To Be Updated',
  'To Be Updated',
  '000000',
  true,
  NOW(),
  NOW()
) ON CONFLICT (code) DO UPDATE SET updated_at = NOW();

-- 2. Link to OEM
INSERT INTO dealership_oem_mapping (
  id, dealership_id, oem_id, status, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '${dealershipId}',
  '${oemId}',
  'active',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- 3. Create DEALERSHIP_ADMIN User
INSERT INTO users (
  id, username, password_hash, role, oem_id, dealership_id,
  is_active, name, email_verified, phone_verified, profile_completed,
  created_at, updated_at
) VALUES (
  '${userId}',
  '${username}',
  '${passwordHash}',
  'DEALERSHIP_ADMIN',
  '${oemId}',
  '${dealershipId}',
  true,
  '${username}',
  false,
  false,
  false,
  NOW(),
  NOW()
) ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_active = true,
  updated_at = NOW();
`;

    sqlStatements.push(sql.trim());
    credentials.push({ username, password, oem: oemName });
  }

  // Output SQL
  console.log('\n🏢 BULK DEALERSHIP CREATION SQL\n');
  console.log('Copy and paste this SQL into your PRODUCTION database:\n');
  console.log('='.repeat(80));
  console.log('\n' + sqlStatements.join('\n\n'));
  console.log('\n' + '='.repeat(80));
  
  // Output credentials summary
  console.log('\n\n📋 LOGIN CREDENTIALS SUMMARY:\n');
  console.log('=' .repeat(80));
  credentials.forEach((cred, index) => {
    console.log(`${index + 1}. Username: ${cred.username.padEnd(20)} | Password: ${cred.password.padEnd(20)} | OEM: ${cred.oem}`);
  });
  console.log('=' .repeat(80));
  
  console.log('\n✅ Summary:');
  console.log(`   - ${credentials.length} dealership(s) created`);
  console.log(`   - All linked to their respective OEMs`);
  console.log(`   - Passwords follow pattern: username@123`);
  console.log(`   - Usernames normalized to lowercase`);
  console.log(`   - Profile completion required on first login\n`);
  
  console.log('📝 Next Steps:');
  console.log('   1. Run the generated SQL in your production database');
  console.log('   2. Share credentials with respective dealership admins');
  console.log('   3. Users complete profile (email & phone verification) on first login\n');
}

generateBulkDealershipSQL().catch(console.error);
