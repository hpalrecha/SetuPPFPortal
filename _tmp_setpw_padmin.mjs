import { neonConfig, Pool } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import ws from 'ws';
import 'dotenv/config';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL });

const username = 'tushar_partner';
const newPassword = 'admin123';
const hash = await bcrypt.hash(newPassword, 10);

const { rows } = await pool.query(
  `UPDATE users SET password_hash = $1, updated_at = now()
    WHERE username = $2 AND role = 'PARTNER_ADMIN'
  RETURNING id, username, name, role, is_active`,
  [hash, username]
);

console.log('Updated rows:', rows.length);
console.log(JSON.stringify(rows, null, 2));
if (rows.length) {
  const check = await pool.query('SELECT password_hash FROM users WHERE username = $1', [username]);
  console.log('Verify:', await bcrypt.compare(newPassword, check.rows[0].password_hash));
}
await pool.end();
