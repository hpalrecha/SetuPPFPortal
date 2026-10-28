// Remove TEST partners / users (the "Tushar" test distributor + its detailers/installers, the
// "Test Distributor" partner, two "tusharinstaller" partners, two stray Tushar detailer logins)
// and the purely-test work orders / job cards that hang off them.
//
//   Dry run (default, no writes):  node scripts/remove-test-data.mjs
//   Write:                         node scripts/remove-test-data.mjs --apply
//
// SAFETY
//   * Hard-coded ID allowlist below — no name/pattern matching at run time. Child rows are found
//     ONLY by foreign key / soft-link to an allowlisted ID.
//   * Guards refuse --apply when anything real is tangled in (a real partner/showroom on an
//     allowlisted card/order, a non-allowlisted card/order pointing at an allowlisted one, real
//     work under a test partner, the owner login in the allowlist, ...).
//   * Expected per-table counts are pinned in EXPECTED; --apply refuses if the live plan differs
//     (re-run the dry run, review, and update EXPECTED if the change is intended).
//   * --apply writes a JSON backup of every row it deletes and the old value of every column it
//     NULLs to scripts/backups/test-data-<timestamp>.json, then runs everything in ONE
//     transaction (ROLLBACK on any error) and re-checks that nothing is left.
//   * Media files in S3 referenced by job_card_media are NOT deleted (DB rows only).
//
// Restore: rows in the backup are plain `SELECT *` output per table; re-insert parents first
// (partners → users → work_orders → job_cards → children), then re-apply `nulled` entries.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const APPLY = process.argv.includes('--apply');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set.');
  process.exit(1);
}

// ───────────────────────────── ALLOWLIST ─────────────────────────────
const PARTNERS = [
  '2cd170cd-f5a0-4210-89c0-b4034969ba8b', // "Tushar Partern" (STUDIO, contact Tushar Agarwal, inactive) — the test distributor
  'ce6cc9eb-f5a1-43f2-a236-872fbacfb05d', // "Test Distributor" (STUDIO, no contact/email, inactive)
  'ef29b471-6863-4040-8537-b6ac2db321e2', // "TUSHARINSTALLER1000" (INSTALLER, inactive)
  '191dcfe6-de01-4d81-9fd8-a9444de96e87', // "tusharinstaller2" (INSTALLER, contact "dgfdggf", inactive)
  // OPTIONAL — other obvious junk partners; uncomment only after the user confirms, then re-run
  // the dry run and update EXPECTED:
  // '21d67030-f64f-48f9-89e6-6d42f39f5b13', // "test" (INSTALLER, kjasd@gmail.com)
  // '1bbefdac-c483-41e0-a4cb-a67b73f7541f', // "dummy test" (STUDIO, admin@test.com)
  // '3232a3d4-f2c0-4dc2-b00d-78b982ecff31', // "dgrdgdgdg" (INSTALLER)
  // 'e6894eaf-ca60-4e0d-b989-a1a28b8ccac5', // "My New Distributor" (no data)
  // 'e94e3f9b-82c9-41c8-be08-2303fa5417f1', // "Admin User" partner (no data)
];

const USERS = [
  'a8d5d789-fa21-4f6c-ac5f-b29ae1cf6a7b', // tushar_partner — "Tushar Partner", PARTNER_ADMIN of Tushar Partern
  '44dba4b0-63c8-49b2-9a4e-15647483fb0e', // tushar_detailing_partner — "Tushar Detailing Partner", DETAILING_PARTNER
  '355f3d63-d6db-4d7a-9fe2-235f4d5f8197', // tusharinstaller — "Tushar Installer", PARTNER_STAFF
  '959c1b03-f3e9-49ac-a492-292e44c4d851', // tusharinstaller2 — "Tushar Installer 2", PARTNER_STAFF
  'ce1b5df5-4110-413f-b4a8-7d4161f62535', // tushar734543436 — "TUSHARDETAILINGPARTNER", DETAILING_PARTNER (no partner)
  '9123cd16-11a3-4e92-a678-f177e4a48848', // tushar7436 — "dharmaTushar detailerpartner", DETAILING_PARTNER (inactive; only an
                                          //   INACTIVE staff assignment on REAL partner Dharmaraj Pioneer — partner itself untouched)
  // OPTIONAL — uncomment after confirmation:
  // 'f5a002fc-4e22-46c7-a1c2-2fdf169b5d7e', // xyz — "Tushar", SALES_PERSON at Tushar Shoroom-2 (xyz@xyz.com, no data)
];

