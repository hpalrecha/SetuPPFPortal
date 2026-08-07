# Work Order / Job Card Timeline — Design

**Date:** 2026-08-07
**Status:** Approved by user, pending implementation plan

## Problem

There is currently no single place to see "everything that happened" on a
work order and its job card(s) in one chronological view. The relevant
history is scattered across three places: job card lifecycle timestamp
columns, the generic `audit_logs` table (partial coverage), and
`notification_logs` (every email/WhatsApp/SMS/push sent). When a job card
goes through rework, a brand-new job card row is created
(`reworkOfJobCardId` chains it back to the prior one), so the history is
also split across multiple job card rows for the same work order. This
spec adds a read-only "Timeline" view that merges all of this into one
trail per work order.

## Scope

**In scope:**
- A new "Timeline" tab in the sidebar's System section, visible to
  `SUPER_ADMIN`/`ADMIN` only.
- A work order list (searchable/filterable) with an Eye-icon button per row.
- Clicking the Eye button opens a modal showing the full merged, chronological
  timeline for that work order across its entire job card rework chain.
- Timeline events drawn from three sources: job card lifecycle timestamps,
  `audit_logs`, and `notification_logs`.
- Notification-type timeline rows show, always visible (no click-to-expand):
  which job card the notification relates to, which user it was sent to,
  and its channel/type (Email/WhatsApp/SMS/Push).

**Out of scope (explicitly not building):**
- Any new database table — the timeline is computed on-demand from existing
  tables, not persisted.
- Editing anything from this view — it is read-only.
- A dedicated detail page/route per work order — the timeline is a modal
  launched from the list, not a separate page/URL.
- Click-to-expand detail dialogs for non-notification rows — keeping it to
  one compact line per event (per the "keep it simple" direction).
- Access for any role other than `SUPER_ADMIN`/`ADMIN`.

## Current state (reference)

- **Sidebar**: `client/src/components/layout/Sidebar.tsx` — `systemNavigation`
  array (lines 70-74) holds `Notifications`/`Audit Logs`/`Settings`, each
  `{ name, href, icon, roles }`. `systemHrefs` (line 101) is a parallel list
  used for the "System" section divider logic.
- **Routing**: `client/src/App.tsx` — pages imported at top, registered as
  `<Route path="..." component={() => <ProtectedRoute component={Page} />} />`
  inside `Router()`. `wouter` is the router.
- **Work order list**: `GET /api/work-orders` (`server/routes.ts:3189`) already
  supports `status`, `partnerId`, `limit`, `offset` — no free-text search yet.
  `GET /api/work-orders/:id` (`server/routes.ts:3400`) fetches one.
- **Work order schema**: `shared/schema.ts:519-558`. Status enum
  `workOrderStatusEnum` (`shared/schema.ts:36-47`). No status-history table
  exists — only `createdAt`/`updatedAt`/`cancelledAt` on the row itself.
- **Job card schema**: `shared/schema.ts:560-614`. Status enum
  `jobCardStatusEnum` (`shared/schema.ts:49-69`). Lifecycle timestamp columns:
  `acknowledgedAt` (566), `scheduledAt` (567), `preInstallationCompletedAt`
  (574), `startedAt` (576), `completedAt` (577), `approvalRequestedAt` (584),
  `approvedAt` (585), `paymentSettledAt` (588), `warrantyAppliedAt` (590),
  `eWarrantyAppliedAt` (594), `reworkRequestedAt` (605), `reworkCompletedAt`
  (607), plus `createdAt`/`updatedAt` (612-613). Rework chain link:
  `reworkOfJobCardId` (611, soft pointer to the prior job card, no FK
  constraint declared).
- **Work order ↔ job cards**: one-to-many (`shared/schema.ts:832,836`). A
  rework chain is a linear sequence of job card rows linked via
  `reworkOfJobCardId`, all sharing the same `workOrderId`. No existing
  endpoint returns "all job cards for one work order" directly, but
  `storage.ts` already supports filtering `getJobCards({ workOrderId })`
  internally (e.g. `server/storage.ts:1810,1826,1855,1882,1950`).
- **Audit logs**: `shared/schema.ts:700-708` (`auditLogs`:
  `actorUserId, entity, entityId, action, diffJson, createdAt`). Written via
  the `auditLog(entity, action)` route middleware and direct
  `storage.createAuditLog()` calls. Coverage is partial/inconsistent —
  useful as a supplementary source, not the sole one.
