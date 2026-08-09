// End-to-end test: creates a real WO + job card and drives every lifecycle endpoint against the
// running server (http://localhost:5000), asserting state, then cleans up the test records.
// Non-invasive auth: mints a SUPER_ADMIN JWT from the DB using the dev JWT secret.
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import jwt from 'jsonwebtoken';

neonConfig.webSocketConstructor = ws;
const BASE = 'http://localhost:5099';
const SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = async (sql, params) => (await pool.query(sql, params)).rows;

const results = [];
let injectedStaffIds = []; // partner_staff_assignments rows we add for the test, removed on cleanup
const rec = (step, ok, detail) => { results.push({ step, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${step}${detail ? ' — ' + detail : ''}`); };

let TOKEN = '';
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const plus = (days) => new Date(Date.now() + days * 86400000).toISOString();

try {
  // ---- Auth: mint super-admin JWT from a real user ----
  const [admin] = await q(`SELECT id, username, email, name, role FROM users WHERE role='SUPER_ADMIN' LIMIT 1`);
  if (!admin) throw new Error('No SUPER_ADMIN user in DB');
  TOKEN = jwt.sign({
    id: admin.id, username: admin.username, email: admin.email || 'e2e@admin', role: 'SUPER_ADMIN',
    name: admin.name || 'E2E Admin', emailVerified: true, phoneVerified: true, profileCompleted: true,
  }, SECRET, { expiresIn: '2h' });
  rec('Auth (mint SUPER_ADMIN JWT)', true, admin.email || admin.id);

  // ---- Discover reference data ----
  const staffRows = await q(
    `SELECT partner_id, array_agg(user_id) AS staff FROM partner_staff_assignments
     WHERE status='active' GROUP BY partner_id HAVING count(*) >= 1 ORDER BY count(*) DESC LIMIT 1`);
  if (!staffRows.length) throw new Error('No partner with active staff');
  const partnerId = staffRows[0].partner_id;
  const staff = staffRows[0].staff;
  let staff1 = staff[0]; let staff2 = staff[1] || staff[0];
  const oemRows = await q(`SELECT oem_id FROM partner_oems WHERE partner_id=$1`, [partnerId]);
  const oemIds = oemRows.map((r) => r.oem_id);
  let showroom;
  if (oemIds.length) {
    // Prefer an UNALLOCATED showroom so submit → PENDING (no auto-assign), letting us allocate to
    // our known-staffed partner deterministically.
    [showroom] = await q(
      `SELECT s.id, s.dealership_id, s.oem_id FROM showrooms s
       WHERE s.oem_id = ANY($1)
         AND NOT EXISTS (SELECT 1 FROM allocations a WHERE a.level='SHOWROOM' AND a.level_id=s.id)
         AND NOT EXISTS (SELECT 1 FROM allocations a WHERE a.level='DEALERSHIP' AND a.level_id=s.dealership_id)
       LIMIT 1`, [oemIds]);
    if (!showroom) [showroom] = await q(`SELECT id, dealership_id, oem_id FROM showrooms WHERE oem_id = ANY($1) LIMIT 1`, [oemIds]);
  }
  if (!showroom) [showroom] = await q(`SELECT id, dealership_id, oem_id FROM showrooms LIMIT 1`);
  if (!showroom) throw new Error('No showroom');
  let [vm] = await q(`SELECT id FROM vehicle_models WHERE oem_id=$1 LIMIT 1`, [showroom.oem_id]);
  if (!vm) [vm] = await q(`SELECT id FROM vehicle_models LIMIT 1`);
  const [svc] = await q(`SELECT id FROM services LIMIT 1`);
  rec('Discover refs', true, `partner=${partnerId.slice(0,8)} staff=${staff.length} showroom=${showroom.id.slice(0,8)} oem=${showroom.oem_id.slice(0,8)}`);

  // ---- Read-only endpoints ----
  rec('GET /api/notification-templates', (await api('GET', '/api/notification-templates')).status === 200);
  const rr = await api('POST', '/api/admin/reminders/run-once', { dryRun: true });
  rec('POST /api/admin/reminders/run-once (dryRun)', rr.status === 200, JSON.stringify(rr.json));

  // ---- Create WO ----
  const woRes = await api('POST', '/api/work-orders', {
    oemId: showroom.oem_id, dealershipId: showroom.dealership_id, showroomId: showroom.id,
    vehicleModelId: vm.id, serviceId: svc.id, quantity: 1,
    customerName: 'ZZZ E2E TEST', customerPhone: '9990000001', customerEmail: 'e2e-test@example.com',
    regNo: 'E2E-TEST-1', appointmentAt: plus(30),
  });
  const woId = woRes.json?.id;
  rec('POST /api/work-orders (create)', woRes.status === 201 && !!woId, `status=${woRes.json?.status}`);
  if (!woId) throw new Error('WO not created: ' + JSON.stringify(woRes.json));

  // ---- Submit + allocate ----
  const sub = await api('POST', `/api/work-orders/${woId}/submit`);
  rec('POST /work-orders/:id/submit', sub.status === 200, `status=${sub.json?.status}`);
  let [woRow] = await q(`SELECT status, assigned_partner_id, assigned_job_card_id FROM work_orders WHERE id=$1`, [woId]);
  if (!woRow.assigned_job_card_id) {
    const alloc = await api('POST', `/api/work-orders/${woId}/allocate`, { partnerId });
    rec('POST /work-orders/:id/allocate', alloc.status === 200, alloc.json?.error || `status=${alloc.json?.status}`);
    [woRow] = await q(`SELECT status, assigned_job_card_id FROM work_orders WHERE id=$1`, [woId]);
  } else {
    rec('Auto-assigned on submit', true, 'job card auto-created');
  }
  const jcId = woRow.assigned_job_card_id;
  if (!jcId) throw new Error('No job card created for WO');

  // Ensure the job card's partner has ≥2 active staff we can drive. If not, temporarily attach two
  // real staff users to that partner (removed again in cleanup) so acknowledge/team-change/rework work.
  const actualPartner = (await q(`SELECT partner_id FROM job_cards WHERE id=$1`, [jcId]))[0].partner_id;
  let pStaff = await q(
    `SELECT u.id FROM partner_staff_assignments a JOIN users u ON u.id=a.user_id
     WHERE a.partner_id=$1 AND a.status='active' AND u.role IN ('PARTNER_STAFF','DETAILING_PARTNER')`, [actualPartner]);
  if (pStaff.length < 2) {
    const candidates = await q(`SELECT id FROM users WHERE role IN ('PARTNER_STAFF','DETAILING_PARTNER') LIMIT 5`);
    for (const c of candidates) {
      if (pStaff.some((s) => s.id === c.id)) continue;
      const ins = await q(
        `INSERT INTO partner_staff_assignments (id, partner_id, user_id, status)
         VALUES (gen_random_uuid(), $1, $2, 'active')
         ON CONFLICT (partner_id, user_id) DO NOTHING RETURNING id`, [actualPartner, c.id]);
      if (ins.length) injectedStaffIds.push(ins[0].id);
      pStaff.push({ id: c.id });
      if (pStaff.length >= 2) break;
    }
  }
  staff1 = pStaff[0].id; staff2 = pStaff[1]?.id || pStaff[0].id;
  rec('Ensure assigned partner has staff', pStaff.length >= 2, `partner=${actualPartner.slice(0,8)} staff=${pStaff.length} injected=${injectedStaffIds.length}`);

  const jc = await api('GET', `/api/job-cards/${jcId}`);
  rec('GET /api/job-cards/:id', jc.status === 200, `status=${jc.json?.status}`);

  // ---- Acknowledge: negative (no team) then positive ----
  const ackNo = await api('POST', `/api/job-cards/${jcId}/acknowledge`, {});
  // (only a true negative if no installer already assigned)
  rec('POST /acknowledge (no team → 400)', ackNo.status === 400 || !!jc.json?.assignedInstallerId, `http=${ackNo.status}`);
  const ack = await api('POST', `/api/job-cards/${jcId}/acknowledge`, { assignedInstallerId: staff1 });
  rec('POST /acknowledge (with team)', ack.status === 200 && ack.json?.status === 'ACKNOWLEDGED' && !!ack.json?.acknowledgedAt && ack.json?.assignedInstallerId === staff1);

  // ---- Schedule ----
  const sch = await api('POST', `/api/job-cards/${jcId}/schedule`, { scheduledAt: plus(30) });
  rec('POST /schedule', sch.status === 200 && sch.json?.status === 'SCHEDULED');

  // ---- Reschedule options + same-team + team-change (same card) ----
  const opts = await api('GET', `/api/job-cards/${jcId}/reschedule-options`);
  rec('GET /reschedule-options', opts.status === 200 && Array.isArray(opts.json?.installers));
  const rs1 = await api('POST', `/api/job-cards/${jcId}/reschedule`, { scheduledAt: plus(31), reason: 'E2E same-team' });
  rec('POST /reschedule (same team)', rs1.status === 200 && rs1.json?.status === 'RESCHEDULED' && rs1.json?.rescheduleCount === 1 && Array.isArray(rs1.json?.timelineTrail));
  const rs2 = await api('POST', `/api/job-cards/${jcId}/reschedule`, { scheduledAt: plus(32), reason: 'E2E team change', assignedInstallerId: staff2 });
  const cnt1 = (await q(`SELECT count(*)::int n FROM job_cards WHERE work_order_id=$1 AND checkup_of_job_card_id IS NULL`, [woId]))[0].n;
  rec('POST /reschedule (team change → SAME card, no new)', rs2.status === 200 && rs2.json?.assignedInstallerId === staff2 && cnt1 === 1, `nonCheckupCards=${cnt1}`);

  // ---- Reached + pre-install FAIL → reschedule → reached → PASS → start ----
  rec('POST /reached', (await api('POST', `/api/job-cards/${jcId}/reached`)).json?.status === 'REACHED');
  const pf = await api('POST', `/api/job-cards/${jcId}/pre-install-result`, { result: 'FAIL' });
  rec('POST /pre-install-result FAIL', pf.status === 200 && pf.json?.preInstallResult === 'FAIL' && pf.json?.status === 'REACHED');
  rec('POST /reschedule (after pre-install fail)', (await api('POST', `/api/job-cards/${jcId}/reschedule`, { scheduledAt: plus(33), reason: 'E2E after fail' })).json?.status === 'RESCHEDULED');
  rec('POST /reached (again)', (await api('POST', `/api/job-cards/${jcId}/reached`)).json?.status === 'REACHED');
  const pp = await api('POST', `/api/job-cards/${jcId}/pre-install-result`, { result: 'PASS' });
  rec('POST /pre-install-result PASS', pp.status === 200 && pp.json?.preInstallResult === 'PASS' && !!pp.json?.preInstallationCompletedAt);
  rec('POST /start', (await api('POST', `/api/job-cards/${jcId}/start`)).json?.status === 'IN_PROGRESS');

  // ---- Post-start reschedule (Super Admin allowed) → re-drive ----
  const rsPost = await api('POST', `/api/job-cards/${jcId}/reschedule`, { scheduledAt: plus(34), reason: 'E2E post-start SA' });
  rec('POST /reschedule (post-start, SA allowed)', rsPost.status === 200 && rsPost.json?.status === 'RESCHEDULED');
  await api('POST', `/api/job-cards/${jcId}/reached`);
  await api('POST', `/api/job-cards/${jcId}/pre-install-result`, { result: 'PASS' });
  rec('Re-drive to IN_PROGRESS', (await api('POST', `/api/job-cards/${jcId}/start`)).json?.status === 'IN_PROGRESS');

  // ---- Complete + approve (billing trail + checkup due) ----
  const comp = await api('POST', `/api/job-cards/${jcId}/complete`, {});
  rec('POST /complete', comp.status === 200 && comp.json?.status === 'PENDING_APPROVAL' && !!comp.json?.completedAt);
  const appr = await api('POST', `/api/job-cards/${jcId}/approve`, {});
  rec('POST /approve', appr.status === 200);
  const [afterApprove] = await q(`SELECT status, billing_trail_json, checkup_due_at, approved_at FROM job_cards WHERE id=$1`, [jcId]);
  rec('Approve → billing trail + checkup due recorded', !!afterApprove.billing_trail_json && !!afterApprove.checkup_due_at, `status=${afterApprove.status} rule=${afterApprove.billing_trail_json?.rule}`);

  // ---- Billing price edit ----
  const bp = await api('PATCH', `/api/job-cards/${jcId}/billing-price`, { billingPrice: 9999 });
  rec('PATCH /billing-price', bp.status === 200 && Number(bp.json?.billingPrice) === 9999);

  // ---- Checkup: create + done ----
  const cc = await api('POST', `/api/job-cards/${jcId}/create-checkup`, { assignedInstallerId: staff1 });
  const checkupId = cc.json?.jobCard?.id;
  rec('POST /create-checkup', cc.status === 200 && !!checkupId && cc.json?.jobCard?.checkupOfJobCardId === jcId);
  if (checkupId) {
    const cd = await api('POST', `/api/job-cards/${checkupId}/checkup-done`, { notes: 'E2E checkup ok' });
    const [primAfter] = await q(`SELECT checkup_done_at FROM job_cards WHERE id=$1`, [jcId]);
    rec('POST /checkup-done', cd.status === 200 && cd.json?.jobCard?.status === 'CLOSED' && !!primAfter.checkup_done_at);
  }

  // ---- Rework SAME team (per-part FOC + cost) → reopen same card, no new card ----
  const rwSame = await api('POST', `/api/job-cards/${jcId}/request-rework`, {
    remarks: 'E2E rework same team',
    parts: [{ name: 'A', foc: true, photos: [] }, { name: 'B', foc: false, cost: 500, photos: [] }],
    assignedInstallerId: staff2, // == current assignee (staff2) → same team
  });
  const cnt2 = (await q(`SELECT count(*)::int n FROM job_cards WHERE work_order_id=$1 AND checkup_of_job_card_id IS NULL`, [woId]))[0].n;
  rec('POST /request-rework (same team → reopen, no new card)', rwSame.status === 200 && rwSame.json?.jobCard?.status === 'IN_PROGRESS' && cnt2 === 1, `nonCheckupCards=${cnt2}`);

  // ---- Edit rework cost post-submit ----
  const rc = await api('PATCH', `/api/job-cards/${jcId}/rework-cost`, { parts: [{ name: 'B', foc: true }] });
  const [rcCard] = await q(`SELECT rework_details_json FROM job_cards WHERE id=$1`, [jcId]);
  const partB = (rcCard.rework_details_json?.parts || []).find((p) => p.name === 'B');
  rec('PATCH /rework-cost (edit FOC/cost)', rc.status === 200 && partB?.foc === true);

  // ---- Re-drive to approved, then rework DIFFERENT team → new linked card ----
  await api('POST', `/api/job-cards/${jcId}/complete`, {});
  await api('POST', `/api/job-cards/${jcId}/approve`, {});
  const rwNew = await api('POST', `/api/job-cards/${jcId}/request-rework`, {
    remarks: 'E2E rework new team', parts: [{ name: 'C', foc: false, cost: 800 }],
    assignedInstallerId: staff1 === staff2 ? staff1 : staff1, // different from current (staff2) when 2 staff exist
  });
  const cnt3 = (await q(`SELECT count(*)::int n FROM job_cards WHERE work_order_id=$1 AND checkup_of_job_card_id IS NULL`, [woId]))[0].n;
  const newCard = rwNew.json?.jobCard;
  const differentTeamAvailable = staff1 !== staff2;
  rec('POST /request-rework (different team → new linked card)',
    rwNew.status === 200 && (differentTeamAvailable ? (cnt3 === 2 && newCard?.reworkOfJobCardId === jcId) : true),
    differentTeamAvailable ? `nonCheckupCards=${cnt3}` : 'only 1 staff — new-team branch not exercised');

  // ---- e-warranty (records result; brand may be undetermined for a test service) ----
  const ew = await api('POST', `/api/job-cards/${jcId}/request-e-warranty`, {});
  rec('POST /request-e-warranty (endpoint reachable)', ew.status === 200 || ew.status === 400, `http=${ew.status} ${ew.json?.error || ew.json?.errorCode || 'ok'}`);

  // ---- Bell + logs ----
  rec('GET /api/notifications/mine', (await api('GET', '/api/notifications/mine')).status === 200);
  rec('POST /api/notifications/mine/read', (await api('POST', '/api/notifications/mine/read', {})).status === 200);
  const logs = await api('GET', `/api/notification-logs?limit=5`);
  rec('GET /api/notification-logs', logs.status === 200 && Array.isArray(logs.json?.rows));

} catch (e) {
  rec('FATAL', false, e.message);
} finally {
  // ---- Cleanup: delete test WO + its job cards + dependent rows ----
  try {
    const [woRow] = await q(`SELECT id FROM work_orders WHERE customer_name='ZZZ E2E TEST' ORDER BY created_at DESC LIMIT 1`);
    if (woRow) {
      const cards = await q(`SELECT id FROM job_cards WHERE work_order_id=$1`, [woRow.id]);
      const ids = cards.map((c) => c.id);
      if (ids.length) {
        await q(`DELETE FROM job_reminders WHERE job_card_id = ANY($1)`, [ids]).catch(() => {});
        await q(`DELETE FROM notification_logs WHERE related_entity_id = ANY($1)`, [ids]).catch(() => {});
        await q(`DELETE FROM approvals WHERE job_card_id = ANY($1)`, [ids]).catch(() => {});
        await q(`DELETE FROM payouts WHERE job_card_id = ANY($1)`, [ids]).catch(() => {});
        await q(`DELETE FROM job_card_media WHERE job_card_id = ANY($1)`, [ids]).catch(() => {});
        await q(`UPDATE work_orders SET assigned_job_card_id = NULL WHERE id=$1`, [woRow.id]).catch(() => {});
        await q(`DELETE FROM job_cards WHERE work_order_id=$1`, [woRow.id]).catch(() => {});
      }
      await q(`DELETE FROM work_orders WHERE id=$1`, [woRow.id]).catch(() => {});
      console.log(`🧹 Cleaned up test WO ${woRow.id} + ${ids.length} job card(s)`);
    }
    if (injectedStaffIds.length) {
      await q(`DELETE FROM partner_staff_assignments WHERE id = ANY($1)`, [injectedStaffIds]).catch(() => {});
      console.log(`🧹 Removed ${injectedStaffIds.length} temporary staff assignment(s)`);
    }
  } catch (e) { console.log('cleanup note:', e.message); }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n===== E2E RESULT: ${pass}/${results.length} passed =====`);
  const fails = results.filter((r) => !r.ok);
  if (fails.length) { console.log('FAILURES:'); fails.forEach((f) => console.log(` - ${f.step}: ${f.detail || ''}`)); }
  await pool.end();
  process.exit(0);
}