// Test work orders — all on the Tushar test showrooms, test customer names, assigned to / created by the test partner.
const WORK_ORDERS = [
  'ab3e61bd-15e4-428e-a2a6-5508ce65abea', // ASSIGNED     "Tushar Customer"  Tushar Shoroom-1
  '345be040-3700-4bbf-b3b5-121de0429aca', // ASSIGNED     (blank)            Tushar Shoroom-1 (created by vishal)
  'bf3ad2df-031f-4526-9ccd-bbd1f1534805', // APPROVED     "Tushar customer"  Tushar Shoroom-1
  '86db6f30-7a42-4e4e-86df-aea8bfbbcf11', // ASSIGNED     "tushar"           Tushar Shoroom-1 (created by vishal)
  '246e48b7-8131-4c84-a77e-adb2ce68144e', // IN_PROGRESS  (blank) reg 99000  Tushar Shoroom-1 → job card 742f56f0
  'd5f94c6a-c7c1-4201-a60c-9719eea14c46', // ASSIGNED     (blank)            Tushar Shoroom-2 (created by vishal)
  '81743c13-8fc3-49b2-aeca-d371869e14e4', // APPROVED     (blank)            Tushar Shoroom-1 (created by vishal)
  '711254fc-3d50-46f2-98a0-b6a283e1f27f', // CLOSED       "hni" reg 9000     Tushar Shoroom-1 → job cards 0c95c64a, 358fdd7d
  '9f12abb6-28ad-431a-8c41-189f5a52fcaf', // CANCELLED    (blank, unassigned) Tushar Shoroom-1
  '9487eebb-2ed3-4034-8bdb-cbce6208ef27', // IN_PROGRESS  "tushar test2"     Tushar Shoroom-1
  '3e8fc707-b419-4f21-826b-b5230c7aba4b', // ASSIGNED     "Tushar Customer"  Tushar Shoroom-1
  'be51fad1-77c5-489a-a31c-063c9be7bd29', // IN_PROGRESS  (blank) reg 113    Tushar Shoroom-2
  '62d16f91-78a8-481c-abbf-21f590798828', // APPROVED     "Tushar test"      Tushar Shoroom-1
  '3e21bcdd-a7ff-40b9-a9af-1dfc8f81442c', // DRAFT        "Test Tushar" (unassigned) Tushar Shoroom-1 (created by vishal)
];

const JOB_CARDS = [
  '742f56f0-a8ce-44e4-a116-c870031f53dc', // PENDING_APPROVAL  Tushar Partern / Tushar Installer 2   (WO 246e48b7)
  '0c95c64a-6e76-4209-83e2-073051813e2b', // CLOSED            Tushar Partern / Tushar Detailing Partner, invoice "na" (WO 711254fc)
  '358fdd7d-161e-4629-8c27-1ca8e3be522f', // SCHEDULED checkup of 0c95c64a (WO 711254fc)
];

// Work orders / job cards may only sit on these (test) showrooms…
const TEST_SHOWROOMS = [
  '5a1baba8-5ef2-4171-9695-26046c167413', // "Tushar Shoroom-1 "
  'ba83e9c3-d689-45b1-b993-651e08bd46a6', // "Tushar Shoroom-2"
  'f55642f9-d041-4a95-99f5-3237371cca2d', // "Tushar Shoroom-3"
];
// …and these must never be touched.
const PROTECTED_USERS = [
  'bb2cbe49-b652-49a3-a3c1-c93a65955317', // tushar@p91.local — SUPER_ADMIN "Tushar" (developer's real login)
  'd6de94f9-c0da-4a3f-95a6-9d2c5005be85', // vishal@stek-india.in — SUPER_ADMIN
];
const PROTECTED_EMAILS = ['tusharagarwal0886@gmail.com', 'tushar@p91.local'];
const PROTECTED_PARTNERS = [
  'c7a89b8f-569d-4066-8bf3-95d62c9babbc', // Dharmaraj Pioneer
  'cc4a50af-6a0a-478e-9b68-27457e06e022', // Bheem Khushwaha
  '50dc3e88-2518-4720-9763-2cb0f89bccb9', // The Detailing Boys (Bheem)
  'e1bc6912-bb2c-464a-84c2-1cba1b8f7041', // Lee PPF (Bhim Kushwaha)
  '211da031-9564-4b45-bff5-80a6367dec3a', // Handover Salesperson
];

