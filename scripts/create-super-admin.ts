import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

/**
 * Script to generate SQL for creating a SUPER_ADMIN user
 * Run: npx tsx scripts/create-super-admin.ts
 */

async function generateSuperAdminSQL() {
  const email = 'vishal@stek-india.in';
  const password = 'vishal@123';
  const name = 'Vishal';
  
  // Hash the password securely
  const passwordHash = await bcrypt.hash(password, 10);
  const userId = randomUUID();
  
  console.log('\n🔒 SECURE SUPER ADMIN USER CREATION SQL\n');
  console.log('Copy and paste this SQL into your PRODUCTION database:\n');
  console.log('---------------------------------------------------\n');
  
  const sql = `
-- Create Super Admin User: ${email}
INSERT INTO users (
  id,
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
  reset_token,
  reset_token_expiry,
  created_at,
  updated_at
) VALUES (
  '${userId}',
  '${email}',
  NULL,
  '${passwordHash}',
  'SUPER_ADMIN',
  NULL,
  NULL,
  NULL,
  NULL,
  true,
  '${name}',
  NULL,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_active = true,
  updated_at = NOW();
`.trim();

  console.log(sql);
  console.log('\n---------------------------------------------------\n');
  console.log('✅ Password has been securely hashed using bcrypt');
  console.log('✅ If user already exists, password will be updated');
  console.log(`✅ Login with: ${email} / ${password}\n`);
  console.log('⚠️  IMPORTANT: Change this password after first login!\n');
}

generateSuperAdminSQL().catch(console.error);
