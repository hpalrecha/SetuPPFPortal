import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import 'dotenv/config';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ids = [
  'ced851ab-1c4f-40bc-8620-9f1d6b9aad15', // tytfyhhfhy
  '30b6446a-0de3-4121-8ccd-f2df987199a4', // dummy
  'fb8b5571-93f4-4a35-b660-c05bd5596a35', // dummy test
  '12687355-915a-4cb6-9bb8-6349d59d877c', // test
  '5e8313f2-e0fe-44ca-9cec-584a38afc96f', // test jaggi
];

const checks = [
  ['work_orders (created_by_user_id)', 'SELECT count(*) FROM work_orders WHERE created_by_user_id = $1'],
  ['work_orders (cancelled_by)', 'SELECT count(*) FROM work_orders WHERE cancelled_by = $1'],
  ['job_cards (assigned_installer_id)', 'SELECT count(*) FROM job_cards WHERE assigned_installer_id = $1'],
  ['job_cards (approved_by_user_id)', 'SELECT count(*) FROM job_cards WHERE approved_by_user_id = $1'],
  ['partner_members', 'SELECT count(*) FROM partner_members WHERE user_id = $1'],
  ['partner_staff_assignments', 'SELECT count(*) FROM partner_staff_assignments WHERE user_id = $1'],
  ['detailing_partner_showrooms', 'SELECT count(*) FROM detailing_partner_showrooms WHERE detailing_partner_id = $1'],
  ['audit_logs', 'SELECT count(*) FROM audit_logs WHERE actor_user_id = $1'],
  ['otp_verifications', 'SELECT count(*) FROM otp_verifications WHERE user_id = $1'],
];

for (const id of ids) {
  const results = {};
  for (const [label, sql] of checks) {
    const { rows } = await pool.query(sql, [id]);
    results[label] = rows[0].count;
  }
  console.log(id, JSON.stringify(results));
}

await pool.end();