// Pinned from the 2026-10-26 dry run. --apply refuses if the live plan differs.
const EXPECTED = {
  'notification_logs:delete': 178,
  'audit_logs:delete': 53,
  'audit_logs.actor_user_id:null': 17,
  'job_card_payout_lines:delete': 1,
  'payouts:delete': 2,
  'job_reminders:delete': 2,
  'job_card_media:delete': 4,
  'approvals:delete': 0,
  'commissions:delete': 0,
  'oem_royalty_calculations:delete': 0,
  'job_cards:delete': 3,
  'work_orders:delete': 14,
  'pricing_rules:delete': 2,
  'detailing_partner_showrooms:delete': 4,
  'partner_staff_assignments:delete': 4,
  'partner_staff_assignments.assigned_by_user_id:null': 0,
  'partner_members:delete': 0,
  'otp_verifications:delete': 0,
  'allocation_brands:delete': 4,
  'allocations:delete': 2,
  'partner_brands:delete': 2,
  'partner_service_categories:delete': 6,
  'partner_oems:delete': 0,
  'partner_showroom_mapping:delete': 3,
  'commissions.settled_by:null': 0,
  'payouts.settled_by:null': 0,
  'oem_royalty_rules.created_by:null': 0,
  'oem_royalty_rules.updated_by:null': 0,
  'work_orders.cancelled_by:null': 0,
  'work_orders.deleted_by:null': 0,
  'job_cards.reached_by:null': 0,
  'job_cards.approved_by_user_id:null': 0,
  'job_cards.rework_requested_by:null': 0,
  'job_cards.pre_installation_completed_by:null': 0,
  'job_cards.rework_completed_by:null': 0,
  'job_cards.deleted_by:null': 0,
  'users:delete': 6,
  'partners:delete': 4,
};

