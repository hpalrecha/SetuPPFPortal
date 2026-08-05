# P91 E-Warranty — Cross-App Registration (SetuPPFPortal → P91Elite)

**Date:** 2026-08-05
**Status:** Approved for implementation (design)
**Repos touched:** `SetuPPFPortal` (Pulse VAS) and `P91Elite` (P91 Elite ERP)

---

## 1. Problem / goal

Today, when a partner applies for e-warranty on a job card in SetuPPFPortal
(`POST /api/job-cards/:id/request-e-warranty`), it always does the same thing:
flips `eWarrantyApplied`, moves status to `WARRANTY_REGISTRATION`, and emails two
hard-coded STEK addresses. That is correct **only for STEK** film.

We are adding a **P91-branded** path. When the PPF raw material used on the job is a
**P91** product (not STEK), applying for e-warranty must instead **register the warranty
in P91Elite** by pushing the job's data into P91Elite's e-warranty registration, over the
existing HMAC-signed Setu↔Pulse channel.

STEK (and any non-P91 brand) behaviour is **unchanged**.

---

## 2. Trigger & brand gate (Step 1)

Entry point unchanged: `POST /api/job-cards/:id/request-e-warranty`
(`SetuPPFPortal/server/routes.ts:5421`).

Determine the brand of the film used on the job:

```
jobCard.workOrderId → workOrders.serviceId → services.productBrand
```

- Source of truth = **`services.productBrand`** (set in service management; reliably
  populated as "P91" / "Stek" / "3M" for every service — verified against prod data).
- NOTE: the `serviceRawMaterials → rawMaterials.brandId → brands.name` relational link was
  the original design choice but is **sparsely/inconsistently populated** in practice (0
  P91-brand raw materials exist; several services have no raw-material link) and cannot
  identify P91 — so it is NOT used.
- If the service is missing or its `productBrand` is blank, treat brand as
  **undetermined** → do NOT silently pick STEK; return a clear error so it can be fixed.
- Brand match is case-insensitive on `productBrand` containing `P91` (P91 path) vs.
  everything else (legacy/STEK path). `"Stek"`/`"P91"` are data, not enums.

Branching:

| Brand | Behaviour |
|-------|-----------|
| **P91** | Common state change **+ synchronous push to P91Elite** (Section 4). No STEK emails. |
| STEK / other | **Unchanged** — common state change + existing fire-and-forget STEK emails. |
| Undetermined | 400 error, no state change. |

**Common state change (both brands):** set `eWarrantyApplied=true`,
`eWarrantyAppliedAt=now`, `status='WARRANTY_REGISTRATION'`, sync work-order status.
For the **P91** path this happens **only after** P91Elite accepts the registration
(so a rejected batch number leaves the job card re-tryable).

---

## 3. Data mapping (Step 2) — Setu job card/work order → P91Elite sub-forms

| P91Elite sub-form / field | Source in SetuPPFPortal | Notes |
|---|---|---|
| **Installer & Store** | | |
| installerName | `users.name` via `jobCard.assignedInstallerId` | falls back to applying user if unassigned |
| installerMobile | `users.phone` (same user) | |
| store*Name/Email/Location* → **showroom** name/email/location | `showrooms` via `workOrder.showroomId` | use **real** columns `name`, `contactEmail`, and `address`/`city`/`state` — NOT the buggy `contactPerson*` (see §6) |
| **Customer** | | |
| customerFirstName / customerLastName | split `workOrder.customerName` | |
| customerMobile | `workOrder.customerPhone` | if blank → set `hniMobile=true` |
| customerEmail | `workOrder.customerEmail` | if blank → set `hniEmail=true` |
| customerAddress | `workOrder.customerAddress` | if blank → set `hniAddress=true` |
| **Car** | | |
| carMake | OEM name via `workOrder.oemId` (OEM = vehicle brand) | |
| carModel | `vehicleModels.modelName` via `workOrder.vehicleModelId` | |
| carRegOrVIN (VIN) | `workOrder.regNo` | if empty/`-`, front-end prompts and **writes the value back into `regNo`** before the push |
| carColor | (none in Setu) | sent blank; P91Elite must accept blank (see §6 bug) |
| **Installation** | | |
| productInstalled | the service (`services.name`) — the raw-material-linked PPF | for now `"Full Car PPF"` |
| installationDate | `jobCard.completedAt` (fallback now) | |
| fullCarPPF | `true` (for now) | granular coverage flags not modelled in Setu |
| **Product & Photos** | | |
| lotNumbers `[{lotNumber, quantity}]` | batch: `jobCard.batchNumbers` (user-entered/validated); quantity: sq.ft from `jobCard.materialConsumptionJson` | if quantity missing, front-end prompts |
| photos | `jobCard.batchNumberImage` (optional) | best-effort |

