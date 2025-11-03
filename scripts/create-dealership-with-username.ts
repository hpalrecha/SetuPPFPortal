import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

/**
 * Script to generate SQL for creating a DEALERSHIP with just a username
 * This creates:
 * 1. A dealership record with placeholder data for required fields
 * 2. A DEALERSHIP_ADMIN user with username and auto-generated password (username@123)
 * 3. Links the dealership to Hyundai OEM
 * 
 * Usage: npx tsx scripts/create-dealership-with-username.ts <username>
 * Example: npx tsx scripts/create-dealership-with-username.ts johndoe
 */

async function generateDealershipSQL() {
  const username = process.argv[2];
  
  if (!username) {
    console.error('\n❌ Error: Username is required');
    console.log('\nUsage: npx tsx scripts/create-dealership-with-username.ts <username>');
    console.log('Example: npx tsx scripts/create-dealership-with-username.ts johndoe\n');
    process.exit(1);
  }
  
  // Auto-generate password following pattern: username@123
  const password = `${username}@123`;
  
  // Normalize username to lowercase for consistency
  const normalizedUsername = username.toLowerCase();
  
  // Hash the password securely
  const passwordHash = await bcrypt.hash(password, 10);
  
  // Generate UUIDs
  const dealershipId = randomUUID();
  const userId = randomUUID();
  
  // Hyundai OEM ID (from database)
  const hyundaiOemId = 'd5da06c1-bc99-48e0-a907-e8fe279a9f93';
  
  // Generate dealership code from username
  const dealershipCode = `DEAL_${normalizedUsername.toUpperCase()}`;
  
  console.log('\n🏢 DEALERSHIP & USER CREATION SQL\n');
  console.log('Copy and paste this SQL into your PRODUCTION database:\n');
  console.log('---------------------------------------------------\n');
  
  const sql = `
-- =====================================================
-- Create Dealership and User for: ${normalizedUsername}
-- Auto-generated password: ${password}
-- =====================================================

-- 1. Create Dealership
INSERT INTO dealerships (
  id,
  name,
  code,
  oe_dealer_code,
  parent_code,
  oem_region,
  contact_person_name,
  contact_email,
  contact_phone,
  address,
  city,
  state,
  pincode,
  bill_to_address,
  bill_directly_to_dealership,
  active,
  created_at,
  updated_at
) VALUES (
  '${dealershipId}',
  'Dealership - ${normalizedUsername}',
  '${dealershipCode}',
  NULL,
  NULL,
  NULL,
  'To Be Updated',
  NULL,
  '0000000000',
  'To Be Updated',
  'To Be Updated',
  'To Be Updated',
  '000000',
  NULL,
  false,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (code) DO UPDATE SET
  updated_at = NOW();

-- 2. Link Dealership to Hyundai OEM
INSERT INTO dealership_oem_mapping (
  id,
  dealership_id,
  oem_id,
  status,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '${dealershipId}',
  '${hyundaiOemId}',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- 3. Create DEALERSHIP_ADMIN User
INSERT INTO users (
  id,
  username,
  email,
  phone,
  password_hash,
  role,
  oem_id,
  dealership_id,
  showroom_id,
  partner_id,
  is_active,
  name,
  email_verified,
  phone_verified,
  profile_completed,
  reset_token,
  reset_token_expiry,
  created_at,
  updated_at
) VALUES (
  '${userId}',
  '${normalizedUsername}',
  NULL,
  NULL,
  '${passwordHash}',
  'DEALERSHIP_ADMIN',
  '${hyundaiOemId}',
  '${dealershipId}',
  NULL,
  NULL,
  true,
  '${normalizedUsername}',
  false,
  false,
  false,
  NULL,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_active = true,
  updated_at = NOW();
`.trim();

  console.log(sql);
  console.log('\n---------------------------------------------------\n');
  console.log('✅ Dealership created with placeholder data');
  console.log('✅ Linked to Hyundai India Ltd OEM');
  console.log('✅ DEALERSHIP_ADMIN user created');
  console.log('✅ Password securely hashed using bcrypt');
  console.log('✅ Username normalized to lowercase for case-insensitive login');
  console.log('✅ profileCompleted = false (user will be forced to verify email/phone on first login)\n');
  console.log(`📋 Login Credentials:`);
  console.log(`   Username: ${normalizedUsername}`);
  console.log(`   Password: ${password}\n`);
  console.log('📝 Next Steps:');
  console.log('   1. User logs in with username and password');
  console.log('   2. System forces profile completion (email & phone OTP verification)');
  console.log('   3. User updates dealership details from admin panel\n');
  console.log('⚠️  User will need to complete profile before accessing the system!\n');
}

generateDealershipSQL().catch(console.error);
