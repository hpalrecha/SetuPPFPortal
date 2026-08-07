SDD progress ledger

Task 1: complete (backend timelineService.ts + GET /api/work-orders/:id/timeline endpoint, uncommitted in working tree). Review: Spec compliance ✅, Task quality Approved. Minor findings for final review: (1) unused `jobCards` import in timelineService.ts, (2) unreachable `|| 'Work Order'` fallback in tag lookups (harmless defensive redundancy), (3) loose `any` typing consistent with existing codebase style.

Task 2: complete (Sidebar Timeline entry, /timeline route, client/src/pages/timeline.tsx, uncommitted in working tree). Review: Spec compliance ✅, Task quality Approved. Fixed directly (not via fix-subagent, trivial 1-line change): STATUS_OPTIONS was missing PENDING and REWORK_REQUESTED from the 10-value workOrderStatusEnum. Re-verified typecheck stays at baseline (222) after the fix.