HNI = high-net-worth customer who withheld contact info; the HNI flags let P91Elite
accept the blank customer field (mirrors P91Elite's `superRefine`).

---

## 4. Transport & the three cross-cutting concerns

### 4.1 Transport (reuse existing signed channel)
- **Outbound (Setu):** extend `SetuPPFPortal/server/services/pulseApiService.ts` with
  `requestWarrantyRegistration(payload)` — HMAC-SHA256 over the JSON body with
  `PULSE_WEBHOOK_SECRET`, header `x-setu-signature`, ISO `timestamp` for replay
  protection, `POST ${PULSE_API_URL}/api/integrations/setu/warranty-registration`.
- **Inbound (P91Elite):** add a route in
  `P91Elite/artifacts/api-server/src/routes/setu-integration-routes.ts` mirroring the
  `staff-invite` handler: `verifySetuSignature`, 5-minute timestamp tolerance.

### 4.2 Concern #1 — User identity across both systems
- The **only** shared key: `P91Elite.users.ppf_setu_user_id (uuid) = SetuPPFPortal.users.id (uuid)`.
- Setu includes the **applying user's** `users.id` in the payload as `setuUserId`.
- P91Elite resolves its own user via `WHERE ppf_setu_user_id = setuUserId` and attributes
  the warranty (`detailerId`) to that user.
- **Edge case:** if no P91Elite user has that `ppf_setu_user_id` (staff not yet provisioned
  into P91Elite), the receiver returns **400 `USER_NOT_LINKED`** with a clear message;
  Setu surfaces it and does **not** mark the job card applied.

### 4.3 Concern #2 — Batch-number check
- The receiver validates each submitted batch number against P91Elite's **sold-units**
  table (reuse the existing `validate-batch` logic / `getSoldUnitByBatchNumber` +
  quantity-remaining check) **inside the same atomic call**.
- Invalid/insufficient batch → **400 `BATCH_INVALID`** (with which batch failed); Setu
  surfaces it and does **not** mark the job card applied, so the user can correct and retry.
- Valid → create the warranty (reusing P91Elite's `createWarrantyRegistration`, including
  its existing auto-approve + sold-unit decrement behaviour).

### 4.4 Concern #3 — (intentionally out of scope for this pass, per product owner)

---

## 5. Response / user feedback
- P91 path is **synchronous**: on `200` from P91Elite (returns `warrantyCode`, status),
  Setu applies the common state change and returns the updated job card **plus**
  `{ warranty: { code, status } }` so the UI can confirm registration.
- On `USER_NOT_LINKED` / `BATCH_INVALID` / transport failure → Setu returns the error;
  job card stays un-applied and re-tryable.

## 6. Bugs fixed along the way
1. **Showroom column bug** — `SetuPPFPortal/server/routes.ts:4347-4355` reads
   `showroom.contactPersonName/Phone/Email`, which don't exist; real columns are
   `managerName` / `contactPhone` / `contactEmail`. Fix so the job-card detail payload
   (and our warranty push) carry real showroom contact data.
2. **P91Elite mandatory car color** — the warranty registration form/zod makes `carColor`
   required; make it **optional** (Setu has no color to send).

## 7. Front-end (SetuPPFPortal)
The "Apply for E-Warranty" action gains a small pre-submit step **only when the resolved
brand is P91 and required data is missing**: prompt for VIN (if `regNo` empty → written back
to `regNo`), batch number(s), and quantity (sq.ft, if not derivable). STEK path keeps the
current one-click behaviour.

## 8. Out of scope
- No PDF/QR certificate generation on the Setu side (P91Elite owns that on approval).
- No granular PPF coverage zones (always Full Car PPF for now).
- No new `customers`/VIN/color columns in Setu beyond writing VIN back into `regNo`.
- The unspecified "third concern" (deferred by product owner).

## 9. Env / config
Reuses existing `PULSE_API_URL` and `PULSE_WEBHOOK_SECRET` on both sides. No new secrets.
