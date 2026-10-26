// Admin/OEM/dealership/showroom dashboard analytics.
//
// Definitions (agreed with the business, 2026-10-26):
// - Dates are bucketed in IST. Timestamp columns hold UTC (`timestamp without time zone`), so
//   every IST date range is shifted by 5:30 before comparing.
// - "Job" = a PRIMARY job card: not soft-deleted, not a rework card, not a 15-day checkup card.
// - "Order" = a live work order: not soft-deleted, not CANCELLED.
// - Revenue = billed amount (billing_price, falling back to billing_value) of primary job cards
//   that reached approval, attributed to the IST month/period of approved_at. Installer payouts
//   are a cost and are never counted as revenue.
// - TAT = days from work order creation to job card approval; the median is the headline figure
//   because started→completed timestamps are tapped back to back by staff and mean nothing.
// - Brand comes from services.product_brand (Stek / P91 / 3M) via work_orders.service_id.
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";

export interface DashboardScope {
  oemId?: string;
  dealershipId?: string;
  showroomId?: string;
  brand?: string;
  /** Inclusive IST dates, YYYY-MM-DD. */
  from: string;
  to: string;
}

const IST = sql.raw(`interval '5 hours 30 minutes'`);
const COMPLETED = sql.raw(
  `('APPROVED','PENDING_SALES_INVOICE','INVOICE_RAISED','WARRANTY_REGISTRATION','PAYMENT_PENDING','CLOSED')`
);
const OPEN_WO = sql.raw(
  `('PENDING','SUBMITTED','ASSIGNED','IN_PROGRESS','COMPLETED_PENDING_APPROVAL','REWORK_REQUESTED')`
);
const NOT_STARTED_JC = sql.raw(`('AWAITING_ACK','ACKNOWLEDGED','SCHEDULED','RESCHEDULED')`);
const AMOUNT = sql.raw(`COALESCE(jc.billing_price, jc.billing_value)`);
const PRIMARY_JC = sql.raw(
  `jc.deleted_at IS NULL AND jc.rework_of_job_card_id IS NULL AND jc.checkup_of_job_card_id IS NULL`
);

