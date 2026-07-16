import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import 'dotenv/config';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = 'http://localhost:5055';

let woId, origJcId, newJcId, token;
const results = [];
const check = (name, ok) => { results.push([name, ok]); };

try {
  // 0) Login as super admin (real HTTP auth)
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@setuppf.com', password: 'password123' })
  });
  const loginJson = await loginRes.json();
  token = loginJson.token;
  check('login as SUPER_ADMIN returns token', loginRes.status === 200 && !!token);
  if (!token) throw new Error('login failed: ' + JSON.stringify(loginJson));

  // 1) Pull valid FK ids from an existing WO (read only, no mutation)
  const src = (await pool.query(
    `SELECT oem_id, dealership_id, showroom_id, created_by_user_id, vehicle_model_id, service_id, assigned_partner_id
       FROM work_orders WHERE reg_no = 'W1KLG5ABITL011104' LIMIT 1`)).rows[0];
  if (!src) throw new Error('source WO for FK ids not found');
  const partnerId = src.assigned_partner_id;

  // 2) Create a throwaway WO (ASSIGNED) + original job card (PENDING_APPROVAL)
  woId = (await pool.query(
    `INSERT INTO work_orders (oem_id, dealership_id, showroom_id, created_by_user_id, vehicle_model_id, service_id, status, reg_no, customer_name, estimated_price, assigned_partner_id)
     VALUES ($1,$2,$3,$4,$5,$6,'ASSIGNED','TEST-REWORK-E2E','E2E Original',90000,$7) RETURNING id`,
    [src.oem_id, src.dealership_id, src.showroom_id, src.created_by_user_id, src.vehicle_model_id, src.service_id, partnerId])).rows[0].id;
  origJcId = (await pool.query(
    `INSERT INTO job_cards (work_order_id, partner_id, status, billing_value) VALUES ($1,$2,'PENDING_APPROVAL',90000) RETURNING id`,
    [woId, partnerId])).rows[0].id;
  await pool.query(`UPDATE work_orders SET assigned_job_card_id=$1 WHERE id=$2`, [origJcId, woId]);
  console.log(`Setup: WO ${woId}, original JC ${origJcId}`);

  // 3) === EXERCISE THE REAL ENDPOINT === (also tests safe-field edit + regNo normalization)
  const reworkRes = await fetch(`${BASE}/api/job-cards/${origJcId}/request-rework`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ remarks: 'E2E: film had a scratch', customerName: '  E2E Reworked Name  ', regNo: 'te 12 ab 3456' })
  });
  const reworkJson = await reworkRes.json();
  check('POST request-rework returns 200', reworkRes.status === 200);
  newJcId = reworkJson?.jobCard?.id;
  check('response includes a new job card id', !!newJcId);
  check('response includes previousJobCard', !!reworkJson?.previousJobCard?.id);
  if (!newJcId) throw new Error('no new job card returned: ' + JSON.stringify(reworkJson));
  console.log(`Endpoint created new JC ${newJcId}`);

  // 4) Assert resulting DB state
  const newJc = (await pool.query(`SELECT * FROM job_cards WHERE id=$1`, [newJcId])).rows[0];
  const origJc = (await pool.query(`SELECT * FROM job_cards WHERE id=$1`, [origJcId])).rows[0];
  const wo = (await pool.query(`SELECT * FROM work_orders WHERE id=$1`, [woId])).rows[0];
  const child = (await pool.query(`SELECT id FROM job_cards WHERE rework_of_job_card_id=$1`, [origJcId])).rows;

  check('new JC links back to original (rework_of_job_card_id)', newJc.rework_of_job_card_id === origJcId);
  check('new JC starts at AWAITING_ACK', newJc.status === 'AWAITING_ACK');
  check('new JC is non-billable (billing_value 0)', Number(newJc.billing_value) === 0);
  check('new JC on same work order', newJc.work_order_id === woId);
  check('new JC keeps same partner', newJc.partner_id === partnerId);
  check('original frozen at REWORK_REQUESTED', origJc.status === 'REWORK_REQUESTED');
  check('original stores rework reason', origJc.rework_reason === 'E2E: film had a scratch');
  check('original records who/when requested', !!origJc.rework_requested_by && !!origJc.rework_requested_at);
  check('WO now points at the new card', wo.assigned_job_card_id === newJcId);
  check('WO re-opened to ASSIGNED', wo.status === 'ASSIGNED');
  check('safe edit applied: customer_name trimmed', wo.customer_name === 'E2E Reworked Name');
  check('safe edit applied: reg_no normalized (upper, no spaces)', wo.reg_no === 'TE12AB3456');
  check('reverse link (reworked as) resolves to exactly the new card', child.length === 1 && child[0].id === newJcId);

  // 5) Guard: a card that hasn't reached approval yet cannot be reworked (400).
  //    The new card is AWAITING_ACK, so reworking it must be rejected (and create nothing).
  const earlyRes = await fetch(`${BASE}/api/job-cards/${newJcId}/request-rework`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ remarks: 'should be blocked - not yet at approval' })
  });
  check('rework rejected from AWAITING_ACK (status guard = 400)', earlyRes.status === 400);
} catch (e) {
  console.error('TEST ERROR:', e.message);
  check('no unexpected error thrown', false);
} finally {
  // 6) Cleanup — remove everything we created (FK-safe order), then verify
  try {
    for (const jc of [origJcId, newJcId].filter(Boolean)) {
      await pool.query(`DELETE FROM approvals WHERE job_card_id=$1`, [jc]);
      await pool.query(`DELETE FROM payouts WHERE job_card_id=$1`, [jc]);
    }
    if (woId) await pool.query(`DELETE FROM commissions WHERE work_order_id=$1`, [woId]);
    if (woId) await pool.query(`UPDATE work_orders SET assigned_job_card_id=NULL WHERE id=$1`, [woId]);
    for (const jc of [newJcId, origJcId].filter(Boolean)) await pool.query(`DELETE FROM job_cards WHERE id=$1`, [jc]);
    if (woId) await pool.query(`DELETE FROM work_orders WHERE id=$1`, [woId]);
    const leftWo = woId ? (await pool.query(`SELECT count(*)::int c FROM work_orders WHERE id=$1`, [woId])).rows[0].c : 0;
    const leftJc = (await pool.query(`SELECT count(*)::int c FROM job_cards WHERE id = ANY($1)`, [[origJcId, newJcId].filter(Boolean)])).rows[0].c;
    console.log(`\nCleanup verify -> work_orders left: ${leftWo}, job_cards left: ${leftJc}`);
    check('cleanup removed all throwaway rows', leftWo === 0 && leftJc === 0);
  } catch (ce) {
    console.error('CLEANUP ERROR (manual cleanup needed):', ce.message, { woId, origJcId, newJcId });
    check('cleanup succeeded', false);
  }
  await pool.end();

  console.log('\n===== RESULTS =====');
  let pass = 0;
  for (const [name, ok] of results) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (ok) pass++; }
  console.log(`\n${pass}/${results.length} checks passed`);
}