// ─────────────────────────────── PLAN ───────────────────────────────
// Params: $1 partners, $2 users, $3 work orders, $4 job cards, $5 every allowlisted/child id as text.
// Order matters: children before parents; NULL-outs before the referenced users are deleted.
const P = '$1::uuid[]', U = '$2::uuid[]', WO = '$3::uuid[]', JC = '$4::uuid[]', ALLTXT = '$5::text[]';
// NULL-out steps only touch rows that are NOT already being deleted by an earlier step.
const SURVIVES = {
  commissions: `NOT (job_card_id = ANY(${JC}) OR work_order_id = ANY(${WO}))`,
  payouts: `NOT (job_card_id = ANY(${JC}) OR partner_id = ANY(${P}))`,
  oem_royalty_rules: 'true',
  work_orders: `id <> ALL(${WO})`,
  job_cards: `id <> ALL(${JC})`,
};
const STEPS = [
  { t: 'notification_logs', where: `recipient_user_id = ANY(${U}) OR related_entity_id = ANY(${ALLTXT})`, show: 'id, channel, event_type, recipient_name, related_entity_type, created_at' },
  { t: 'audit_logs', where: `entity_id::text = ANY(${ALLTXT})`, show: 'id, entity, action, entity_id, created_at' },
  // Audit rows written BY a test user about other (non-allowlisted / already-gone) records: keep the row, drop the actor.
  { t: 'audit_logs', col: 'actor_user_id', where: `actor_user_id = ANY(${U}) AND entity_id::text <> ALL(${ALLTXT})`, show: 'id, entity, action, entity_id, created_at' },
  { t: 'job_card_payout_lines', where: `job_card_id = ANY(${JC}) OR staff_user_id = ANY(${U})`, show: 'id, job_card_id, staff_user_id, line_type, amount' },
  { t: 'payouts', where: `job_card_id = ANY(${JC}) OR partner_id = ANY(${P})`, show: 'id, job_card_id, partner_id, net_amount, status' },
  { t: 'job_reminders', where: `job_card_id = ANY(${JC})`, show: 'id, job_card_id, reminder_key' },
  { t: 'job_card_media', where: `job_card_id = ANY(${JC})`, show: 'id, job_card_id' },
  { t: 'approvals', where: `job_card_id = ANY(${JC}) OR approver_user_id = ANY(${U})`, show: 'id, job_card_id' },
  { t: 'commissions', where: `job_card_id = ANY(${JC}) OR work_order_id = ANY(${WO})`, show: 'id, job_card_id, work_order_id' },
  { t: 'oem_royalty_calculations', where: `job_card_id = ANY(${JC}) OR work_order_id = ANY(${WO})`, show: 'id, job_card_id, work_order_id' },
  { t: 'job_cards', where: `id = ANY(${JC})`, show: 'id, status, partner_id, work_order_id, assigned_installer_id' },
  { t: 'work_orders', where: `id = ANY(${WO})`, show: 'id, status, customer_name, showroom_id, assigned_partner_id' },
  { t: 'pricing_rules', where: `staff_user_id = ANY(${U}) OR partner_id = ANY(${P}) OR detailer_id = ANY(${P}) OR billing_entity_id = ANY(${P})`, show: 'id, staff_user_id, partner_id, showroom_id, service_id, price_amount' },
  { t: 'detailing_partner_showrooms', where: `detailing_partner_id = ANY(${U})`, show: 'id, detailing_partner_id, showroom_id, status' },
  { t: 'partner_staff_assignments', where: `user_id = ANY(${U}) OR partner_id = ANY(${P})`, show: 'id, partner_id, user_id, status' },
  { t: 'partner_staff_assignments', col: 'assigned_by_user_id', where: `assigned_by_user_id = ANY(${U}) AND NOT (user_id = ANY(${U}) OR partner_id = ANY(${P}))`, show: 'id, partner_id, user_id' },
  { t: 'partner_members', where: `user_id = ANY(${U}) OR partner_id = ANY(${P})`, show: 'id, partner_id, user_id' },
  { t: 'otp_verifications', where: `user_id = ANY(${U})`, show: 'id, user_id, type' },
  { t: 'allocation_brands', where: `allocation_id IN (SELECT id FROM allocations WHERE partner_id = ANY(${P}))`, show: 'id, allocation_id, brand_id' },
  { t: 'allocations', where: `partner_id = ANY(${P})`, show: 'id, level, level_id, partner_id, active' },
  { t: 'partner_brands', where: `partner_id = ANY(${P})`, show: 'id, partner_id, brand_id' },
  { t: 'partner_service_categories', where: `partner_id = ANY(${P})`, show: 'id, partner_id, service_category_id' },
  { t: 'partner_oems', where: `partner_id = ANY(${P})`, show: 'id, partner_id, oem_id' },
  { t: 'partner_showroom_mapping', where: `partner_id = ANY(${P})`, show: 'id, partner_id, showroom_id, status' },
  // Nullable user refs on rows that survive (expected 0 today; kept so the user delete can never FK-fail).
  ...[
    ['commissions', 'settled_by'], ['payouts', 'settled_by'], ['oem_royalty_rules', 'created_by'], ['oem_royalty_rules', 'updated_by'],
    ['work_orders', 'cancelled_by'], ['work_orders', 'deleted_by'],
    ['job_cards', 'reached_by'], ['job_cards', 'approved_by_user_id'], ['job_cards', 'rework_requested_by'],
    ['job_cards', 'pre_installation_completed_by'], ['job_cards', 'rework_completed_by'], ['job_cards', 'deleted_by'],
  ].map(([t, col]) => ({ t, col, where: `${col} = ANY(${U}) AND ${SURVIVES[t]}`, show: 'id' })),
  { t: 'users', where: `id = ANY(${U})`, show: 'id, username, email, role, name' },
  { t: 'partners', where: `id = ANY(${P})`, show: 'id, type, display_name, contact_person_name, email' },
];
// Every query declares all its params up front (unused $n would otherwise fail type inference).
const PARAM_TYPES = ['uuid[]', 'uuid[]', 'uuid[]', 'uuid[]', 'text[]', 'uuid[]', 'text[]', 'uuid[]', 'uuid[]'];
const withParams = (n, sql) =>
  `WITH _params AS (SELECT ${PARAM_TYPES.slice(0, n).map((t, i) => `$${i + 1}::${t} AS p${i + 1}`).join(', ')}) ${sql}`;
const keyOf = (s) => (s.col ? `${s.t}.${s.col}:null` : `${s.t}:delete`);

