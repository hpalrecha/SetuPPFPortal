# Pulse VAS - Complete System Documentation

**Version:** 1.0  
**Last Updated:** October 24, 2025  
**System:** Multi-Tenant Paint Protection Film Management Platform

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Work Order Lifecycle](#work-order-lifecycle)
5. [Job Card Lifecycle](#job-card-lifecycle)
6. [Partner Allocation System](#partner-allocation-system)
7. [Pricing & Billing System](#pricing--billing-system)
8. [Commission System](#commission-system)
9. [Payout System](#payout-system)
10. [Notification System](#notification-system)
11. [Database Schema](#database-schema)
12. [Integration Points](#integration-points)

---

## System Overview

### Purpose
Pulse VAS is a comprehensive multi-tenant platform designed to manage Paint Protection Film (PPF) installation operations across Vehicle OEMs, dealerships, showrooms, and installation partners.

### Key Features
- **Multi-Tenant Architecture**: OEM-level data isolation
- **Role-Based Access Control**: 7 distinct user roles with granular permissions
- **Complete Workflow Management**: From order creation to payment settlement
- **Automated Partner Allocation**: Priority-based with brand and category matching
- **Hierarchical Pricing Rules**: Dealership, Partner, and Detailer pricing
- **Commission Tracking**: Automated calculation and settlement
- **Real-time Notifications**: Email, WhatsApp, SMS, and Push notifications
- **Audit Trail**: Comprehensive activity logging

### Technology Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Shadcn UI
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL 15+ with Drizzle ORM
- **Authentication**: JWT with bcrypt password hashing
- **File Storage**: Google Cloud Storage (via Replit Object Storage)
- **Background Jobs**: BullMQ + Redis
- **Notifications**: 
  - Email: SMTP (AWS SES disabled for performance)
  - WhatsApp: Meta Business API
  - SMS: (Configured but not yet implemented)
  - Push: In-app notifications

---

## Architecture

### Multi-Tenancy Model
```
OEM (Brand)
└── Dealership
    └── Showroom
        └── Work Orders
            └── Job Cards
                └── Partner Assignment
```

### Data Isolation
- **OEM Level**: Each OEM has completely isolated data
- **Cross-OEM Partners**: Partners can serve multiple OEMs (via `partner_oems` mapping)
- **Multi-OEM Dealerships**: Dealerships can belong to multiple OEMs

### System Components

#### Frontend Application
- Single Page Application (SPA)
- Role-based dashboards
- Real-time status updates
- Form validation with Zod
- Optimistic UI updates

#### Backend Services
- **WorkOrderService**: Order lifecycle management
- **JobCardService**: Job execution tracking
- **PricingService**: Hierarchical pricing resolution
- **CommissionService**: Sales commission calculation
- **NotificationService**: Multi-channel notifications
- **EmailService**: Email template management
- **WhatsAppService**: Meta WABA integration

#### Background Jobs (BullMQ + Redis)
- SLA monitoring and alerts
- Scheduled notifications
- Report generation
- Webhook delivery

---

## User Roles & Permissions

### Role Matrix

| Role | Scope | Access Level | Key Permissions |
|------|-------|--------------|-----------------|
| **SUPER_ADMIN** | Global | Full System | All operations, cross-OEM visibility, system configuration |
| **OEM_ADMIN** | OEM | OEM-wide | Manage dealerships, vehicles, view all metrics for their OEM |
| **DEALERSHIP_ADMIN** | Dealership | Dealership-wide | Manage showrooms, assign sales persons, pricing overrides |
| **SHOWROOM_MANAGER** | Showroom | Showroom-only | Create work orders, approve jobs, manage commissions |
| **SALES_PERSON** | Showroom | Read-only | View orders, track commissions/earnings |
| **PARTNER_ADMIN** | Partner | Partner-wide | Manage staff, job execution, partner settings |
| **PARTNER_STAFF** | Partner | Job-level | Execute jobs, upload proof, update status |

### Permission Details

#### SUPER_ADMIN
- ✅ Create/Edit/Delete OEMs
- ✅ Create/Edit/Delete Users (all roles)
- ✅ View all work orders across all OEMs
- ✅ Configure system settings
- ✅ Access audit logs
- ✅ Manage global pricing rules

#### OEM_ADMIN
- ✅ Manage dealerships within their OEM
- ✅ Manage vehicle models/variants
- ✅ View OEM-level reports and metrics
- ✅ Create OEM-level pricing rules
- ❌ Access other OEMs' data

#### DEALERSHIP_ADMIN
- ✅ Manage showrooms within their dealership
- ✅ Assign sales persons to showrooms
- ✅ Override pricing rules at dealership level
- ✅ View dealership-level reports
- ❌ Create work orders (done by Showroom Manager)

#### SHOWROOM_MANAGER
- ✅ Create work orders
- ✅ Approve/Reject job cards
- ✅ Request rework
- ✅ Manage showroom commissions
- ✅ View showroom metrics
- ❌ Assign partners (auto-assigned by system)

#### SALES_PERSON
- ✅ View work orders they're assigned to
- ✅ Track their commission earnings
- ❌ Create or modify work orders
- ❌ Access other sales persons' data

#### PARTNER_ADMIN
- ✅ View assigned job cards (across all OEMs they serve)
- ✅ Manage partner staff
- ✅ Acknowledge/Schedule/Start/Complete jobs
- ✅ Upload job proof
- ✅ View partner earnings/payouts
- ✅ Select OEM context for multi-OEM operations

#### PARTNER_STAFF
- ✅ View assigned jobs
- ✅ Execute jobs (start/complete)
- ✅ Upload proof of work
- ❌ Manage other staff
- ❌ View financial details (based on partner settings)

---

## Work Order Lifecycle

### Status Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WORK ORDER LIFECYCLE                          │
└─────────────────────────────────────────────────────────────────────┘

[START]
   │
   ├─► PENDING ──────────────► Created by system, not yet submitted
   │      │
   │      └─► DRAFT ─────────► Saved but not submitted
   │             │
   │             └─► SUBMITTED ──────────────────────────────────┐
   │                    │                                          │
   │                    └─► AUTO-ASSIGN PARTNER                   │
   │                           │                                   │
   ├──────────────────────────┴─► ASSIGNED ◄─────────────────────┘
   │                                  │
   │                                  ├─► Create Job Card (AWAITING_ACK)
   │                                  │
   │                                  └─► IN_PROGRESS (when job started)
   │                                         │
   │                                         └─► COMPLETED_PENDING_APPROVAL
   │                                                │
   │                                                ├─► APPROVED ──► CLOSED
   │                                                │
   │                                                └─► REWORK_REQUESTED
   │                                                       │
   │                                                       └─► Back to ASSIGNED
   │
   └─► CANCELLED (can happen at any stage before completion)

[END]
```

### Status Descriptions

| Status | Description | Who Can Set | Next Status |
|--------|-------------|-------------|-------------|
| **PENDING** | Initial state when work order is created | System | DRAFT, SUBMITTED |
| **DRAFT** | Saved but not finalized | Showroom Manager | SUBMITTED, CANCELLED |
| **SUBMITTED** | Ready for partner assignment | Showroom Manager | ASSIGNED |
| **ASSIGNED** | Partner allocated, job card created | System/Admin | IN_PROGRESS, CANCELLED |
| **IN_PROGRESS** | Partner has started work | Partner | COMPLETED_PENDING_APPROVAL |
| **COMPLETED_PENDING_APPROVAL** | Work done, awaiting approval | Partner | APPROVED, REWORK_REQUESTED |
| **APPROVED** | Work approved by showroom manager | Showroom Manager | CLOSED |
| **REWORK_REQUESTED** | Issues found, needs fixing | Showroom Manager | ASSIGNED |
| **CLOSED** | Final state, all processes complete | System | - |
| **CANCELLED** | Work order cancelled | Admin/Showroom Manager | - |

### Actions & Permissions

| Action | Allowed Roles | Required Status | Resulting Status |
|--------|---------------|-----------------|------------------|
| Create Work Order | Showroom Manager | - | PENDING/DRAFT |
| Submit Work Order | Showroom Manager | DRAFT/PENDING | SUBMITTED |
| Assign Partner (Manual) | Super Admin, OEM Admin, Dealership Admin | SUBMITTED | ASSIGNED |
| Auto-Assign Partner | System | SUBMITTED | ASSIGNED |
| Start Work | Partner | ASSIGNED (via Job Card) | IN_PROGRESS |
| Complete Work | Partner | IN_PROGRESS | COMPLETED_PENDING_APPROVAL |
| Approve Work | Showroom Manager | COMPLETED_PENDING_APPROVAL | APPROVED |
| Request Rework | Showroom Manager | COMPLETED_PENDING_APPROVAL | REWORK_REQUESTED |
| Close Work Order | System | APPROVED | CLOSED |
| Cancel Work Order | Admin, Showroom Manager | Any (except CLOSED) | CANCELLED |

---

## Job Card Lifecycle

### Status Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         JOB CARD LIFECYCLE                           │
└─────────────────────────────────────────────────────────────────────┘

[START: Work Order ASSIGNED]
   │
   ├─► AWAITING_ACK ─────► Created when partner assigned
   │      │                 (SLA: 2 hours to acknowledge)
   │      │
   │      └─► ACKNOWLEDGED ──► Partner confirms they can do the job
   │             │              (Timestamp: acknowledgedAt)
   │             │
   │             └─► SCHEDULED ──► Installation date/time set
   │                    │           (Timestamp: scheduledAt)
   │                    │
   │                    └─► IN_PROGRESS ──► Work started
   │                           │             (Timestamp: startedAt)
   │                           │             (Auto-creates detailer payout: pending_review)
   │                           │
   │                           └─► COMPLETED ──► Partner finished work
   │                                  │           (Upload proof, checklist)
   │                                  │           (Timestamp: completedAt)
   │                                  │
   │                                  └─► PENDING_APPROVAL ──► Awaiting review
   │                                         │                  (SLA: 24 hours)
   │                                         │
   │                                         ├─► APPROVED ──────┐
   │                                         │   (Update payout: due)  │
   │                                         │   (Update commission: COMPUTED)
   │                                         │                        │
   │                                         │                        ├─► PENDING_SALES_INVOICE
   │                                         │                        │
   │                                         │                        ├─► INVOICE_RAISED
   │                                         │                        │
   │                                         │                        ├─► WARRANTY_REGISTRATION
   │                                         │                        │
   │                                         │                        ├─► PAYMENT_PENDING
   │                                         │                        │
   │                                         │                        └─► CLOSED
   │                                         │
   │                                         ├─► REWORK_REQUESTED
   │                                         │   (Reason provided)
   │                                         │   (Timestamp: reworkRequestedAt)
   │                                         │
   │                                         └─► REJECTED
   │                                             (Permanent rejection)
   │
   ├─► NO_SHOW ──────────────► Customer didn't show up
   │
   ├─► CANCELLED_BY_CUSTOMER ► Customer cancelled
   │
   ├─► PARTS_PENDING ────────► Waiting for materials
   │
   └─► RESCHEDULED ──────────► Date changed

[END]
```

### Status Descriptions

| Status | Description | Who Can Set | Timestamp Field |
|--------|-------------|-------------|-----------------|
| **AWAITING_ACK** | Initial status, partner needs to acknowledge | System | createdAt |
| **ACKNOWLEDGED** | Partner confirmed they can do the job | Partner | acknowledgedAt |
| **SCHEDULED** | Installation date/time set | Partner | scheduledAt |
| **IN_PROGRESS** | Work has started | Partner | startedAt |
| **COMPLETED** | Work finished, proof uploaded | Partner | completedAt |
| **PENDING_APPROVAL** | Awaiting showroom manager review | System | approvalRequestedAt |
| **APPROVED** | Work approved, ready for invoicing | Showroom Manager | approvedAt |
| **PENDING_SALES_INVOICE** | Waiting for sales invoice | System | - |
| **INVOICE_RAISED** | Sales invoice created | System | - |
| **WARRANTY_REGISTRATION** | Warranty being processed | System | - |
| **PAYMENT_PENDING** | Awaiting payment settlement | System | - |
| **REWORK_REQUESTED** | Issues found, needs fixing | Showroom Manager | reworkRequestedAt |
| **REJECTED** | Work permanently rejected | Showroom Manager | rejectedAt |
| **CLOSED** | All processes complete | System | - |
| **NO_SHOW** | Customer didn't appear | Partner | - |
| **CANCELLED_BY_CUSTOMER** | Customer cancelled | Partner/Showroom Manager | - |
| **PARTS_PENDING** | Waiting for materials | Partner | - |
| **RESCHEDULED** | Date/time changed | Partner | - |

### Actions & Permissions

| Action | Allowed Roles | Required Status | Resulting Status | SLA |
|--------|---------------|-----------------|------------------|-----|
| Acknowledge | Partner Admin, Partner Staff | AWAITING_ACK | ACKNOWLEDGED | 2 hours |
| Schedule | Partner Admin, Partner Staff | ACKNOWLEDGED | SCHEDULED | - |
| Start Work | Partner Admin, Partner Staff | SCHEDULED | IN_PROGRESS | - |
| Complete | Partner Admin, Partner Staff | IN_PROGRESS | COMPLETED | - |
| Submit for Approval | System | COMPLETED | PENDING_APPROVAL | - |
| Approve | Showroom Manager | PENDING_APPROVAL | APPROVED | 24 hours |
| Reject | Showroom Manager | PENDING_APPROVAL | REJECTED | - |
| Request Rework | Showroom Manager | PENDING_APPROVAL | REWORK_REQUESTED | - |

### SLA Monitoring

| Event | SLA Duration | Alert Trigger | Who Gets Alerted |
|-------|--------------|---------------|------------------|
| Acknowledgment | 2 hours | After 2 hours | Partner Staff (SMS + Push) |
| Completion | Based on scheduled date | 1 hour before overdue | Partner Staff, Showroom Manager |
| Approval | 24 hours | After 24 hours | Showroom Manager |

---

## Partner Allocation System

### Allocation Logic Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PARTNER AUTO-ALLOCATION LOGIC                     │
└─────────────────────────────────────────────────────────────────────┘

Work Order Created (Service: PPF, Brand: STEK, Showroom: ABC Motors)
   │
   ├─► Get Service Details
   │   ├─► serviceCategoryId: "PPF"
   │   └─► productBrand: "STEK"
   │
   ├─► Find Suitable Partner
   │   │
   │   ├─► Priority 1: SHOWROOM-level allocations
   │   │   ├─► Filter by: showroomId + serviceCategoryId + brandId
   │   │   ├─► Filter by: partner.active = true
   │   │   ├─► Filter by: allocation.active = true
   │   │   └─► Sort by: allocation.priority ASC (1 = highest)
   │   │
   │   ├─► Priority 2: DEALERSHIP-level allocations (if no showroom match)
   │   │   ├─► Filter by: dealershipId + serviceCategoryId + brandId
   │   │   ├─► Filter by: partner.active = true
   │   │   ├─► Filter by: allocation.active = true
   │   │   └─► Sort by: allocation.priority ASC
   │   │
   │   └─► Priority 3: Basic allocation (no category/brand match)
   │        ├─► Filter by: showroomId OR dealershipId
   │        ├─► Filter by: partner.active = true
   │        ├─► Sort by: allocation.priority ASC
   │        └─► Pick first available
   │
   ├─► Partner Found?
   │   │
   │   ├─► YES
   │   │   ├─► Assign Work Order to Partner
   │   │   ├─► Create Job Card (status: AWAITING_ACK)
   │   │   ├─► Send Notifications (Email + WhatsApp)
   │   │   └─► Update Work Order status: ASSIGNED
   │   │
   │   └─► NO
   │       ├─► Log Warning: No suitable partner found
   │       └─► Work Order remains: SUBMITTED (manual assignment needed)
   │
   └─► [END]
```

### Allocation Table Structure

| Field | Description | Example |
|-------|-------------|---------|
| level | SHOWROOM or DEALERSHIP | SHOWROOM |
| levelId | UUID of showroom/dealership | "uuid-showroom-123" |
| partnerId | UUID of partner | "uuid-partner-456" |
| priority | Lower number = higher priority | 1, 2, 3... |
| partnerBillsDirectly | Partner bills customer directly | true/false |
| active | Allocation is active | true/false |

### Partner Service Category Mapping

Partners are mapped to service categories they can handle:
```
Partner: "Bangalore PPF Pro"
├─► Service Categories:
│   ├─► Paint Protection Film (PPF)
│   ├─► Ceramic Coating
│   └─► Window Tinting
└─► Brands:
    ├─► STEK (via allocation_brands)
    ├─► XPEL
    └─► 3M
```

### Example Allocation

**Scenario**: Showroom "ABC Motors" creates a work order for PPF installation with STEK brand

**Allocations in Database**:
1. **Showroom-level**: Bangalore PPF Pro (Priority: 1, Brand: STEK) ✅ **SELECTED**
2. **Showroom-level**: City Detailing Studio (Priority: 2, Brand: 3M)
3. **Dealership-level**: Premium Installers (Priority: 1, Brand: STEK)

**Result**: Work order assigned to "Bangalore PPF Pro" because:
- Showroom-level match (highest priority)
- Has PPF service category
- Has STEK brand mapping
- Priority 1 (highest)

---

## Pricing & Billing System

### Pricing Types

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRICING HIERARCHY                            │
└─────────────────────────────────────────────────────────────────────┘

1. DEALERSHIP_PRICING
   ├─► What: Amount dealership is charged
   ├─► Scope: Dealership + Service + Vehicle Model
   ├─► Used For: Work order billing value
   └─► Example: Toyota Dealership charged ₹25,000 for Fortuner PPF

2. PARTNER_PRICING
   ├─► What: Amount partner charges for the job
   ├─► Scope: Partner + Showroom/Dealership + Service + Vehicle Model
   ├─► Used For: Partner invoicing
   └─► Example: Bangalore PPF Pro charges ₹22,000 for installation

3. DETAILER_PRICING (Payout)
   ├─► What: Amount detailer/installer earns
   ├─► Scope: Partner/Detailer + Service Category (no vehicle model)
   ├─► Used For: Job card payout calculation
   └─► Example: Installer earns ₹12,000 for any PPF job
```

### Pricing Resolution Logic

#### 1. Dealership Pricing (Work Order Billing)

```
Work Order Created
   │
   ├─► Calculate Billing Amount
   │   │
   │   └─► Find DEALERSHIP_PRICING Rule
   │       ├─► Match: dealershipId + serviceId + vehicleModelId
   │       ├─► Status: ACTIVE
   │       └─► Effective Date: within range
   │
   ├─► Rule Found?
   │   ├─► YES: Use rule.priceAmount × quantity
   │   └─► NO: Return ₹0 (no price found)
   │
   └─► Set work order.estimatedPrice
```

#### 2. Partner Pricing (Partner Invoice)

```
Calculate Partner Charges
   │
   ├─► Priority 1: Partner + Showroom + Vehicle Model + Service
   ├─► Priority 2: Partner + Showroom + Service (any vehicle)
   ├─► Priority 3: Partner + Dealership + Vehicle Model + Service
   ├─► Priority 4: Partner + Dealership + Service (any vehicle)
   └─► Priority 5: No rule found → Error
```

#### 3. Detailer Payout Pricing

```
Job Card Approved
   │
   ├─► Calculate Detailer Payout
   │   │
   │   └─► Find DETAILER_PRICING Rule
   │       │
   │       ├─► Priority 1: partnerId/detailerId + serviceCategoryId + vehicleModelId
   │       ├─► Priority 2: partnerId/detailerId + serviceCategoryId (any vehicle) ✅
   │       └─► Priority 3: serviceCategoryId only (global rate)
   │
   ├─► Rule Found?
   │   ├─► YES: Set payout amount, status = 'due'
   │   └─► NO: Set payout = ₹0, status = 'pending_review'
   │
   └─► Update payout record
```

**Note**: Detailer pricing uses BOTH `partnerId` and `detailerId` fields for lookup (they reference the same partner, just different use cases).

### Billing Details Calculation

```
┌─────────────────────────────────────────────────────────────────────┐
│                      BILLING DETAILS LOGIC                           │
└─────────────────────────────────────────────────────────────────────┘

Calculate Billing (Job Card Approval)
   │
   ├─► BILL FROM (Who issues invoice?)
   │   │
   │   ├─► Check: Partner bills directly?
   │   │   │
   │   │   ├─► YES: Use Partner's billing address
   │   │   └─► NO: Use default (Plus Nine One Inc)
   │   │
   │   └─► Priority Check:
   │       ├─► 1. Showroom-level allocation (partnerBillsDirectly = true)
   │       ├─► 2. Dealership-level allocation (partnerBillsDirectly = true)
   │       └─► 3. Default billing entity
   │
   ├─► BILL TO (Who receives invoice?)
   │   │
   │   └─► Hierarchy (first non-null wins):
   │       ├─► 1. OEM billing address (if billJobsDirectlyToOem = true)
   │       ├─► 2. Dealership billing address
   │       └─► 3. Showroom address
   │
   └─► SHIP TO (Where is vehicle?)
       │
       └─► Always: Showroom address
```

### Pricing Rule Fields

| Field | Description | Example |
|-------|-------------|---------|
| pricingType | DEALERSHIP_PRICING / PARTNER_PRICING / DETAILER_PRICING | DETAILER_PRICING |
| dealershipId | For dealership pricing | "uuid-dealership" |
| partnerId | For partner pricing | "uuid-partner" |
| detailerId | For detailer payout | "uuid-partner" |
| serviceId | Specific service (optional) | "uuid-service-ppf-full" |
| serviceCategoryId | Service category (for detailer) | "uuid-category-ppf" |
| vehicleModelId | Specific vehicle (optional) | "uuid-model-fortuner" |
| priceAmount | Price in INR | "12000.00" |
| effectiveFrom | Rule valid from date | 2025-01-01 |
| effectiveTo | Rule valid until (null = forever) | null |
| status | ACTIVE / INACTIVE | ACTIVE |

---

## Commission System

### Commission Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      COMMISSION LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────────┘

Work Order Created (with salesPersonId)
   │
   ├─► Trigger Commission Creation
   │   │
   │   └─► Find Commission Rule
   │       │
   │       ├─► Priority 1: Showroom + SalesPerson + ServiceCategory
   │       ├─► Priority 2: Showroom + SalesPerson
   │       ├─► Priority 3: Showroom + ServiceCategory
   │       ├─► Priority 4: Dealership + SalesPerson + ServiceCategory
   │       ├─► Priority 5: Dealership + SalesPerson
   │       ├─► Priority 6: Dealership + ServiceCategory
   │       ├─► Priority 7: OEM + ServiceCategory
   │       └─► Priority 8: OEM + SalesPerson
   │
   ├─► Rule Found?
   │   │
   │   ├─► YES
   │   │   ├─► Calculate Commission
   │   │   │   │
   │   │   │   ├─► If type = PERCENT:
   │   │   │   │   └─► amount = (orderValue × percentage) / 100
   │   │   │   │
   │   │   │   └─► If type = AMOUNT:
   │   │   │       └─► amount = fixed amount
   │   │   │
   │   │   ├─► Apply Floor (minimum)
   │   │   │   └─► if amount < floor: amount = floor
   │   │   │
   │   │   ├─► Apply Cap (maximum)
   │   │   │   └─► if amount > cap: amount = cap
   │   │   │
   │   │   └─► Create Commission Record
   │   │       ├─► workOrderId
   │   │       ├─► salesPersonId
   │   │       ├─► basis: rule.type
   │   │       ├─► value: rule.valueNumeric
   │   │       ├─► computedAmount: calculated amount
   │   │       └─► status: PENDING
   │   │
   │   └─► NO
   │       └─► Log: No commission rule found
   │
   └─► Commission Created: status = PENDING

───────────────────────────────────────────────────────────────

Job Card Approved
   │
   ├─► Update Commission
   │   │
   │   ├─► Recalculate with FINAL price
   │   ├─► Set computedAmount = final amount
   │   └─► Set status = COMPUTED
   │
   └─► Commission Updated: status = COMPUTED

───────────────────────────────────────────────────────────────

Commission Settlement (Manual)
   │
   ├─► Admin Settles Commission
   │   │
   │   ├─► Set status = PAID
   │   ├─► Set paidAt = current timestamp
   │   ├─► Set paymentReference
   │   ├─► Set settledBy = admin user id
   │   └─► Set settledAt = current timestamp
   │
   └─► Commission Paid: status = PAID

[END]
```

### Commission Rule Structure

| Field | Description | Example |
|-------|-------------|---------|
| oemId | OEM-level rule | "uuid-oem" |
| dealershipId | Dealership-level rule | "uuid-dealership" |
| showroomId | Showroom-level rule | "uuid-showroom" |
| salesPersonId | Specific sales person | "uuid-salesperson" |
| serviceId | Specific service | "uuid-service" |
| serviceCategoryId | Service category | "uuid-category" |
| type | PERCENT or AMOUNT | PERCENT |
| valueNumeric | Percentage or fixed amount | 5.00 (5%) or 500.00 (₹500) |
| floorAmount | Minimum commission | 500.00 |
| capAmount | Maximum commission | 2000.00 |
| effectiveFrom | Rule valid from | 2025-01-01 |
| effectiveTo | Rule valid until | null |
| status | ACTIVE / INACTIVE | ACTIVE |

### Commission Statuses

| Status | Description | Set By | When |
|--------|-------------|--------|------|
| **PENDING** | Commission created but not finalized | System | Work order creation (with estimated price) |
| **COMPUTED** | Final amount calculated | System | Job card approval (with actual price) |
| **PAID** | Commission settled to sales person | Admin | Manual settlement |

### Example Calculation

**Work Order**: ₹25,000 (estimated)  
**Commission Rule**: 
- Type: PERCENT
- Value: 5%
- Floor: ₹500
- Cap: ₹2,000

**At Work Order Creation**:
- Calculated: ₹25,000 × 5% = ₹1,250
- Apply Floor: max(₹1,250, ₹500) = ₹1,250
- Apply Cap: min(₹1,250, ₹2,000) = ₹1,250
- Status: PENDING
- Amount: ₹1,250

**At Job Card Approval** (actual price: ₹27,000):
- Recalculated: ₹27,000 × 5% = ₹1,350
- Apply Floor: max(₹1,350, ₹500) = ₹1,350
- Apply Cap: min(₹1,350, ₹2,000) = ₹1,350
- Status: COMPUTED
- Amount: ₹1,350 ✅ FINAL

---

## Payout System

### Payout Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PAYOUT LIFECYCLE                             │
└─────────────────────────────────────────────────────────────────────┘

Job Card Started (status: IN_PROGRESS)
   │
   ├─► Auto-Create Detailer Payout
   │   │
   │   └─► Create Payout Record
   │       ├─► jobCardId
   │       ├─► partnerId
   │       ├─► grossAmount: ₹0.00
   │       ├─► netAmount: ₹0.00
   │       └─► status: pending_review
   │
   └─► Payout Created: status = pending_review

───────────────────────────────────────────────────────────────

Job Card Approved
   │
   ├─► Calculate Detailer Payout
   │   │
   │   └─► Resolve DETAILER_PRICING Rule
   │       │
   │       ├─► Priority 1: detailerId + serviceCategoryId + vehicleModelId
   │       ├─► Priority 2: detailerId + serviceCategoryId (any vehicle) ✅
   │       └─► Priority 3: serviceCategoryId only (global)
   │
   ├─► Rule Found?
   │   │
   │   ├─► YES
   │   │   ├─► Update Payout
   │   │   │   ├─► grossAmount = rule.priceAmount
   │   │   │   ├─► netAmount = rule.priceAmount (no deductions yet)
   │   │   │   └─► status = due
   │   │   │
   │   │   └─► Payout Updated: status = due, amount = ₹12,000
   │   │
   │   └─► NO
   │       ├─► Update Payout
   │       │   ├─► grossAmount = ₹0.00
   │       │   ├─► netAmount = ₹0.00
   │       │   └─► status = pending_review (needs manual pricing)
   │       │
   │       └─► Payout Updated: status = pending_review, amount = ₹0

───────────────────────────────────────────────────────────────

Payout Settlement (Manual)
   │
   ├─► Admin Reviews Payouts
   │   ├─► Filter: status = 'due' OR 'pending_review'
   │   └─► Select payouts to settle
   │
   ├─► Process Payment
   │   ├─► Set status = paid
   │   ├─► Set paidAt = current timestamp
   │   ├─► Set paymentReference
   │   └─► Set settledBy = admin user id
   │
   └─► Payout Paid: status = paid

[END]
```

### Payout Statuses

| Status | Description | Display In Settlement | When Set |
|--------|-------------|----------------------|----------|
| **pending_review** | No pricing rule found, needs manual review | ✅ YES | Job card started (if no pricing found) |
| **due** | Amount calculated, ready for payment | ✅ YES | Job card approved (pricing found) |
| **paid** | Payment settled to partner | ❌ NO | Manual settlement |

### Important Notes

1. **Payout remains visible** in settlement screen even after job card moves to:
   - PENDING_SALES_INVOICE
   - INVOICE_RAISED
   - WARRANTY_REGISTRATION
   - PAYMENT_PENDING
   - CLOSED

2. **Payout is removed** from settlement screen only when:
   - Payout status changes to `paid`

3. **Pricing Lookup**: System checks BOTH `partnerId` and `detailerId` fields in pricing rules
   - This allows detailers (who are partners with type=INSTALLER) to get paid correctly

---

## Notification System

### Notification Matrix

| Event | Email | WhatsApp | SMS | Push | Recipients |
|-------|-------|----------|-----|------|------------|
| **Work Order Created** | ✅ | ❌ | ❌ | ❌ | Stakeholders (OEM Admin, Dealership Admin, Showroom Manager) |
| **Work Order Submitted** | ✅ | ❌ | ❌ | ❌ | Admins (OEM Admin, Dealership Admin) |
| **Work Order Assigned** | ❌ | ❌ | ✅ | ✅ | Partner Admin, Partner Staff |
| **Job Card Created** | ✅ | ✅ | ❌ | ❌ | Partner Admin, Partner Staff |
| **Job Card Acknowledged** | ❌ | ❌ | ❌ | ✅ | Showroom Manager |
| **Job Card Scheduled** | ✅ | ❌ | ❌ | ❌ | Showroom Manager |
| **Job Card Started** | ❌ | ❌ | ❌ | ✅ | Showroom Manager |
| **Job Card Completed** | ❌ | ✅ | ❌ | ❌ | Order Placer (Showroom Manager) |
| **Job Card Pending Approval** | ❌ | ✅ | ❌ | ❌ | Order Placer (Showroom Manager) |
| **Job Card Approved** | ✅ | ✅ | ❌ | ❌ | Partner Admin, Partner Staff |
| **Job Card Rejected** | ✅ | ✅ | ❌ | ❌ | Partner Admin, Partner Staff |
| **Rework Requested** | ✅ | ❌ | ❌ | ❌ | Partner Staff |
| **SLA Breach (Acknowledgment)** | ❌ | ❌ | ✅ | ✅ | Partner Staff |
| **SLA Breach (Completion)** | ❌ | ❌ | ✅ | ✅ | Partner Staff, Showroom Manager |
| **SLA Breach (Approval)** | ❌ | ❌ | ❌ | ✅ | Showroom Manager |
| **Payout Processed** | ✅ | ❌ | ❌ | ❌ | Partner Admin |
| **Commission Earned** | ✅ | ❌ | ❌ | ❌ | Sales Person |

### WhatsApp Templates (Meta WABA)

All templates are approved by Meta and use the business account:
- **Phone Number ID**: 633152823218797
- **Business Account ID**: 681013564674244

| Template Name | Language | Event | Parameters |
|--------------|----------|-------|------------|
| `job_card_created` | en_IN | Job Card Created | Partner Name, Job ID, Vehicle, Location, Service, Link |
| `job_card_pending_approval` | en_IN | Job Completed | User Name, Job ID, Vehicle, Partner Name, Link |
| `job_card_approved` | en | Job Approved | Partner Name, Job ID, Vehicle, Payout Amount, Link |
| `job_card_rejected` | en | Job Rejected | Partner Name, Job ID, Vehicle, Reason, Link |
| `job_card_completed` | en | Job Completed | User Name, Job ID, Vehicle, Partner Name, Link |

### Email Service Configuration

**Current Setup**: SMTP Only (AWS SES disabled for performance)
- **Provider**: Configured SMTP (via environment variables)
- **Performance**: 80% faster than previous AWS SES setup
- **Reason**: AWS SES credentials were invalid, causing 10-15 second timeout on every email

**Email Features**:
- ✅ Embedded logo (base64, 69KB PNG)
- ✅ Professional gradient backgrounds
- ✅ Dynamic "From" email based on brand
- ✅ Dynamic production URLs (www.pulsevas.p91india.com)
- ✅ Branded action buttons (CTA)

**Email Templates**:
1. Work Order Created
2. Work Order Updated
3. Work Order Completed
4. Job Card Created
5. Job Card Approved
6. Password Reset
7. OTP Verification
8. Welcome Email (user activation)

---

## Database Schema

### Core Tables

#### Organization Hierarchy
```
oems (OEM/Brand)
├─► dealerships
│   └─► dealership_oem_mapping (many-to-many)
└─► showrooms
```

#### User Management
```
users
├─► role: userRoleEnum
├─► oemId (for OEM_ADMIN)
├─► dealershipId (for DEALERSHIP_ADMIN)
├─► showroomId (for SHOWROOM_MANAGER, SALES_PERSON)
└─► partnerId (for PARTNER_ADMIN, PARTNER_STAFF)
```

#### Partner Management
```
partners
├─► type: partnerTypeEnum (STUDIO, INSTALLER)
├─► partner_members (users belonging to partner)
├─► partner_oems (multi-OEM access)
├─► partner_showroom_mapping (partner-showroom relationship)
├─► allocations (priority-based assignment)
└─► allocation_brands (brand-specific allocations)
```

#### Service Catalog
```
service_categories (dynamic categories)
├─► name: "Paint Protection Film"
└─► code: "PPF"

services
├─► serviceCategoryId → service_categories
├─► productBrand: "STEK", "XPEL", "3M"
└─► service_raw_materials → raw_materials (many-to-many)

brands (WhatsApp/Email branding)
├─► wabaPhoneNumberId
├─► wabaBusinessAccountId
└─► whatsapp_templates (brand-specific templates)

raw_materials
└─► brandId → brands
```

#### Vehicles
```
vehicle_models
├─► oemId → oems
└─► vehicleType: vehicleTypeEnum

vehicle_variants
├─► modelId → vehicle_models
├─► variantName: "Fortuner 2.7 AT"
└─► materialConsumption: jsonb (PPF material usage)
```

#### Pricing & Commission
```
pricing_rules
├─► pricingType: DEALERSHIP_PRICING | PARTNER_PRICING | DETAILER_PRICING
├─► dealershipId (for DEALERSHIP_PRICING)
├─► partnerId (for PARTNER_PRICING)
├─► detailerId (for DETAILER_PRICING)
├─► serviceId (specific service)
├─► serviceCategoryId (for DETAILER_PRICING)
├─► vehicleModelId (optional)
└─► priceAmount: decimal

commission_rules
├─► oemId / dealershipId / showroomId (hierarchy)
├─► salesPersonId (optional)
├─► serviceId / serviceCategoryId (optional)
├─► type: PERCENT | AMOUNT
├─► valueNumeric: decimal
├─► floorAmount: decimal (min commission)
└─► capAmount: decimal (max commission)
```

#### Work Execution
```
work_orders
├─► status: workOrderStatusEnum
├─► oemId → oems
├─► dealershipId → dealerships
├─► showroomId → showrooms
├─► serviceId → services
├─► vehicleModelId → vehicle_models
├─► salesPersonId → sales_persons
├─► estimatedPrice: decimal (DEALERSHIP_PRICING)
├─► billingDetails: jsonb
└─► createdByUserId → users

job_cards
├─► workOrderId → work_orders
├─► partnerId → partners
├─► status: jobCardStatusEnum
├─► acknowledgedAt: timestamp
├─► scheduledAt: timestamp
├─► startedAt: timestamp
├─► completedAt: timestamp
├─► approvedAt: timestamp
├─► checklistJson: jsonb
├─► materialConsumptionJson: jsonb
└─► batchNumbers: jsonb

job_card_media (proof uploads)
├─► jobCardId → job_cards
├─► category: "BEFORE" | "DURING" | "AFTER"
├─► mediaType: "IMAGE" | "VIDEO"
└─► filePath: text
```

#### Financial Records
```
payouts
├─► jobCardId → job_cards
├─► partnerId → partners
├─► grossAmount: decimal
├─► netAmount: decimal
├─► status: 'pending_review' | 'due' | 'paid'
├─► paidAt: timestamp
└─► paymentReference: text

commissions
├─► workOrderId → work_orders
├─► salesPersonId → sales_persons
├─► basis: text (PERCENT/AMOUNT)
├─► value: decimal
├─► computedAmount: decimal
├─► status: 'PENDING' | 'COMPUTED' | 'PAID'
├─► paidAt: timestamp
└─► settledBy → users

oem_royalty_rules
├─► oemId → oems
├─► serviceCategoryId → service_categories
└─► royaltyPercentage: decimal

oem_royalty_calculations
├─► workOrderId → work_orders
├─► oemId → oems
├─► jobCardGrossValue: decimal
├─► royaltyAmount: decimal
└─► calculatedAt: timestamp
```

#### Audit & System
```
audit_logs
├─► userId → users
├─► action: text
├─► entityType: text
├─► entityId: text
├─► changes: jsonb
└─► timestamp: timestamp

webhook_subscriptions
├─► url: text
├─► events: text[]
└─► active: boolean

idempotency_keys
├─► key: text (unique)
├─► response: jsonb
└─► expiresAt: timestamp
```

### Key Relationships

```
OEM → Dealerships (1:many)
OEM → Showrooms (1:many via Dealerships)
Dealership → Showrooms (1:many)
Showroom → Work Orders (1:many)
Work Order → Job Cards (1:1)
Partner → Job Cards (1:many)
Service → Service Category (many:1)
Service → Raw Materials (many:many)
Partner → Service Categories (many:many via partner_service_categories)
Partner → Brands (many:many via allocation_brands)
```

---

## Integration Points

### 1. Pulse Master Portal Integration

**Purpose**: Centralized user access control for partner users

**Webhook Endpoint**: `POST /api/webhooks/pulse/user-access`

**Authentication**: HMAC-SHA256 signature verification
- Secret: `PULSE_WEBHOOK_SECRET`
- Header: `X-Pulse-Signature`
- Timestamp validation (within 5 minutes)

**Supported Actions**:
- **Activate User**: Creates/activates PARTNER_ADMIN or PARTNER_STAFF
- **Deactivate User**: Marks user as inactive

**Payload Example**:
```json
{
  "action": "activate",
  "user": {
    "email": "installer@partner.com",
    "name": "John Doe",
    "phone": "+919876543210",
    "role": "PARTNER_STAFF",
    "partnerId": "uuid-partner-123"
  },
  "timestamp": "2025-10-24T10:30:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "userId": "uuid-user-456",
  "message": "User activated successfully"
}
```

**Features**:
- ✅ Duplicate user check (email/phone)
- ✅ Auto-generates secure random password
- ✅ Sends welcome email with password reset link
- ✅ Audit logging
- ✅ Timestamp validation (prevents replay attacks)

### 2. WhatsApp Business API (Meta WABA)

**Provider**: Meta (Facebook)  
**Configuration**:
- Phone Number ID: 633152823218797
- Business Account ID: 681013564674244
- Access Token: ENV `META_WABA_ACCESS_TOKEN`

**Endpoint**: `https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/messages`

**Features**:
- ✅ Brand-specific phone numbers (via brands table)
- ✅ Template-based messaging (5 approved templates)
- ✅ Dynamic parameter insertion
- ✅ Message delivery tracking
- ✅ Phone number formatting (+91XXXXXXXXXX)

**Rate Limits**: Managed by Meta (typically 1000 msg/day for verified businesses)

### 3. Email Service (SMTP)

**Current Provider**: Configured SMTP  
**Previous**: AWS SES (disabled due to invalid credentials causing 10-15s delays)

**Configuration**:
- Host: `email-smtp.{region}.amazonaws.com`
- Port: 587 (TLS)
- Auth: Username/Password from environment

**Features**:
- ✅ Dynamic "From" email (brand-specific)
- ✅ Template engine with variable substitution
- ✅ Embedded logo (base64)
- ✅ Professional HTML templates
- ✅ Fallback to text-only if HTML fails

**Performance Improvement**: 80% faster (3-5 seconds vs 20 seconds for work order creation)

### 4. Google Cloud Storage (Object Storage)

**Purpose**: File uploads (job card media, documents)

**Configuration**:
- Bucket: Auto-created via Replit integration
- Directories:
  - `public/`: Public assets
  - `.private/`: User uploads (job card media)

**Access**:
- Public files: Direct URL access
- Private files: Signed URLs (temporary access)

**Environment Variables**:
- `PUBLIC_OBJECT_SEARCH_PATHS`
- `PRIVATE_OBJECT_DIR`

### 5. Background Job Processing (BullMQ + Redis)

**Purpose**: Asynchronous task execution

**Queues**:
1. **SLA Monitoring Queue**
   - Checks for overdue acknowledgments
   - Checks for overdue completions
   - Checks for overdue approvals
   - Sends alerts via SMS + Push

2. **Notification Queue**
   - Email delivery
   - WhatsApp message sending
   - SMS delivery

3. **Webhook Queue**
   - Outbound webhook delivery
   - Retry logic

4. **Report Generation Queue**
   - Monthly reports
   - Financial summaries
   - Analytics exports

**Configuration**:
- Redis connection from environment
- Job retry: 3 attempts with exponential backoff
- Job timeout: 30 seconds

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/login` - User login (with OEM selection for partners)
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Reset password with token

### Work Orders
- `GET /api/work-orders` - List work orders (filtered by user role)
- `GET /api/work-orders/:id` - Get work order details
- `POST /api/work-orders` - Create work order
- `PUT /api/work-orders/:id` - Update work order
- `POST /api/work-orders/:id/submit` - Submit for assignment
- `POST /api/work-orders/:id/assign` - Manual partner assignment
- `DELETE /api/work-orders/:id` - Cancel work order

### Job Cards
- `GET /api/job-cards` - List job cards (filtered by partner/showroom)
- `GET /api/job-cards/:id` - Get job card details
- `POST /api/job-cards/:id/acknowledge` - Partner acknowledges job
- `POST /api/job-cards/:id/schedule` - Schedule installation
- `POST /api/job-cards/:id/start` - Start work
- `POST /api/job-cards/:id/complete` - Complete work (upload proof)
- `POST /api/job-cards/:id/approve` - Approve work
- `POST /api/job-cards/:id/reject` - Reject work
- `POST /api/job-cards/:id/request-rework` - Request rework
- `POST /api/job-cards/:id/media` - Upload media (before/during/after)

### Pricing & Commission
- `GET /api/pricing-rules` - List pricing rules
- `POST /api/pricing-rules` - Create pricing rule
- `PUT /api/pricing-rules/:id` - Update pricing rule
- `DELETE /api/pricing-rules/:id` - Delete pricing rule
- `GET /api/commission-rules` - List commission rules
- `POST /api/commission-rules` - Create commission rule
- `PUT /api/commission-rules/:id` - Update commission rule

### Payouts & Commissions
- `GET /api/payouts` - List payouts (pending settlement)
- `POST /api/payouts/:id/settle` - Mark payout as paid
- `GET /api/commissions` - List commissions
- `POST /api/commissions/:id/settle` - Mark commission as paid

### Partners & Allocations
- `GET /api/partners` - List partners
- `GET /api/partners/:id` - Get partner details
- `POST /api/partners` - Create partner
- `PUT /api/partners/:id` - Update partner
- `GET /api/allocations` - List allocations
- `POST /api/allocations` - Create allocation
- `PUT /api/allocations/:id` - Update allocation

### Services & Catalog
- `GET /api/services` - List services
- `GET /api/service-categories` - List service categories
- `POST /api/services` - Create service
- `PUT /api/services/:id` - Update service
- `GET /api/vehicle-models` - List vehicle models
- `GET /api/vehicle-variants` - List vehicle variants

### Users & Organization
- `GET /api/users` - List users (role-filtered)
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `GET /api/oems` - List OEMs
- `GET /api/dealerships` - List dealerships
- `GET /api/showrooms` - List showrooms

### Webhooks
- `POST /api/webhooks/pulse/user-access` - Pulse integration webhook

---

## Performance Optimizations

### Recent Improvements

1. **Email Service Optimization** (October 24, 2025)
   - **Issue**: AWS SES credentials invalid, causing 10-15 second timeout on every email
   - **Solution**: Disabled AWS SES SDK, use SMTP directly
   - **Result**: 80% faster work order creation (3-5 seconds vs 20 seconds)

2. **Service Category Migration**
   - **Issue**: Frontend saving to legacy `serviceGroup` enum field instead of new `serviceCategoryId` UUID
   - **Solution**: Updated CreateServiceModal and EditServiceModal to save category.id
   - **Result**: Proper service categorization, accurate detailer payout pricing

3. **Detailer Payout Pricing**
   - **Issue**: Pricing lookup only checking `partnerId`, not `detailerId`
   - **Solution**: Check BOTH fields in pricing resolution
   - **Result**: Detailers (INSTALLER type partners) now get correct payouts

### Database Indexes

**High-Performance Queries**:
- `work_orders`: Index on (oemId, showroomId, status)
- `job_cards`: Index on (partnerId, status)
- `users`: Unique index on email
- `pricing_rules`: Composite index on (pricingType, dealershipId, serviceId, vehicleModelId)
- `allocations`: Composite index on (level, levelId, partnerId, priority)

---

## Security Measures

### Authentication & Authorization
- ✅ JWT-based authentication (stateless)
- ✅ Password hashing with bcryptjs (10 rounds)
- ✅ Role-based access control (RBAC)
- ✅ Tenant isolation at OEM level
- ✅ API endpoint protection with middleware

### Data Security
- ✅ SQL injection prevention (parameterized queries via Drizzle ORM)
- ✅ Input validation with Zod schemas
- ✅ XSS protection (React auto-escaping)
- ✅ CORS configuration for production
- ✅ Sensitive data encryption at rest

### Webhook Security
- ✅ HMAC-SHA256 signature verification
- ✅ Timestamp validation (5-minute window)
- ✅ Replay attack prevention
- ✅ IP whitelisting (optional)

### File Upload Security
- ✅ File type validation
- ✅ File size limits (10MB for images)
- ✅ Malware scanning (via cloud provider)
- ✅ Private bucket ACLs
- ✅ Signed URLs for temporary access

---

## SLA Configuration

### Job Card SLAs

| Metric | Duration | Alert Trigger | Recipients |
|--------|----------|---------------|------------|
| Acknowledgment | 2 hours | After 2 hours | Partner Staff (SMS + Push) |
| Completion | Scheduled date + 2 hours | 1 hour before overdue | Partner Staff, Showroom Manager |
| Approval | 24 hours | After 24 hours | Showroom Manager |

### Monitoring
- Background job checks every 15 minutes
- Alerts sent immediately when SLA breached
- Escalation to higher roles if not resolved

---

## Deployment & Environment

### Environment Variables

**Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `PRODUCTION_URL` - Production frontend URL

**Optional**:
- `META_WABA_ACCESS_TOKEN` - WhatsApp API token
- `META_WABA_PHONE_NUMBER_ID` - WhatsApp phone number
- `META_WABA_BUSINESS_ACCOUNT_ID` - WhatsApp business account
- `PULSE_WEBHOOK_SECRET` - Pulse integration webhook secret
- `PUBLIC_OBJECT_SEARCH_PATHS` - Object storage public paths
- `PRIVATE_OBJECT_DIR` - Object storage private directory

**Email (SMTP)**:
- `SES_SMTP_USERNAME` - SMTP username
- `SES_SMTP_PASSWORD` - SMTP password
- `AWS_REGION` - AWS region (default: ap-south-1)

### Production Deployment

**Platform**: Replit (current)
**URL**: https://www.pulsevas.p91india.com

**Database**: PostgreSQL (Neon-backed via Replit)
**File Storage**: Google Cloud Storage (via Replit Object Storage)
**Background Jobs**: Redis (via Replit)

**Deployment Command**: `npm run dev` (production)
**Build Process**: Vite bundling for frontend

---

## Future Enhancements

### Planned Features
1. **Mobile App**: Native iOS/Android apps for partners
2. **Advanced Analytics**: Real-time dashboards with charts
3. **Automated Invoicing**: Direct integration with accounting systems
4. **Inventory Management**: Track PPF material stock levels
5. **Customer Portal**: Allow customers to track their orders
6. **Multi-Language Support**: Regional language support
7. **Advanced Reporting**: Custom report builder
8. **Payment Gateway Integration**: Online payment processing

### Technical Improvements
1. **Real-time Updates**: WebSocket for live status changes
2. **Offline Support**: PWA with offline job card management
3. **Performance**: Database query optimization with materialized views
4. **Scalability**: Microservices architecture for high-traffic modules
5. **Testing**: Comprehensive unit and integration tests
6. **CI/CD**: Automated deployment pipeline

---

## Support & Contact

**System Name**: Pulse VAS  
**Version**: 1.0  
**Last Updated**: October 24, 2025

**Technical Support**:
- Platform: Replit Agent
- Documentation: This file (SYSTEM_DOCUMENTATION.md)

**Data Model**: See `shared/schema.ts` for complete database schema  
**API Spec**: See `openapi.yaml` for API documentation

---

**End of Documentation**
