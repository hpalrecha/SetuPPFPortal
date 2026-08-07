# Work Order / Job Card Timeline Implementation Plan

## Implementation Status (2026-08-07)

**Both tasks implemented via subagent-driven-development, in this working tree, NOT committed** (this workspace's rule: only the human runs `git add`/`git commit`).

- **Task 1 (backend) — DONE, reviewed, approved.**
  - Created `server/services/timelineService.ts` and added `GET /api/work-orders/:id/timeline` to `server/routes.ts` (after the existing `GET /api/work-orders/:id` handler).
  - Task reviewer verdict: Spec compliance ✅, Task quality Approved. Only Minor/cosmetic findings, no fixes required: (1) an unused `jobCards` import in `timelineService.ts`, (2) a harmless unreachable `|| 'Work Order'` fallback in two tag-lookup lines, (3) loose `any` typing that matches this codebase's existing conventions (e.g. `storage.getWorkOrder()` is already typed `any`).
  - Live PowerShell/browser verification (the plan's Task 1 Steps 4-5) was **not run** — no admin credentials were available in the implementer's environment. The reviewer verified correctness by reading the actual schema/storage/middleware code instead (confirmed field names, the `getJobCards({workOrderId})` code path, the audit-log entity-allowlist logic, and the notification `relatedEntityType` values against `server/services/notificationService.ts`).

- **Task 2 (frontend) — DONE, reviewed, approved.**
  - Added the "Timeline" sidebar entry (`client/src/components/layout/Sidebar.tsx`, `SUPER_ADMIN`/`ADMIN` only), registered the `/timeline` route (`client/src/App.tsx`), and created `client/src/pages/timeline.tsx` (work order list + search/status filter + Eye button + timeline modal).
  - Task reviewer verdict: Spec compliance ✅, Task quality Approved. One Minor finding was found and **fixed directly** (not via a fix-subagent, since it was a 1-line change): `STATUS_OPTIONS` was missing `PENDING` and `REWORK_REQUESTED` from the 10-value `workOrderStatusEnum` — now includes all 10.
  - Live login-and-click-through verification (Task 2 Step 5) was **not fully run** for the same credentials reason — the dev server was confirmed to start cleanly with no build/import errors, and the reviewer independently confirmed the frontend's response-shape assumptions (`workOrder`/`jobCardChain`/`events[...]`) match exactly what `timelineService.ts` returns.

- **TypeScript check**: independently re-verified by the controller (not just self-reported by implementers) at 222 errors — this repo's pre-existing baseline — both before Task 1 and after every subsequent change, including the `STATUS_OPTIONS` fix. Zero new errors introduced by this feature.

- **Final whole-branch review — complete.** Verdict: "sound, wires together correctly end-to-end." Role-gating (`SUPER_ADMIN`/`ADMIN`, no OEM-scoping) was confirmed appropriate — it exactly matches the existing `GET /api/notification-logs` precedent, which already exposes the same class of cross-OEM data to the same two roles. Chain-ordering/merge/sort logic confirmed to never drop or duplicate an event. Two findings, **not yet fixed** (left for you per your instruction to take it from here):
  - **[Medium]** `client/src/pages/timeline.tsx` fetches `GET /api/work-orders` with no `limit`/`search` and filters client-side; the server defaults to the 500 most-recent work orders (`server/routes.ts:3200`, `server/storage.ts:1501`). This deviates from the spec (which called for a server-side `search` param) — once an admin's scope exceeds 500 work orders, older ones silently can't be found or opened, with no "showing 500 of N" indicator. Works fine today; degrades invisibly as data grows.
  - **[Minor]** Both `useQuery` calls in `timeline.tsx` (list at ~line 561, modal at ~line 433) only branch on `isLoading` vs. empty data, not `isError`. A real 500 from the timeline endpoint would render as "No timeline events yet." rather than an error — indistinguishable from a work order that genuinely has no history. Matches `notifications.tsx`'s existing detail-dialog pattern, so it's consistent with the codebase, but worth a fix given this view's whole purpose is completeness.

**Post-review refinements (2026-08-07, after user review of the live feature):**
- Investigated "notifications not showing" — confirmed the pipeline is correct end-to-end (ran `timelineService.getWorkOrderTimeline` against a real work order: 38 events returned incl. 26 notifications with recipient + channel). DB has 3,127 job_card + 90 work_order linked notifications. Root cause of the user not seeing them was environmental (stale dev server), not a code defect. No code change needed for this.
- Verified column data completeness against the DB: customerName 381/381, customerPhone 380/381, regNo 373/381 — the reg-no/customer linkage is correct and well-populated.
- **Added a Showroom column + showroom filter dropdown** to the list (`client/src/pages/timeline.tsx`); search now also matches showroom name. `showroomName` was already returned by the `getWorkOrders` enrichment.
- Briefly tried showing the **Job Card status** in the list column (with a backend `getWorkOrders` enrichment), then **reverted it** at the user's request — the list Status column shows the **work order status** again. The `server/storage.ts` enrichment was fully removed (back to original). The list column, `STATUS_OPTIONS`, and filter are all back to the 10-value `workOrderStatusEnum`.
- **Colour-coded the timeline modal** so the trail is scannable: each event is one of three kinds — **Job card (blue)**, **Work order (purple)**, **Notification (green)** — shown via a coloured left border + coloured icon chip, with a legend at the top of the modal. Kind is derived by `eventKind()`: notifications → green; anything tagged "Work Order" → purple; all other (job-card lifecycle/actions) → blue.
- All changes re-typechecked: still at the 222-error baseline, zero new errors. `server/storage.ts` is unchanged from original (its net diff is now empty).

**Files changed, currently uncommitted:**
- `server/services/timelineService.ts` (new)
- `server/routes.ts` (modified — new endpoint added)
- `client/src/pages/timeline.tsx` (new — includes showroom column/filter and colour-coded timeline modal)
- `client/src/components/layout/Sidebar.tsx` (modified — Timeline nav entry)
- `client/src/App.tsx` (modified — `/timeline` route)

(`server/storage.ts` is NOT in this list anymore — the temporary jobCardStatus enrichment was reverted.)

**To commit, once you're satisfied:**
```bash
cd D:/p91/p91/p91web/setuppfportal
git add server/services/timelineService.ts server/routes.ts client/src/pages/timeline.tsx client/src/components/layout/Sidebar.tsx client/src/App.tsx docs/superpowers/specs/2026-08-07-work-order-timeline-design.md docs/superpowers/plans/2026-08-07-work-order-timeline.md
git commit -m "Add work order/job card timeline feature (SUPER_ADMIN/ADMIN)"
```

**Not yet done — worth running before/after committing:**
- The plan's Task 3 (end-to-end manual verification with a real admin login): open `/timeline`, view a work order with no rework, view one with a rework chain, confirm notification rows show "Sent to `<name>` via `<channel>`" inline, confirm a brand-new work order with no job cards shows "No timeline events yet." without erroring.

---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `SUPER_ADMIN`/`ADMIN` a "Timeline" tab that lists work orders and, via an Eye-icon button, opens a modal showing the full merged chronological trail (status changes, audit actions, notifications) across a work order's entire job-card rework chain.

**Architecture:** One new backend service (`timelineService.ts`) synthesizes events on-demand from three existing data sources (job card lifecycle timestamps, `audit_logs`, `notification_logs`) — no new table. One new endpoint exposes it. The frontend adds a sidebar entry, a route, and a new page that reuses the existing `GET /api/work-orders` list plus the new timeline endpoint behind a modal.

**Tech Stack:** Express + Drizzle ORM (backend), React + TanStack Query + wouter (frontend), shadcn/ui components.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-07-work-order-timeline-design.md` — every requirement in that file must be covered by a task below.
- Read-only feature — no writes, no new table, no editing from this view.
- Access restricted to `SUPER_ADMIN`/`ADMIN` only, both on the sidebar entry and the backend endpoint.
- No click-to-expand for any row — notification rows show recipient + channel inline, always visible; everything else is a one-line entry.
- **No automated test framework exists in this repo** (see the photo-replace plan's precedent) — every task is verified manually via PowerShell `Invoke-RestMethod` and the browser.
- Follow existing conventions exactly: services are classes with a singleton export (`export const xService = new XService();`), imported into `routes.ts` via a dynamic `await import('./services/...')` inside the handler (there are zero static service imports at the top of `routes.ts` today — don't introduce the first one).
- Match `notifications.tsx`'s visual/structural style (search + status filter + table, `apiRequest`/`useQuery` for data fetching) since it's the closest existing template.

---

### Task 1: Backend — Timeline synthesis service + endpoint

**Files:**
- Create: `server/services/timelineService.ts`
- Modify: `server/routes.ts` (insert after the `GET /api/work-orders/:id` handler, which ends at `server/routes.ts:3449`)

**Interfaces:**
- Consumes: `storage.getWorkOrder(id): Promise<any | undefined>` (`server/storage.ts:1563`), `storage.getJobCards({ workOrderId }): Promise<JobCard[]>` (`server/storage.ts:1787`, the plain-`workOrderId` filter falls through to the simple query at `server/storage.ts:1876-1900`), `db` (`server/db.ts`), schema tables `jobCards`, `auditLogs`, `notificationLogs`, `users`, `workOrders` (`@shared/schema`), `requireRole`/`authenticate` (`./middleware`, already imported in `routes.ts`).
- Produces: `timelineService.getWorkOrderTimeline(workOrderId: string): Promise<WorkOrderTimeline | undefined>` where
  ```ts
  interface TimelineEvent {
    timestamp: string;       // ISO
    category: 'status' | 'audit' | 'notification';
    label: string;
    jobCardTag: string;      // "Work Order" | "Job Card #1" | "Job Card #2 (rework)" | ...
    jobCardId?: string;
    recipientName?: string;  // notification events only
    channel?: string;        // notification events only ("EMAIL"|"WHATSAPP"|"SMS"|"PUSH")
  }
  interface JobCardChainEntry { id: string; tag: string; status: string | null; }
  interface WorkOrderTimeline { workOrder: any; jobCardChain: JobCardChainEntry[]; events: TimelineEvent[]; }
  ```
  and `GET /api/work-orders/:id/timeline` returning that shape as JSON. Consumed by Task 2 (frontend).

- [ ] **Step 1: Create the service file**

Write `server/services/timelineService.ts`:

```ts
import { db } from '../db';
import { storage } from '../storage';
import { jobCards, auditLogs, notificationLogs, users } from '@shared/schema';
import { inArray, and } from 'drizzle-orm';
import type { JobCard } from '@shared/schema';

const AUDIT_TIMELINE_ENTITIES = ['work_order', 'job_card', 'job_card_photo', 'job_card_media', 'job_card_rework_photo'];
const NOTIFICATION_TIMELINE_ENTITY_TYPES = ['work_order', 'job_card'];

const LIFECYCLE_EVENTS: Array<{ field: keyof JobCard; label: string }> = [
  { field: 'createdAt', label: 'Job card created' },
  { field: 'acknowledgedAt', label: 'Acknowledged by partner' },
  { field: 'scheduledAt', label: 'Installation scheduled' },
  { field: 'preInstallationCompletedAt', label: 'Pre-installation inspection completed' },
  { field: 'startedAt', label: 'Installation started' },
  { field: 'completedAt', label: 'Installation completed' },
  { field: 'approvalRequestedAt', label: 'Approval requested' },
  { field: 'approvedAt', label: 'Approved' },
  { field: 'paymentSettledAt', label: 'Payment settled' },
  { field: 'warrantyAppliedAt', label: 'Warranty applied' },
  { field: 'eWarrantyAppliedAt', label: 'E-warranty applied' },
  { field: 'reworkRequestedAt', label: 'Rework requested' },
  { field: 'reworkCompletedAt', label: 'Rework completed' },
];

export interface TimelineEvent {
  timestamp: string;
  category: 'status' | 'audit' | 'notification';
  label: string;
  jobCardTag: string;
  jobCardId?: string;
  recipientName?: string;
  channel?: string;
}

export interface JobCardChainEntry {
  id: string;
  tag: string;
  status: string | null;
}

export interface WorkOrderTimeline {
  workOrder: any;
  jobCardChain: JobCardChainEntry[];
  events: TimelineEvent[];
}

class TimelineService {
  // Orders a work order's job cards into their rework chain (original first,
  // each rework after the card it reworked). Falls back to createdAt order
  // for cards that don't cleanly chain (defensive — in practice each rework
  // points at exactly one prior card, forming a simple linear chain).
  private orderJobCardChain(cards: JobCard[]): JobCard[] {
    const byId = new Map(cards.map(c => [c.id, c]));
    const childOf = new Map<string, JobCard>();
    for (const c of cards) {
      if (c.reworkOfJobCardId && byId.has(c.reworkOfJobCardId)) {
        childOf.set(c.reworkOfJobCardId, c);
      }
    }

    const roots = cards
      .filter(c => !c.reworkOfJobCardId || !byId.has(c.reworkOfJobCardId))
      .sort((a, b) => new Date(a.createdAt as any).getTime() - new Date(b.createdAt as any).getTime());

    const ordered: JobCard[] = [];
    const visited = new Set<string>();
    for (const root of roots) {
      let current: JobCard | undefined = root;
      while (current && !visited.has(current.id)) {
        ordered.push(current);
        visited.add(current.id);
        current = childOf.get(current.id);
      }
    }
    for (const c of cards) {
      if (!visited.has(c.id)) ordered.push(c);
    }
    return ordered;
  }

  async getWorkOrderTimeline(workOrderId: string): Promise<WorkOrderTimeline | undefined> {
    const workOrder = await storage.getWorkOrder(workOrderId);
    if (!workOrder) return undefined;

    const cards = await storage.getJobCards({ workOrderId });
    const orderedCards = this.orderJobCardChain(cards);

    const jobCardChain: JobCardChainEntry[] = orderedCards.map((c, index) => ({
      id: c.id,
      tag: index === 0 ? 'Job Card #1' : `Job Card #${index + 1} (rework)`,
      status: c.status,
    }));
    const tagByJobCardId = new Map(jobCardChain.map(entry => [entry.id, entry.tag]));

    const events: TimelineEvent[] = [];

    for (const card of orderedCards) {
      const tag = tagByJobCardId.get(card.id)!;
      for (const { field, label } of LIFECYCLE_EVENTS) {
        const value = (card as any)[field];
        if (value) {
          events.push({
            timestamp: new Date(value).toISOString(),
            category: 'status',
            label,
            jobCardTag: tag,
            jobCardId: card.id,
          });
        }
      }
    }

    const relevantIds = [workOrderId, ...orderedCards.map(c => c.id)];

    const auditRows = await db
      .select()
      .from(auditLogs)
      .where(and(
        inArray(auditLogs.entityId, relevantIds),
        inArray(auditLogs.entity, AUDIT_TIMELINE_ENTITIES)
      ));

    const actorIds = Array.from(new Set(auditRows.map(r => r.actorUserId).filter((id): id is string => !!id)));
    const actorRows = actorIds.length
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, actorIds))
      : [];
    const actorNameById = new Map(actorRows.map(u => [u.id, u.name]));

    for (const row of auditRows) {
      const tag = row.entityId === workOrderId ? 'Work Order' : (tagByJobCardId.get(row.entityId) || 'Work Order');
      const actorName = row.actorUserId ? actorNameById.get(row.actorUserId) : undefined;
      events.push({
        timestamp: new Date(row.createdAt as any).toISOString(),
        category: 'audit',
        label: actorName ? `${row.action} by ${actorName}` : row.action,
        jobCardTag: tag,
        jobCardId: row.entityId === workOrderId ? undefined : row.entityId,
      });
    }

    const notificationRows = await db
      .select()
      .from(notificationLogs)
      .where(and(
        inArray(notificationLogs.relatedEntityId, relevantIds),
        inArray(notificationLogs.relatedEntityType, NOTIFICATION_TIMELINE_ENTITY_TYPES)
      ));

    for (const row of notificationRows) {
      const relatedId = row.relatedEntityId as string;
      const tag = relatedId === workOrderId ? 'Work Order' : (tagByJobCardId.get(relatedId) || 'Work Order');
      events.push({
        timestamp: new Date(row.createdAt as any).toISOString(),
        category: 'notification',
        label: row.eventType || 'Notification sent',
        jobCardTag: tag,
        jobCardId: relatedId === workOrderId ? undefined : relatedId,
        recipientName: row.recipientName || row.recipient || undefined,
        channel: row.channel,
      });
    }

    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return { workOrder, jobCardChain, events };
  }
}