// ────────────────────────────── GUARDS ──────────────────────────────
// Each query must return 0 rows; any row = refuse --apply.
const GUARDS = [
  ['allowlisted user is a protected/owner login',
    `SELECT id, email FROM users WHERE id = ANY(${U}) AND (id = ANY($6::uuid[]) OR lower(email) = ANY($7::text[]))`],
  ['allowlisted partner is a protected real partner', `SELECT id, display_name FROM partners WHERE id = ANY(${P}) AND id = ANY($8::uuid[])`],
  ['allowlisted work order on a non-test showroom', `SELECT id, showroom_id FROM work_orders WHERE id = ANY(${WO}) AND (showroom_id IS NULL OR showroom_id <> ALL($9::uuid[]))`],
  ['allowlisted work order assigned to a non-allowlisted partner',
    `SELECT id, assigned_partner_id FROM work_orders WHERE id = ANY(${WO}) AND assigned_partner_id IS NOT NULL AND assigned_partner_id <> ALL(${P})`],
  ['allowlisted job card under a non-allowlisted partner', `SELECT id, partner_id FROM job_cards WHERE id = ANY(${JC}) AND (partner_id IS NULL OR partner_id <> ALL(${P}))`],
  ['allowlisted job card on a non-allowlisted work order', `SELECT id, work_order_id FROM job_cards WHERE id = ANY(${JC}) AND (work_order_id IS NULL OR work_order_id <> ALL(${WO}))`],
  ['non-allowlisted job card on an allowlisted work order', `SELECT id FROM job_cards WHERE id <> ALL(${JC}) AND work_order_id = ANY(${WO})`],
  ['non-allowlisted job card soft-linked to an allowlisted job card',
    `SELECT id FROM job_cards WHERE id <> ALL(${JC}) AND (rework_of_job_card_id = ANY(${JC}) OR rework_job_card_id = ANY(${JC}) OR checkup_of_job_card_id = ANY(${JC}) OR superseded_by_job_card_id = ANY(${JC}))`],
  ['allowlisted job card soft-linked to a non-allowlisted job card',
    `SELECT id FROM job_cards WHERE id = ANY(${JC}) AND (rework_of_job_card_id <> ALL(${JC}) OR rework_job_card_id <> ALL(${JC}) OR checkup_of_job_card_id <> ALL(${JC}) OR superseded_by_job_card_id <> ALL(${JC}))`],
  ['non-allowlisted work order points at an allowlisted job card', `SELECT id FROM work_orders WHERE id <> ALL(${WO}) AND assigned_job_card_id = ANY(${JC})`],
  ['REAL work order assigned to a test partner (would be orphaned)', `SELECT id, showroom_id FROM work_orders WHERE id <> ALL(${WO}) AND assigned_partner_id = ANY(${P})`],
  ['REAL job card under a test partner', `SELECT id FROM job_cards WHERE id <> ALL(${JC}) AND partner_id = ANY(${P})`],
  ['REAL job card installed by a test user', `SELECT id FROM job_cards WHERE id <> ALL(${JC}) AND assigned_installer_id = ANY(${U})`],
  ['REAL work order created by a test user (created_by is NOT NULL)', `SELECT id FROM work_orders WHERE id <> ALL(${WO}) AND created_by_user_id = ANY(${U})`],
  ['REAL payout line for a test user on a real job card', `SELECT id FROM job_card_payout_lines WHERE staff_user_id = ANY(${U}) AND job_card_id <> ALL(${JC})`],
  ['knowledge_hub authored by a test user (created_by NOT NULL)', `SELECT id FROM knowledge_hub WHERE created_by = ANY(${U})`],
  ['other users still pointing at a test partner', `SELECT id, name FROM users WHERE id <> ALL(${U}) AND partner_id = ANY(${P})`],
];

// ─────────────────────────────── RUN ───────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

async function childIds() {
  // Every id the run will touch, so audit/notification rows about those rows are caught too.
  const params = [PARTNERS, USERS, WORK_ORDERS, JOB_CARDS, []];
  const ids = new Set([...PARTNERS, ...USERS, ...WORK_ORDERS, ...JOB_CARDS]);
  for (const s of STEPS) {
    if (s.col || ['notification_logs', 'audit_logs'].includes(s.t)) continue;
    const { rows } = await client.query(withParams(5, `SELECT id::text FROM ${s.t} WHERE ${s.where}`), params);
    rows.forEach((r) => ids.add(r.id));
  }
  return [...ids];
}

async function buildPlan() {
  const all = await childIds();
  const params = [PARTNERS, USERS, WORK_ORDERS, JOB_CARDS, all];
  const plan = [];
  for (const s of STEPS) {
    const sel = s.col ? `id, ${s.col}` : '*';
    const { rows } = await client.query(withParams(5, `SELECT ${sel} FROM ${s.t} WHERE ${s.where}`), params);
    const sample = rows.length ? (await client.query(withParams(5, `SELECT ${s.show} FROM ${s.t} WHERE ${s.where} LIMIT 5`), params)).rows : [];
    plan.push({ ...s, key: keyOf(s), rows, sample });
  }
  return { plan, params };
}

