# Task 2: Frontend — Sidebar entry, route, and Timeline page — COMPLETED

**Date:** 2026-08-07  
**Status:** DONE

---

## Summary

Successfully implemented Task 2 of the work-order timeline feature: added a "Timeline" sidebar entry (SUPER_ADMIN/ADMIN only), registered the `/timeline` route, and created the full Timeline page with work-order list, search/status filtering, and a modal showing merged timeline events per work order.

---

## Changes Made

### 1. `client/src/components/layout/Sidebar.tsx`

**Edits:**
- Added `Route` icon import from lucide-react (line ~30)
- Added "Timeline" entry to `systemNavigation` array with:
  - name: "Timeline"
  - href: "/timeline"
  - icon: Route
  - roles: ["SUPER_ADMIN", "ADMIN"]
- Updated `systemHrefs` array to include "/timeline" (maintains System section divider logic)

**Result:** Timeline entry now appears in sidebar's System section between "Audit Logs" and "Settings" for admin users only.

---

### 2. `client/src/App.tsx`

**Edits:**
- Added import: `import TimelinePage from "./pages/timeline";` (after NotificationsPage import)
- Added route block for `/timeline` path (after `/notifications` route, before `/settings` route):
  ```tsx
  <Route
    path="/timeline"
    component={() => <ProtectedRoute component={TimelinePage} />}
  />
  ```

**Result:** Route properly registered with `ProtectedRoute` wrapper; access is gated by authentication and role check in the page component itself.

---

### 3. `client/src/pages/timeline.tsx` (NEW)

**Implementation:** Full Timeline page created with:

**Key Components:**
- **Page Layout:** Title + description, card-based work-order table, modal overlay
- **Work Order List:** Displays reg no, customer name/phone, status badge, creation date
- **Filtering:**
  - Text search: matches reg no, customer name, phone, or work order ID
  - Status dropdown: filters by status (DRAFT, SUBMITTED, ASSIGNED, etc.)
- **Eye Button:** Clickable per row, opens modal with timeline for that work order
- **Timeline Modal:** 
  - Fetches from `GET /api/work-orders/:id/timeline` (Task 1 backend)
  - Shows all events sorted chronologically
  - Event categories: status (CheckSquare icon), audit (History icon), notification (Bell icon)
  - Notification rows display: "Sent to `<recipient>` via `<channel>`" inline with icon
  - Displays job card tags (Job Card #1, Job Card #2 (rework), etc.)
  - Shows human-readable timestamps + relative time ("2 hours ago")

**Access Control:**
- `canAccess` check: only SUPER_ADMIN/ADMIN can view the page
- Non-admin users see "Access restricted" message
- Query is only enabled if `canAccess` is true

**Styling:**
- Reuses existing shadcn/ui components (Card, Button, Badge, Input, Select, Table, Dialog)
- Follows `notifications.tsx` template structure (search bar, status filter, table layout)
- Responsive design with flex wrapping
- Data-testid attributes for e2e testing

**All Code Faithfully Copied:** The implementation follows the plan's code block exactly, with no deviations or reinventions.

---

## TypeScript Verification

**Command:** `npm run check`  
**Baseline Errors:** 222 (pre-existing, unrelated to Task 1 or Task 2)  
**Current Errors:** 222  
**New Errors Introduced:** 0

**Verification Method:** Compared pre-check baseline (222 errors in server/storage.ts and other files) against post-implementation check. New files (`timeline.tsx`) and edits to `Sidebar.tsx` and `App.tsx` introduce zero new TypeScript errors.

---

## Dev Server Verification

**Command:** `npm run dev`  
**Result:** ✅ Server started successfully on port 5000

**Build Output Observed:**
- No compilation errors
- React dev server initialized successfully
- Vite client script loaded
- HTML root with React module mounting point ready
- No runtime errors in console

**Code Compiles Successfully:** The page imports and component dependencies all resolve correctly. No missing imports or type mismatches.

---

## Manual Testing Scope

**What was verified:**
- ✅ TypeScript check passes with no new errors
- ✅ Dev server starts cleanly without build errors
- ✅ No import or component errors in new page code
- ✅ Sidebar edits are syntactically correct
- ✅ Route registration in App.tsx is properly formatted

**What could NOT be verified (requires running instance + auth):**
- ❌ Live sidebar rendering for admin users (requires login with real SUPER_ADMIN/ADMIN credential)
- ❌ Clicking Timeline sidebar entry and navigating to `/timeline`
- ❌ Work order list fetching from `GET /api/work-orders` endpoint
- ❌ Modal opening and timeline data rendering from `GET /api/work-orders/:id/timeline`
- ❌ Search and status filter functionality
- ❌ Access restriction message for non-admin users

**Reason:** No test user credentials provided in environment. Dev server verification confirms code builds without errors; functional end-to-end testing would require a running instance and test login credentials (e.g., SUPER_ADMIN email/password or SSO token).

---

## Architecture Notes

- **Task 1 Integration:** Frontend correctly calls `GET /api/work-orders/:id/timeline` (Task 1 endpoint) to fetch timeline data; no payload sent, only auth header required
- **Data Fetching:** Uses TanStack Query (`useQuery`) with `apiRequest` utility, matching existing pattern in notifications.tsx
- **Role-Based Access:** Enforced at both sidebar level (roles filter) and page level (canAccess check); backend endpoint (Task 1) independently validates roles
- **Styling:** Uses existing shadcn/ui primitives (no new components); dark/light mode support inherited from theme system
- **State Management:** Local component state (search, status, selectedWorkOrderId); TanStack Query handles API state and caching

---

## Concerns & Notes

**None.** Implementation is complete and aligns with plan specification. All code matches the provided plan block exactly. Task 1 backend is already present and ready to be called.

---

## Next Steps (Not in Scope)

- Task 3: End-to-end verification (manual testing in browser with real credentials)
- Deploy to staging/production when ready
- User acceptance testing with admin team

---

## Files Changed

| File | Status | Changes |
|------|--------|---------|
| `client/src/components/layout/Sidebar.tsx` | Modified | + Route import, + Timeline nav entry, + "/timeline" to systemHrefs |
| `client/src/App.tsx` | Modified | + TimelinePage import, + /timeline route |
| `client/src/pages/timeline.tsx` | Created | Full 223-line Timeline page implementation |

---

## Commands Run (Not Committed per Instructions)

```bash
npm run check          # 222 errors (no change from baseline)
npm run dev            # ✅ Server started successfully
```

**Git Status:** All changes uncommitted in working tree (per workspace rules — user will run git commit).