export const timelineService = new TimelineService();
```

- [ ] **Step 2: Add the endpoint**

Insert into `server/routes.ts` immediately after line 3449 (the closing `});` of `GET /api/work-orders/:id`):

```ts
  app.get("/api/work-orders/:id/timeline",
    authenticate,
    requireRole(['SUPER_ADMIN', 'ADMIN']),
    async (req, res) => {
      try {
        const { timelineService } = await import('./services/timelineService');
        const timeline = await timelineService.getWorkOrderTimeline(req.params.id);
        if (!timeline) {
          return res.status(404).json({ error: "Work order not found" });
        }
        res.json(timeline);
      } catch (error) {
        console.error("Get work order timeline error:", error);
        res.status(500).json({ error: "Failed to build work order timeline" });
      }
    }
  );
```

- [ ] **Step 3: Type-check**

Run: `npm run check` (from `D:\p91\p91\p91web\setuppfportal`)
Expected: no new errors introduced by `timelineService.ts` or the new route (this repo has ~222 pre-existing unrelated errors — confirm the count doesn't increase, e.g. by comparing against a `git stash`d baseline the same way the photo-replace feature was verified).

- [ ] **Step 4: Start the dev server and verify manually**

Run: `npm run dev`

```powershell
$token = (Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/auth/login -ContentType "application/json" -Body '{"email":"<real-super-admin-email>","password":"<real-password>"}').token
$workOrders = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/work-orders" -Headers @{ Authorization = "Bearer $token" }
$woId = $workOrders[0].id
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/work-orders/$woId/timeline" -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 6
```

Expected: HTTP 200, a JSON object with `workOrder`, `jobCardChain` (at least one entry, `tag: "Job Card #1"`), and `events` (sorted ascending by `timestamp`, each with `category`/`label`/`jobCardTag`).

Then find a work order that has gone through rework (a job card whose `reworkOfJobCardId` is set — check via `GET /api/job-cards` and filter, or reuse one from earlier testing) and repeat:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/work-orders/<rework-work-order-id>/timeline" -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 6
```