async function runGuards(params) {
  const gp = [...params, PROTECTED_USERS, PROTECTED_EMAILS, PROTECTED_PARTNERS, TEST_SHOWROOMS];
  const failures = [];
  for (const [label, sql] of GUARDS) {
    const { rows } = await client.query(withParams(9, sql), gp);
    if (rows.length) failures.push({ label, rows });
  }
  return failures;
}

function printPlan(plan) {
  console.log('\nTable / action                                         rows');
  console.log('─────────────────────────────────────────────────────  ────');
  for (const p of plan) {
    const exp = EXPECTED[p.key];
    const flag = exp === undefined ? '  (no EXPECTED)' : exp !== p.rows.length ? `  ≠ expected ${exp}` : '';
    console.log(`${p.key.padEnd(55)}${String(p.rows.length).padStart(4)}${flag}`);
  }
  console.log('\nSamples (≤5 rows each):');
  for (const p of plan) {
    if (!p.sample.length) continue;
    console.log(`\n  ${p.key}`);
    for (const r of p.sample) console.log(`    ${JSON.stringify(r)}`);
  }
}

function mismatches(plan) {
  const live = Object.fromEntries(plan.map((p) => [p.key, p.rows.length]));
  const keys = new Set([...Object.keys(live), ...Object.keys(EXPECTED)]);
  return [...keys].filter((k) => live[k] !== EXPECTED[k]).map((k) => `${k}: expected ${EXPECTED[k]}, live ${live[k]}`);
}

try {
  if (APPLY) await client.query('BEGIN');

  const { plan, params } = await buildPlan();
  printPlan(plan);

  const failures = await runGuards(params);
  console.log(`\nGuards: ${GUARDS.length - failures.length}/${GUARDS.length} passed`);
  for (const f of failures) console.log(`  ❌ ${f.label}: ${JSON.stringify(f.rows.slice(0, 5))}`);
  const diff = mismatches(plan);
  if (diff.length) {
    console.log('\nCounts differ from EXPECTED:');
    diff.forEach((d) => console.log(`  ⚠️  ${d}`));
    console.log('\nCurrent counts (paste into EXPECTED only after reviewing):');
    console.log(JSON.stringify(Object.fromEntries(plan.map((p) => [p.key, p.rows.length])), null, 2));
  } else {
    console.log('Counts match EXPECTED.');
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to delete.');
  } else {
    if (failures.length || diff.length) throw new Error('Refusing to apply: guard failure or count mismatch (see above).');

    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `test-data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    const backup = {
      createdAt: new Date().toISOString(),
      allowlist: { PARTNERS, USERS, WORK_ORDERS, JOB_CARDS },
      deleted: Object.fromEntries(plan.filter((p) => !p.col).map((p) => [p.t, []])),
      nulled: [],
    };
    for (const p of plan) {
      if (p.col) backup.nulled.push(...p.rows.map((r) => ({ table: p.t, column: p.col, id: r.id, oldValue: r[p.col] })));
      else backup.deleted[p.t].push(...p.rows);
    }
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`\n💾 Backup written: ${file}`);

    for (const p of plan) {
      if (!p.rows.length) continue;
      const ids = p.rows.map((r) => r.id);
      const sql = p.col
        ? `UPDATE ${p.t} SET ${p.col} = NULL WHERE id = ANY($1::uuid[]) AND ${p.col} = ANY($2::uuid[])`
        : `DELETE FROM ${p.t} WHERE id = ANY($1::uuid[])`;
      const res = await client.query(sql, p.col ? [ids, USERS] : [ids]);
      if (res.rowCount !== p.rows.length) throw new Error(`${p.key}: affected ${res.rowCount}, planned ${p.rows.length}`);
      console.log(`  ✓ ${p.key} ${res.rowCount}`);
    }

    // Re-check: nothing allowlisted (or referencing it) may remain.
    const after = await buildPlan();
    const left = after.plan.filter((p) => p.rows.length);
    if (left.length) throw new Error(`Rows remain after delete: ${left.map((p) => `${p.key}=${p.rows.length}`).join(', ')}`);
    await client.query('COMMIT');
    console.log('\n✅ Applied and committed. Re-check: 0 rows remain for every step.');
  }
} catch (err) {
  try { if (APPLY) await client.query('ROLLBACK'); } catch {}
  console.error('\n❌ Aborted (rolled back):', err.message || err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