async function rows<T = any>(query: SQL): Promise<T[]> {
  const result: any = await db.execute(query);
  return (result?.rows ?? result) as T[];
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const round1 = (v: unknown) => Math.round(num(v) * 10) / 10;

// Month-over-month style growth %, or null when there is no prior baseline.
function growthPct(current: number, previous: number): number | null {
  return previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Today's date in IST as YYYY-MM-DD. */
export function istToday(): string {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}

/** Default dashboard period: the current IST month to date. */
export function defaultRange(): { from: string; to: string } {
  const today = istToday();
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

/** The period of equal length immediately before [from, to]. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  const days = Math.round((t - f) / 86_400_000) + 1;
  const d = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { from: d(f - days * 86_400_000), to: d(f - 86_400_000) };
}

// `col` (UTC) falls inside the inclusive IST date range.
function inRange(col: SQL, from: string, to: string): SQL {
  return sql`${col} >= (${from}::date - ${IST}) AND ${col} < (${to}::date + 1 - ${IST})`;
}

// Tenant + brand filter on the work order aliased `wo`.
function woScope(s: Pick<DashboardScope, "oemId" | "dealershipId" | "showroomId" | "brand">): SQL {
  const parts: SQL[] = [sql`wo.deleted_at IS NULL`];
  if (s.oemId) parts.push(sql`wo.oem_id = ${s.oemId}`);
  if (s.dealershipId) parts.push(sql`wo.dealership_id = ${s.dealershipId}`);
  if (s.showroomId) parts.push(sql`wo.showroom_id = ${s.showroomId}`);
  if (s.brand) {
    parts.push(sql`EXISTS (SELECT 1 FROM services sv WHERE sv.id = wo.service_id AND lower(trim(sv.product_brand)) = lower(${s.brand}))`);
  }
  return sql.join(parts, sql` AND `);
}

export async function getDashboardBrands(): Promise<string[]> {
  const r = await rows<{ brand: string }>(sql`
    SELECT DISTINCT trim(product_brand) AS brand FROM services
    WHERE product_brand IS NOT NULL AND trim(product_brand) <> ''
    ORDER BY 1`);
  return r.map(x => x.brand);
}

export async function getDashboardMetrics(s: DashboardScope) {
  const scope = woScope(s);
  const prev = previousRange(s.from, s.to);

  const approvedIn = (from: string, to: string) => sql`
    SELECT COUNT(*) AS jobs,
           COALESCE(SUM(${AMOUNT}), 0) AS revenue,
           COUNT(*) FILTER (WHERE ${AMOUNT} IS NULL OR ${AMOUNT} = 0) AS unpriced,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (jc.approved_at - wo.created_at)) / 86400) AS tat_median,
           AVG(EXTRACT(EPOCH FROM (jc.approved_at - wo.created_at)) / 86400) AS tat_avg
    FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
    WHERE ${scope} AND ${PRIMARY_JC} AND jc.status IN ${COMPLETED}
      AND jc.approved_at IS NOT NULL AND ${inRange(sql`jc.approved_at`, from, to)}`;

  const ordersIn = (from: string, to: string) => sql`
    SELECT COUNT(*) AS n FROM work_orders wo
    WHERE ${scope} AND wo.status <> 'CANCELLED' AND ${inRange(sql`wo.created_at`, from, to)}`;

  const [cur, before, ordersCur, ordersPrev, snapshot, ops] = await Promise.all([
    rows(approvedIn(s.from, s.to)),
    rows(approvedIn(prev.from, prev.to)),
    rows(ordersIn(s.from, s.to)),
    rows(ordersIn(prev.from, prev.to)),
    // Point-in-time pipeline (not bound to the selected period).
    rows(sql`
      SELECT
        (SELECT COUNT(*) FROM work_orders wo WHERE ${scope} AND wo.status IN ${OPEN_WO}) AS active_orders,
        (SELECT COUNT(*) FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
           WHERE ${scope} AND ${PRIMARY_JC} AND jc.status = 'PENDING_APPROVAL') AS pending_approvals,
        (SELECT COUNT(*) FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
           WHERE ${scope} AND ${PRIMARY_JC} AND jc.status = 'IN_PROGRESS') AS in_progress,
        (SELECT COUNT(*) FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
           WHERE ${scope} AND ${PRIMARY_JC} AND jc.status IN ${NOT_STARTED_JC}
             AND jc.scheduled_at < (${istToday()}::date - ${IST})) AS overdue_schedules,
        (SELECT COUNT(*) FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
           WHERE ${scope} AND ${PRIMARY_JC} AND jc.status IN ${NOT_STARTED_JC}
             AND jc.scheduled_at IS NULL) AS unscheduled,
        (SELECT json_build_object('count', COUNT(*), 'amount', COALESCE(SUM(${AMOUNT}), 0),
                  'avgAgeDays', AVG(EXTRACT(EPOCH FROM (now() - jc.approved_at)) / 86400))
           FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
           WHERE ${scope} AND ${PRIMARY_JC}
             AND jc.status IN ('APPROVED','PENDING_SALES_INVOICE','WARRANTY_REGISTRATION')
             AND (jc.sales_invoice_number IS NULL OR trim(jc.sales_invoice_number) = '')) AS invoice_backlog
    `),
    // Operational health inside the selected period.
    rows(sql`
      SELECT
        (SELECT COUNT(*) FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id,
                jsonb_array_elements(CASE WHEN jsonb_typeof(jc.timeline_trail) = 'array' THEN jc.timeline_trail ELSE '[]'::jsonb END) e
           WHERE ${scope} AND jc.deleted_at IS NULL AND e->>'type' = 'RESCHEDULED'
             AND ${inRange(sql`(CASE WHEN e->>'at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (e->>'at')::timestamptz AT TIME ZONE 'UTC' END)`, s.from, s.to)}) AS reschedules,
        (SELECT COUNT(*) FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
           WHERE ${scope} AND jc.deleted_at IS NULL AND jc.rework_requested_at IS NOT NULL
             AND ${inRange(sql`jc.rework_requested_at`, s.from, s.to)}) AS rework_requests,
        (SELECT COUNT(*) FROM work_orders wo
           WHERE ${scope} AND wo.status = 'CANCELLED' AND wo.cancelled_at IS NOT NULL
             AND ${inRange(sql`wo.cancelled_at`, s.from, s.to)}) AS cancellations
    `),
  ]);

  const c = cur[0] ?? {};
  const p = before[0] ?? {};
  const snap = snapshot[0] ?? {};
  const backlog = snap.invoice_backlog ?? {};
  const o = ops[0] ?? {};
  const jobs = num(c.jobs);

  return {
    range: { from: s.from, to: s.to },
    previousRange: prev,
    // Field names kept for the existing UI.
    activeWorkOrders: num(snap.active_orders),
    pendingApprovals: num(snap.pending_approvals),
    thisMonthRevenue: num(c.revenue),
    avgTAT: round1(c.tat_median),
    revenue: num(c.revenue),
    revenueGrowthPct: growthPct(num(c.revenue), num(p.revenue)),
    completedJobs: jobs,
    completedJobsGrowthPct: growthPct(jobs, num(p.jobs)),
    unpricedJobs: num(c.unpriced),
    tatMedianDays: round1(c.tat_median),
    tatAvgDays: round1(c.tat_avg),
    ordersRegistered: num(ordersCur[0]?.n),
    ordersGrowthPct: growthPct(num(ordersCur[0]?.n), num(ordersPrev[0]?.n)),
    inProgressJobs: num(snap.in_progress),
    overdueSchedules: num(snap.overdue_schedules),
    unscheduledJobs: num(snap.unscheduled),
    invoiceBacklog: {
      count: num(backlog.count),
      amount: num(backlog.amount),
      avgAgeDays: round1(backlog.avgAgeDays),
    },
    reschedules: num(o.reschedules),
    reworkRequests: num(o.rework_requests),
    reworkRatePct: jobs ? round1((num(o.rework_requests) / jobs) * 100) : null,
    cancellations: num(o.cancellations),
  };
}

// Last `months` whole IST months up to and including the current one.
function monthSeries(months: number): SQL {
  return sql`
    SELECT generate_series(
      date_trunc('month', now() + ${IST}) - make_interval(months => ${months - 1}),
      date_trunc('month', now() + ${IST}),
      interval '1 month')::date AS m`;
}

export async function getOrdersRevenueTrend(s: Omit<DashboardScope, "from" | "to">, months = 9) {
  const scope = woScope(s);
  const r = await rows(sql`
    WITH months AS (${monthSeries(months)}),
    o AS (
      SELECT date_trunc('month', wo.created_at + ${IST})::date AS m, COUNT(*) AS orders
      FROM work_orders wo WHERE ${scope} AND wo.status <> 'CANCELLED' GROUP BY 1),
    r AS (
      SELECT date_trunc('month', jc.approved_at + ${IST})::date AS m,
             COALESCE(SUM(${AMOUNT}), 0) AS revenue, COUNT(*) AS jobs
      FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
      WHERE ${scope} AND ${PRIMARY_JC} AND jc.status IN ${COMPLETED} AND jc.approved_at IS NOT NULL
      GROUP BY 1)
    SELECT to_char(months.m, 'Mon YY') AS month, COALESCE(o.orders, 0) AS orders,
           COALESCE(r.revenue, 0) AS revenue, COALESCE(r.jobs, 0) AS jobs
    FROM months LEFT JOIN o ON o.m = months.m LEFT JOIN r ON r.m = months.m
    ORDER BY months.m`);
  return r.map(x => ({ month: x.month, orders: num(x.orders), revenue: num(x.revenue), approvedJobs: num(x.jobs) }));
}

export async function getMonthlyTrends(s: Omit<DashboardScope, "from" | "to">, months = 9) {
  const scope = woScope(s);
  const r = await rows(sql`
    WITH months AS (${monthSeries(months)}),
    t AS (
      SELECT date_trunc('month', jc.approved_at + ${IST})::date AS m, COUNT(*) AS done,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (jc.approved_at - wo.created_at)) / 86400) AS tat
      FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
      WHERE ${scope} AND ${PRIMARY_JC} AND jc.status IN ${COMPLETED} AND jc.approved_at IS NOT NULL
      GROUP BY 1)
    SELECT to_char(months.m, 'Mon YY') AS month, COALESCE(t.done, 0) AS done, t.tat
    FROM months LEFT JOIN t ON t.m = months.m ORDER BY months.m`);
  return r.map(x => ({
    month: x.month,
    completedOrders: num(x.done),
    // null (not 0) when nothing was approved that month, so the line breaks instead of dipping.
    avgTAT: x.tat === null || x.tat === undefined ? null : round1(x.tat),
  }));
}

type Ranked = { id: string; name: string; orders: number; completedJobs: number; revenue: number; growth: number | null };

// Shared ranking: orders registered + jobs approved + billed revenue per group, for the
// selected period, with growth on the ranking metric vs the previous equal-length period.
async function ranked(
  s: DashboardScope,
  groupCol: "dealership_id" | "showroom_id" | "partner_id",
  nameSql: SQL,
  rankBy: "orders" | "completed",
  limit = 5,
): Promise<Ranked[]> {
  const scope = woScope(s);
  const prev = previousRange(s.from, s.to);
  const key = sql.raw(groupCol === "partner_id" ? "jc.partner_id" : `wo.${groupCol}`);
  const orderKey = sql.raw(groupCol === "partner_id" ? "wo.assigned_partner_id" : `wo.${groupCol}`);
  const metric = (from: string, to: string) => sql`
    SELECT g.id,
      (SELECT COUNT(*) FROM work_orders wo WHERE ${scope} AND wo.status <> 'CANCELLED'
         AND ${orderKey} = g.id AND ${inRange(sql`wo.created_at`, from, to)}) AS orders,
      (SELECT COUNT(*) FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
         WHERE ${scope} AND ${PRIMARY_JC} AND jc.status IN ${COMPLETED} AND ${key} = g.id
           AND jc.approved_at IS NOT NULL AND ${inRange(sql`jc.approved_at`, from, to)}) AS completed,
      (SELECT COALESCE(SUM(${AMOUNT}), 0) FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
         WHERE ${scope} AND ${PRIMARY_JC} AND jc.status IN ${COMPLETED} AND ${key} = g.id
           AND jc.approved_at IS NOT NULL AND ${inRange(sql`jc.approved_at`, from, to)}) AS revenue
    FROM groups g`;
  const groups = sql`
    groups AS (
      SELECT DISTINCT ${key} AS id FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
      WHERE ${scope} AND ${key} IS NOT NULL
        AND (${inRange(sql`wo.created_at`, s.from, s.to)}
             OR (jc.approved_at IS NOT NULL AND ${inRange(sql`jc.approved_at`, s.from, s.to)}))
      UNION
      SELECT DISTINCT ${orderKey} FROM work_orders wo
      WHERE ${scope} AND ${orderKey} IS NOT NULL AND ${inRange(sql`wo.created_at`, s.from, s.to)})`;
  const rankCol = sql.raw(rankBy === "orders" ? "cur.orders" : "cur.completed");
  const r = await rows(sql`
    WITH ${groups},
    cur AS (${metric(s.from, s.to)}),
    prev AS (${metric(prev.from, prev.to)})
    SELECT cur.id, ${nameSql} AS name, cur.orders, cur.completed, cur.revenue,
           prev.orders AS prev_orders, prev.completed AS prev_completed
    FROM cur JOIN prev ON prev.id = cur.id
    WHERE ${rankCol} > 0
    ORDER BY ${rankCol} DESC, cur.revenue DESC
    LIMIT ${limit}`);
  return r.map(x => ({
    id: x.id,
    name: x.name ?? "Unknown",
    orders: num(x.orders),
    completedJobs: num(x.completed),
    revenue: num(x.revenue),
    growth: rankBy === "orders"
      ? growthPct(num(x.orders), num(x.prev_orders))
      : growthPct(num(x.completed), num(x.prev_completed)),
  }));
}

export const getDealershipPerformance = (s: DashboardScope) =>
  ranked(s, "dealership_id", sql`(SELECT d.name FROM dealerships d WHERE d.id = cur.id)`, "orders");

export const getTopPerformingShowrooms = (s: DashboardScope) =>
  ranked(s, "showroom_id", sql`(SELECT sh.name FROM showrooms sh WHERE sh.id = cur.id)`, "orders");

export const getTopDetailingPartners = (s: DashboardScope) =>
  ranked(s, "partner_id", sql`(SELECT trim(p.display_name) FROM partners p WHERE p.id = cur.id)`, "completed");

// Territory = the showroom's city (where the car is actually done), cleaned of stray spaces
// and case differences. Dealership city is blank for most dealerships and often differs.
export async function getTerritoryPerformance(s: DashboardScope, limit = 8) {
  const scope = woScope(s);
  const city = sql.raw(`COALESCE(NULLIF(initcap(trim(sh.city)), ''), 'Unknown')`);
  const r = await rows(sql`
    WITH o AS (
      SELECT ${city} AS territory, COUNT(*) AS orders
      FROM work_orders wo LEFT JOIN showrooms sh ON sh.id = wo.showroom_id
      WHERE ${scope} AND wo.status <> 'CANCELLED' AND ${inRange(sql`wo.created_at`, s.from, s.to)}
      GROUP BY 1),
    r AS (
      SELECT ${city} AS territory, COALESCE(SUM(${AMOUNT}), 0) AS revenue, COUNT(*) AS jobs
      FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
      LEFT JOIN showrooms sh ON sh.id = wo.showroom_id
      WHERE ${scope} AND ${PRIMARY_JC} AND jc.status IN ${COMPLETED}
        AND jc.approved_at IS NOT NULL AND ${inRange(sql`jc.approved_at`, s.from, s.to)}
      GROUP BY 1)
    SELECT COALESCE(o.territory, r.territory) AS territory, COALESCE(o.orders, 0) AS orders,
           COALESCE(r.revenue, 0) AS revenue, COALESCE(r.jobs, 0) AS jobs
    FROM o FULL OUTER JOIN r ON r.territory = o.territory
    ORDER BY 2 DESC, 3 DESC
    LIMIT ${limit}`);
  return r.map(x => ({ territory: x.territory, orders: num(x.orders), revenue: num(x.revenue), completedJobs: num(x.jobs) }));
}

const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#94a3b8"];

// Orders in the period by service category × brand. Everything past the top 6 is folded into
// "Other" so the pie percentages always add up to the real total.
export async function getServicePopularity(s: DashboardScope) {
  const scope = woScope(s);
  const r = await rows(sql`
    SELECT COALESCE(sc.name, 'Uncategorised')
             || COALESCE(' · ' || NULLIF(trim(sv.product_brand), ''), '') AS name,
           COUNT(*) AS value
    FROM work_orders wo
    JOIN services sv ON sv.id = wo.service_id
    LEFT JOIN service_categories sc ON sc.id = sv.service_category_id
    WHERE ${scope} AND wo.status <> 'CANCELLED' AND ${inRange(sql`wo.created_at`, s.from, s.to)}
    GROUP BY 1 ORDER BY 2 DESC`);
  const all = r.map(x => ({ name: x.name as string, value: num(x.value) }));
  const top = all.slice(0, 6);
  const rest = all.slice(6).reduce((sum, x) => sum + x.value, 0);
  if (rest > 0) top.push({ name: "Other", value: rest });
  return top.map((x, i) => ({ ...x, color: PIE_COLORS[i % PIE_COLORS.length] }));
}

// Activity calendar: orders registered and jobs completed (since approved) per IST day/month.
export async function getActivityTimeline(opts: {
  oemId?: string;
  dealershipId?: string;
  showroomId?: string;
  partnerId?: string;
  brand?: string;
  from: string;
  to: string;
  granularity: "day" | "month";
}) {
  const unit = sql.raw(opts.granularity === "month" ? `'month'` : `'day'`);
  const step = sql.raw(opts.granularity === "month" ? `interval '1 month'` : `interval '1 day'`);
  const scope = woScope(opts);
  const woPartner = opts.partnerId ? sql`AND wo.assigned_partner_id = ${opts.partnerId}` : sql``;
  const jcPartner = opts.partnerId ? sql`AND jc.partner_id = ${opts.partnerId}` : sql``;
  const r = await rows(sql`
    WITH b AS (
      SELECT generate_series(date_trunc(${unit}, ${opts.from}::date), date_trunc(${unit}, ${opts.to}::date), ${step})::date AS p),
    o AS (
      SELECT date_trunc(${unit}, wo.created_at + ${IST})::date AS p, COUNT(*) AS n
      FROM work_orders wo
      WHERE ${scope} ${woPartner} AND wo.status <> 'CANCELLED'
        AND ${inRange(sql`wo.created_at`, opts.from, opts.to)}
      GROUP BY 1),
    c AS (
      SELECT date_trunc(${unit}, jc.completed_at + ${IST})::date AS p, COUNT(*) AS n
      FROM job_cards jc JOIN work_orders wo ON wo.id = jc.work_order_id
      WHERE ${scope} ${jcPartner} AND ${PRIMARY_JC} AND jc.status IN ${COMPLETED}
        AND jc.completed_at IS NOT NULL AND ${inRange(sql`jc.completed_at`, opts.from, opts.to)}
      GROUP BY 1)
    SELECT to_char(b.p, 'YYYY-MM-DD') AS period,
           CASE WHEN ${unit} = 'month' THEN to_char(b.p, 'Mon YYYY') ELSE to_char(b.p, 'FMDD Mon') END AS label,
           COALESCE(o.n, 0) AS orders, COALESCE(c.n, 0) AS completed
    FROM b LEFT JOIN o ON o.p = b.p LEFT JOIN c ON c.p = b.p
    ORDER BY b.p
    LIMIT 1000`);
  return r.map(x => ({ period: x.period, label: x.label, orders: num(x.orders), completed: num(x.completed) }));
}

// ---------------------------------------------------------------------------------------------
// Partner dashboards (PARTNER_ADMIN = whole partner; PARTNER_STAFF / DETAILING_PARTNER = only the
// cards assigned to them). These count every live card the partner has to work on — rework and
// checkup cards included — because each one is real work for the detailer.
// ---------------------------------------------------------------------------------------------

const PARTNER_PENDING = sql.raw(
  `('AWAITING_ACK','ACKNOWLEDGED','SCHEDULED','RESCHEDULED','REACHED','PARTS_PENDING','REWORK_REQUESTED','CHECKUP_SCHEDULED')`
);
// Work the detailer has finished: waiting for approval, or approved and beyond.
const PARTNER_DONE = sql.raw(
  `('PENDING_APPROVAL','APPROVED','PENDING_SALES_INVOICE','INVOICE_RAISED','WARRANTY_REGISTRATION','PAYMENT_PENDING','CLOSED','CHECKUP_DONE')`
);

export async function getPartnerDashboardMetrics(partnerId: string, staffId?: string) {
  const { from, to } = defaultRange();
  const prev = previousMonthRange();
  const staff = staffId ? sql`AND jc.assigned_installer_id = ${staffId}` : sql``;
  const cards = sql`job_cards jc WHERE jc.partner_id = ${partnerId} AND jc.deleted_at IS NULL ${staff}`;
  const doneIn = (f: string, t: string) => sql`
    (SELECT COUNT(*) FROM ${cards} AND jc.status IN ${PARTNER_DONE}
       AND jc.completed_at IS NOT NULL AND ${inRange(sql`jc.completed_at`, f, t)})`;
  const earnedIn = (f: string, t: string) => sql`
    (SELECT COALESCE(SUM(p.net_amount), 0) FROM payouts p JOIN job_cards jc ON jc.id = p.job_card_id
       WHERE jc.partner_id = ${partnerId} AND jc.deleted_at IS NULL ${staff}
         AND ${inRange(sql`p.created_at`, f, t)})`;
  const ninetyDaysAgo = new Date(Date.parse(`${to}T00:00:00Z`) - 89 * 86_400_000).toISOString().slice(0, 10);

  const [r] = await rows(sql`
    SELECT
      (SELECT COUNT(*) FROM ${cards} AND jc.status IN ${PARTNER_PENDING}) AS pending,
      (SELECT COUNT(*) FROM ${cards} AND jc.status = 'IN_PROGRESS') AS in_progress,
      (SELECT COUNT(*) FROM ${cards} AND jc.status = 'PENDING_APPROVAL') AS awaiting_approval,
      (SELECT COUNT(*) FROM ${cards} AND jc.status IN ${PARTNER_PENDING}
         AND jc.scheduled_at < (${istToday()}::date - ${IST})) AS overdue,
      ${doneIn(from, to)} AS done_this_month,
      ${doneIn(prev.from, prev.to)} AS done_last_month,
      ${earnedIn(from, to)} AS earned_this_month,
      ${earnedIn(prev.from, prev.to)} AS earned_last_month,
      -- Turnaround = card assigned to the partner → install completed (primary cards, last 90 days).
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (jc.completed_at - jc.created_at)) / 86400)
         FROM ${cards} AND ${PRIMARY_JC} AND jc.status IN ${PARTNER_DONE}
           AND jc.completed_at IS NOT NULL AND ${inRange(sql`jc.completed_at`, ninetyDaysAgo, to)}) AS tat_median
  `);

  const pending = num(r?.pending);
  const inProgress = num(r?.in_progress);
  const done = num(r?.done_this_month);
  const earned = staffId ? 0 : num(r?.earned_this_month); // staff never see earnings
  return {
    activeWorkOrders: pending + inProgress,
    pendingApprovals: num(r?.awaiting_approval),
    thisMonthRevenue: earned,
    avgTAT: round1(r?.tat_median),
    completedJobs: done,
    inProgressJobs: inProgress,
    pendingJobs: pending,
    overdueJobs: num(r?.overdue),
    thisMonthEarnings: earned,
    completedJobsGrowthPct: growthPct(done, num(r?.done_last_month)),
    earningsGrowthPct: staffId ? null : growthPct(earned, num(r?.earned_last_month)),
  };
}

/** The previous IST calendar month. */
function previousMonthRange(): { from: string; to: string } {
  const today = istToday();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  const d = (dt: Date) => dt.toISOString().slice(0, 10);
  return { from: d(new Date(Date.UTC(y, m - 1, 1))), to: d(new Date(Date.UTC(y, m, 0))) };
}