Expected: `jobCardChain` has 2+ entries (`"Job Card #1"`, `"Job Card #2 (rework)"`), and `events` includes entries tagged with both.

- [ ] **Step 5: Verify role rejection**

Log in as a role other than `SUPER_ADMIN`/`ADMIN` (e.g. `OEM_ADMIN`) and repeat the request. Expected: HTTP 403 `{"error":"Insufficient permissions"}`.

- [ ] **Step 6: Commit**

```bash
git add server/services/timelineService.ts server/routes.ts
git commit -m "Add work order timeline synthesis service and endpoint"
```

---

### Task 2: Frontend — Sidebar entry, route, and Timeline page

**Files:**
- Modify: `client/src/components/layout/Sidebar.tsx`
- Modify: `client/src/App.tsx`
- Create: `client/src/pages/timeline.tsx`

**Interfaces:**
- Consumes: `GET /api/work-orders` (existing, `server/routes.ts:3189`), `GET /api/work-orders/:id/timeline` (Task 1), `apiRequest` (`@/lib/queryClient`), `useAuth()`.

- [ ] **Step 1: Add the sidebar entry**

In `client/src/components/layout/Sidebar.tsx`, change the lucide-react import block (ends at line 30-31):

```tsx
  Contact,
  Bell
} from "lucide-react";
```

