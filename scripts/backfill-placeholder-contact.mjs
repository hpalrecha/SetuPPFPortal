// One-time backfill: give every work order missing a customer phone/email an
// identifiable placeholder so it can sync to ERPNext/Pulse.
//   Phone: "1111" + 6-digit sequence (1111000001 …), starts with 1 (never a real
//          mobile), stays valid "as a number". Email: "<phone>@noreply.plus91inc.in".
// Idempotent: only fills blanks; re-running is safe (already-filled rows are skipped).
//
// Usage:  node scripts/backfill-placeholder-contact.mjs          (DRY RUN, no writes)
//         node scripts/backfill-placeholder-contact.mjs --apply  (writes changes)

import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import 'dotenv/config';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL });

const APPLY = process.argv.includes('--apply');
const EMAIL_DOMAIN = 'noreply.plus91inc.in';
const PREFIX = '1111';
const digits = (v) => (v || '').replace(/\D/g, '');
const blank = (v) => !v || String(v).trim() === '';
const fmtPhone = (seq) => PREFIX + String(seq).padStart(6, '0');

// Current max sequence already in use, so we never reuse one.
const maxRes = await pool.query(`
  SELECT COALESCE(MAX(CAST(SUBSTRING(regexp_replace(customer_phone,'\\D','','g') FROM 5) AS INTEGER)),0) AS max_seq
  FROM work_orders
  WHERE regexp_replace(customer_phone,'\\D','','g') ~ '^1111[0-9]{6}$'`);
let seq = Number(maxRes.rows[0].max_seq);
console.log(`Starting from sequence ${seq} (next = ${seq + 1})`);

const { rows } = await pool.query(`
  SELECT id, customer_name, customer_phone, customer_email
  FROM work_orders
  WHERE (customer_phone IS NULL OR trim(customer_phone) = '')
     OR (customer_email IS NULL OR trim(customer_email) = '')
  ORDER BY created_at ASC`);

console.log(`Work orders needing contact: ${rows.length}\n`);

let phonesAssigned = 0, emailsAssigned = 0, samples = [];
for (const wo of rows) {
  let phone = wo.customer_phone;
  const phoneWasBlank = blank(phone);
  if (phoneWasBlank) { seq += 1; phone = fmtPhone(seq); phonesAssigned++; }

  let email = wo.customer_email;
  const emailWasBlank = blank(email);
  if (emailWasBlank) { email = `${digits(phone)}@${EMAIL_DOMAIN}`; emailsAssigned++; }

  if (APPLY) {
    await pool.query(
      `UPDATE work_orders SET customer_phone = $1, customer_email = $2, updated_at = now() WHERE id = $3`,
      [phone, email, wo.id]
    );
  }
  if (samples.length < 8) {
    samples.push({ id: wo.id.slice(-6), name: wo.customer_name, phone, email });
  }
}

console.log('Sample of assignments:');
console.table(samples);
console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN (no writes)'} — phones assigned: ${phonesAssigned}, emails assigned: ${emailsAssigned}`);
if (!APPLY) console.log('Re-run with --apply to write these changes.');

await pool.end();