- **Notification logs**: `shared/schema.ts:714-735` (`notificationLogs`):
  `channel` (EMAIL/WHATSAPP/SMS/PUSH), `status`, `recipient`,
  `recipientUserId`, `recipientName`, `eventType`, `subject`, `bodyPreview`,
  `relatedEntityType`, `relatedEntityId` (generic join key, text not FK'd),
  `createdAt`. Populated centrally so every send attempt is captured.
- **Existing UI templates**: `client/src/pages/notifications.tsx` (real data,
  search/filter/pagination table + detail dialog with entity deep links —
  closest structural match for the list view) and the "Eye button opens a
  view-only modal" pattern already used for photos (e.g.
  `client/src/pages/JobCardsNew.tsx:3124-3133`, the "View Photos" button
  opening `ViewPreInstallationModal`).

## Design

### Sidebar & routing

- Add to `systemNavigation` in `Sidebar.tsx`:
  `{ name: "Timeline", href: "/timeline", icon: <icon>, roles: ["SUPER_ADMIN", "ADMIN"] }`,
  and add `"/timeline"` to `systemHrefs`.
- New page `client/src/pages/timeline.tsx`, registered in `App.tsx` at
  `/timeline` wrapped in `ProtectedRoute`, identical pattern to the
  Notifications/Audit routes.

### List view

- Table of work orders: reuse `GET /api/work-orders`, extended with an
  optional `search` query param (matches registration number, customer
  name, customer phone, or work order id) since it has no free-text search
  today. Existing `status` filter and pagination stay as-is.
- Each row gets an Eye-icon button (mirrors the existing "View Photos"
  button pattern) that opens the Timeline Modal for that work order.

### Timeline Modal

- Triggered by the Eye button; fetches
  `GET /api/work-orders/:id/timeline` on open.
- Renders one continuous chronological list (oldest → newest) merging every
  job card in that work order's rework chain.
- Each row: icon (varies by event category — status / audit / notification),
  a short label, a job-card tag badge (e.g. "Job Card #1", "Job Card #2
  (rework)"), and a relative timestamp.
- **Notification rows only**: an always-visible sub-line directly under the
  main line showing "Sent to `<recipientName>` via `<channel>`" (no click
  needed to see this — it's core to why this feature exists).
- No click-to-expand for any row type — everything needed is on the row.

### Backend — one new endpoint, no new table

`GET /api/work-orders/:id/timeline`, gated to `SUPER_ADMIN`/`ADMIN`:

1. Load the work order; `404` if missing.
2. Load every job card with that `workOrderId` (via the existing
   `getJobCards({ workOrderId })` filter path), then order them into a chain
   by walking `reworkOfJobCardId` (the row with no `reworkOfJobCardId` — or
   whose parent isn't in this set — is first; each subsequent card points
   back to the previous one).
3. For each job card, emit one event per populated lifecycle timestamp
   column (the 12 columns listed above), each tagged with that job card's
   position in the chain (`Job Card #1`, `#2 (rework)`, ...).
4. Query `audit_logs` where `entityId` is the work order id or any job card
   id in the chain **and** `entity` is one of
   `work_order, job_card, job_card_photo, job_card_media, job_card_rework_photo`
   (this second condition is required — `entityId` is just a UUID column, so
   without also constraining `entity` a coincidental UUID collision with an
   unrelated row, e.g. a `user` or `pricing_rule` audit entry, could leak
   into the timeline). Emit one event per row (label = `action`, tagged to
   the matching job card or "Work Order" if it's the WO's own id).
5. Query `notification_logs` where `relatedEntityId` matches the work order
   id or any job card id in the chain (with `relatedEntityType` narrowing
   the match); emit one event per row carrying `recipientName` and
   `channel` for the always-visible sub-line.
6. Merge all events into one array, sort by timestamp ascending, and
   return `{ workOrder, jobCardChain: [...], events: [...] }`.
- This merge/synthesis logic lives in a new `server/services/timelineService.ts`
  (matching the existing `services/` pattern) rather than inline in the
  route handler, since the merge logic is nontrivial.

### Error handling

- `403` if the caller isn't `SUPER_ADMIN`/`ADMIN`.
- `404` if the work order id doesn't exist.
- Empty `events` array (not an error) if a work order genuinely has no
  timeline-worthy data yet (e.g. a brand-new `DRAFT` work order).

### Testing

Per this repo's existing convention (no automated test framework — see the
photo-replace plan's Global Constraints for precedent), verification is
manual: start the dev server, hit `GET /api/work-orders/:id/timeline` with
a real work order id via PowerShell, confirm the merged/sorted event list
and chain ordering are correct, then verify the same visually in the
browser modal, including a work order that has gone through at least one
rework so the multi-job-card chain and per-job-card tagging can be checked.

## Open questions / notes for the implementation plan

- Confirm the exact icon set (per event category) and the exact label
  text/format for each of the 12 lifecycle timestamp columns during
  planning — these are presentation details, not architectural ones.