to:

```tsx
  Contact,
  Bell,
  Route
} from "lucide-react";
```

Then change `systemNavigation` (lines 70-74):

```tsx
const systemNavigation = [
  { name: "Notifications", href: "/notifications", icon: Bell, roles: ["SUPER_ADMIN", "ADMIN"] },
  { name: "Audit Logs", href: "/audit", icon: History, roles: ["SUPER_ADMIN", "ADMIN", "OEM_ADMIN"] },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON", "PARTNER_ADMIN", "PARTNER_STAFF", "DETAILING_PARTNER"] },
];
```

to:

```tsx
const systemNavigation = [
  { name: "Notifications", href: "/notifications", icon: Bell, roles: ["SUPER_ADMIN", "ADMIN"] },
  { name: "Audit Logs", href: "/audit", icon: History, roles: ["SUPER_ADMIN", "ADMIN", "OEM_ADMIN"] },
  { name: "Timeline", href: "/timeline", icon: Route, roles: ["SUPER_ADMIN", "ADMIN"] },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "OEM_ADMIN", "DEALERSHIP_ADMIN", "SHOWROOM_MANAGER", "SALES_PERSON", "PARTNER_ADMIN", "PARTNER_STAFF", "DETAILING_PARTNER"] },
];
```

Then change `systemHrefs` (line 101):

```tsx
  const systemHrefs = ["/notifications", "/audit", "/settings"];
```

to:

```tsx
  const systemHrefs = ["/notifications", "/audit", "/timeline", "/settings"];
```

- [ ] **Step 2: Register the route**

In `client/src/App.tsx`, add the import after line 22 (`import NotificationsPage from "./pages/notifications";`):

```tsx
import TimelinePage from "./pages/timeline";
```

Then add the route after the `/notifications` route block (after line 233's closing `/>`):

```tsx
      <Route
        path="/timeline"
        component={() => <ProtectedRoute component={TimelinePage} />}
      />
```

- [ ] **Step 3: Create the Timeline page**

Write `client/src/pages/timeline.tsx`:

```tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Route, Search, Eye, CheckSquare, History, Bell, Mail, MessageCircle, Smartphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_OPTIONS = ['DRAFT', 'SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED_PENDING_APPROVAL', 'APPROVED', 'CLOSED', 'CANCELLED'];

const CHANNEL_LABEL: Record<string, string> = {
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  PUSH: 'In-app',
};

const CHANNEL_ICON: Record<string, any> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SMS: Smartphone,
  PUSH: Bell,
};

const CATEGORY_ICON: Record<string, any> = {
  status: CheckSquare,
  audit: History,
  notification: Bell,
};

function TimelineModal({ workOrderId, open, onClose }: { workOrderId: string | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/work-orders', workOrderId, 'timeline'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/work-orders/${workOrderId}/timeline`);
      return res.json();
    },
    enabled: open && !!workOrderId,
  });

  const events = data?.events || [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Timeline{data?.workOrder?.regNo ? ` — ${data.workOrder.regNo}` : ''}
          </DialogTitle>
          <DialogDescription>{data?.workOrder?.customerName || ''}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Loading…</div>
        ) : events.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">No timeline events yet.</div>
        ) : (
          <div className="space-y-3">
            {events.map((event: any, index: number) => {
              const Icon = CATEGORY_ICON[event.category] || History;
              const ChannelIcon = event.channel ? (CHANNEL_ICON[event.channel] || Bell) : null;
              return (
                <div key={index} className="flex gap-3 border-b pb-3 last:border-b-0">
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{event.label}</span>
                      <Badge variant="outline" className="text-xs">{event.jobCardTag}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDateTime(event.timestamp)} · {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                    </div>
                    {event.category === 'notification' && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        {ChannelIcon && <ChannelIcon className="h-3 w-3" />}
                        Sent to {event.recipientName || 'unknown recipient'} via {CHANNEL_LABEL[event.channel] || event.channel}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function TimelinePage() {
  const { user } = useAuth();
  const canAccess = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['/api/work-orders'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/work-orders');
      return res.json();
    },
    enabled: canAccess,
  });

  const workOrders = data || [];

  const filtered = useMemo(() => {
    return workOrders.filter((wo) => {
      if (status !== 'all' && wo.status !== status) return false;
      if (search) {
        const term = search.toLowerCase();
        const haystack = [wo.regNo, wo.customerName, wo.customerPhone, wo.id].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [workOrders, search, status]);

  if (!canAccess) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Access restricted. Timeline is available to admins only.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Route className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Timeline</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        The full trail for a work order and every job card in its rework chain — status changes,
        admin actions, and notifications — in one place. Click the eye icon to view.
      </p>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{filtered.length} work order{filtered.length === 1 ? '' : 's'}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-44" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-64 max-w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reg no, customer…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-timeline"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reg No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No work orders found.</TableCell></TableRow>
              ) : filtered.map((wo) => (
                <TableRow key={wo.id} data-testid={`row-work-order-${wo.id}`}>
                  <TableCell className="font-mono text-sm">{wo.regNo || '—'}</TableCell>
                  <TableCell>
                    <div className="font-medium">{wo.customerName || <span className="text-muted-foreground">—</span>}</div>
                    <div className="text-xs text-muted-foreground">{wo.customerPhone || '—'}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{wo.status}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDateTime(wo.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedWorkOrderId(wo.id)}
                      data-testid={`button-view-timeline-${wo.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TimelineModal
        workOrderId={selectedWorkOrderId}
        open={!!selectedWorkOrderId}
        onClose={() => setSelectedWorkOrderId(null)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: no new errors beyond the pre-existing baseline (compare via `git stash` the same way as Task 1).

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`, open `http://localhost:5000`, log in as `SUPER_ADMIN` or `ADMIN`.
Expected: a "Timeline" entry appears in the sidebar's System section (between Audit Logs and Settings). Clicking it loads `/timeline` showing a searchable/filterable work order table. Log in as a non-admin role (e.g. `PARTNER_ADMIN`) — expected: no "Timeline" entry in the sidebar, and navigating to `/timeline` directly shows the "Access restricted" message.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/layout/Sidebar.tsx client/src/App.tsx client/src/pages/timeline.tsx
git commit -m "Add Timeline page: work order list with per-order timeline modal"
```

---

### Task 3: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Open the Timeline page as `SUPER_ADMIN`**, search for a known reg no or customer name, confirm the list filters correctly, and confirm the status filter narrows the list.

- [ ] **Step 2: Click the Eye button on a work order with a straightforward history** (no rework). Expected: the modal opens, shows `Job Card #1` tags only, events appear in ascending chronological order, and at least one notification row (if that work order has any) shows the "Sent to `<name>` via `<channel>`" sub-line directly, with no click needed.

- [ ] **Step 3: Click the Eye button on a work order that has gone through rework.** Expected: the modal shows events tagged across both `Job Card #1` and `Job Card #2 (rework)` (or more, if there were multiple reworks), correctly interleaved by timestamp rather than grouped by job card.

- [ ] **Step 4: Confirm audit-derived events render sensibly** — pick a work order/job card you know has `audit_logs` rows (e.g. one of the photo-replace test cases from the earlier feature) and confirm those actions show up with the `by <actor name>` suffix.

- [ ] **Step 5: Confirm the "no events yet" state** on a brand-new `DRAFT` work order with no job card yet — expected: the modal opens without erroring and shows "No timeline events yet."
