# Pulse VAS - PPF Installation Management Portal

A comprehensive multi-tenant web application for managing Paint Protection Film (PPF) installation orders across Vehicle OEMs, dealerships, showrooms, and installation partners with complete workflow automation, pricing management, and commission tracking.

## What is Pulse VAS?

Pulse VAS connects vehicle manufacturers (OEMs), car dealerships, showrooms, and installation partners in a unified workflow system. It manages the full lifecycle of PPF installation orders: a showroom creates a work order, a partner is assigned, the partner completes the job with photo proof, it gets approved, and everyone gets paid.

---

## Features

### Core Functionality
- **Multi-tenant Architecture**: Complete OEM-level data isolation with role-based access control
- **Work Order Management**: Full lifecycle with draft-submit workflow, manual partner allocation, and cancellation
- **Job Card Tracking**: Real-time status tracking with SLA monitoring and notifications
- **Partner Management**: Priority-based auto-assignment with manual overrides
- **Pricing Engine**: 4-layer hierarchical pricing (OEM, Dealership, Partner, Detailer)
- **Commission System**: Automated calculations with percentages/fixed amounts, caps, and floors
- **Payout Settlement**: Automated detailer payout calculations with bulk recalculation
- **Billing System**: "Bill From" / "Bill To" / "Ship To" logic with hierarchical rules
- **File Management**: Secure photo uploads with signed URLs and client-side image compression
- **Audit Trail**: Complete activity logging and timeline views
- **Dashboard Analytics**: Role-specific dashboards with KPIs and charts
- **Knowledge Hub**: Resource repository for partners

### User Roles (10 total)
- **Super Admin**: Global access to all resources and settings
- **Admin**: Full read/write access, cannot delete anything
- **Manager**: State-based read-only access, can create work orders and sales persons only
- **OEM Admin**: Manages dealerships, brand vehicles, and metrics for their OEM
- **Dealership Admin**: Manages showrooms, assigns sales persons, pricing overrides
- **Showroom Manager**: Raises work orders, approvals, commission settings
- **Sales Person**: Creates work orders, views commissions
- **Partner Admin**: Manages partner staff, job cards, payouts
- **Partner Staff**: Views assigned job cards, updates status, uploads photos

---

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS v3 with Shadcn UI components (Radix UI primitives)
- **State Management**: TanStack React Query v5 for server state
- **Forms**: React Hook Form with Zod validation
- **Routing**: Wouter
- **Charts**: Recharts
- **Icons**: Lucide React
- **Animation**: Framer Motion

### Backend
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL via Neon (serverless), Drizzle ORM
- **Authentication**: JWT tokens (jsonwebtoken), bcryptjs password hashing
- **Validation**: Zod schemas with drizzle-zod
- **File Storage**: Google Cloud Storage via Replit Object Storage
- **Background Jobs**: BullMQ with Redis 7+
- **Session**: connect-pg-simple (PostgreSQL session store)

### External Integrations
- **WhatsApp**: Meta WhatsApp Business API (WABA) for job lifecycle notifications
- **Email**: Hybrid AWS SES SDK + Nodemailer SMTP
- **SMS**: SMS OTP service
- **Pulse Webhook**: Inbound webhook for partner/user activation/deactivation (HMAC-SHA256 verified)
- **Google Analytics**: GA4 page tracking

### Infrastructure
- **Database**: PostgreSQL 15+
- **Cache/Queue**: Redis 7+
- **File Storage**: Google Cloud Storage (via Replit Object Storage)
- **Runtime**: Node.js 18+

---

## Architecture

The app is a full-stack monolith with a single Express server serving both the API and frontend:

```
┌─────────────────────────────────────────┐
│           Express Server                │
│  ┌──────────────┐   ┌────────────────┐  │
│  │  API Routes  │   │  Vite / Static │  │
│  │  (REST)      │   │  Files         │  │
│  └──────┬───────┘   └────────────────┘  │
│         │                               │
│  ┌──────▼──────────────────────┐       │
│  │  Business Services Layer    │       │
│  │  (pricing, email, whatsapp) │       │
│  └──────┬──────────────────────┘       │
│         │                               │
│  ┌──────▼──────────────────────┐       │
│  │  Storage Layer (Drizzle)    │       │
│  │  PostgreSQL (Neon)          │       │
│  └─────────────────────────────┘       │
└─────────────────────────────────────────┘
```

### Multi-Tenant Design
Every user belongs to a specific tenant, and data is always filtered by the user's scope:
- **OEM Admin** - tied to an OEM
- **Dealership Admin** - tied to a dealership
- **Showroom Manager** - tied to a showroom
- **Partner** - can access multiple OEMs via `partner_oems` mapping

---

## Database Schema

### Organization Hierarchy
| Table | Purpose |
|---|---|
| `oems` | Vehicle manufacturers (Hyundai, Tata, etc.) |
| `dealerships` | Dealerships with city, state, contact info |
| `dealership_oem_mapping` | Many-to-many: which dealerships belong to which OEMs |
| `showrooms` | Showrooms under dealerships |

### Users & Partners
| Table | Purpose |
|---|---|
| `users` | All system users (10 roles), with tenant IDs |
| `sales_persons` | Sales staff at showrooms |
| `partners` | Installation partners (STUDIO or INSTALLER type) |
| `partner_members` | Staff members under a partner |
| `partner_oems` | Which OEMs a partner can work for |
| `partner_showroom_mapping` | Which showrooms a partner services |
| `allocations` | Partner assignment rules (priority-based) |
| `allocation_brands` | Which vehicle brands a partner can handle |

### Vehicle & Service Catalog
| Table | Purpose |
|---|---|
| `vehicle_models` | Car models with PPF material consumption |
| `vehicle_variants` | Specific variants (petrol, diesel, etc.) |
| `services` | Available services (PPF, Ceramic Coating, etc.) |
| `service_categories` | Grouping of services |
| `brands` | Product brands (3M, XPEL, STEK, etc.) + WABA config |
| `raw_materials` | Materials used in services |
| `service_raw_materials` | Which materials a service consumes |

### Work Execution
| Table | Purpose |
|---|---|
| `work_orders` | Customer orders (DRAFT to CLOSED lifecycle) |
| `job_cards` | The actual work done by a partner (linked 1:1 to work orders) |
| `job_card_media` | Photos/videos uploaded during work |
| `approvals` | Job card approval records |

### Financials
| Table | Purpose |
|---|---|
| `pricing_rules` | 4 types: PARTNER, DEALERSHIP, DETAILER, OEM pricing |
| `commission_rules` | Commission % or fixed amount for sales persons |
| `commissions` | Actual commission payouts |
| `payouts` | Partner earnings per job card |
| `oem_royalty_rules` | OEM royalty percentages |
| `oem_royalty_calculations` | Calculated royalty amounts |

### System
| Table | Purpose |
|---|---|
| `audit_logs` | Activity tracking |
| `otp_verifications` | Email/SMS OTP codes |
| `whatsapp_templates` | Meta WABA template mappings |
| `webhook_subscriptions` | Outbound webhook configs |
| `system_settings` | Key/value configuration storage |
| `idempotency_keys` | Idempotency for webhooks |

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/send-email-otp` - Send email OTP
- `POST /api/auth/verify-email-otp` - Verify email OTP
- `POST /api/auth/send-sms-otp` - Send SMS OTP
- `POST /api/auth/verify-sms-otp` - Verify SMS OTP
- `POST /api/auth/complete-profile` - Profile completion
- `POST /api/auth/update-profile-data` - Update profile

### Users
- `GET /api/users` - List users (role-filtered)
- `POST /api/users` - Create user
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/users/:id/reset-password` - Reset password

### Organizations
- `GET /api/oems`, `POST /api/oems`, `PUT /api/oems/:id`, `DELETE /api/oems/:id`
- `GET /api/dealerships`, `POST /api/dealerships`, `POST /api/dealerships/bulk-upload`, `PUT /api/dealerships/:id`, `DELETE /api/dealerships/:id`
- `GET /api/showrooms`, `POST /api/showrooms`, `POST /api/showrooms/bulk-upload`, `PUT /api/showrooms/:id`, `DELETE /api/showrooms/:id`

### Vehicles & Services
- `GET /api/vehicle-models`, `POST /api/vehicle-models`, `PUT /api/vehicle-models/:id`, `DELETE /api/vehicle-models/:id`
- `GET /api/vehicle-variants`, `POST /api/vehicle-variants`, `PUT /api/vehicle-variants/:id`
- `POST /api/vehicle-data/upload-excel` - Bulk upload
- `GET /api/services`, `POST /api/services`, `PUT /api/services/:id`, `DELETE /api/services/:id`
- `GET /api/service-categories`, `POST /api/service-categories`, `PUT /api/service-categories/:id`, `DELETE /api/service-categories/:id`
- `GET /api/brands`, `POST /api/brands`, `PUT /api/brands/:id`, `DELETE /api/brands/:id`
- `GET /api/raw-materials`, `POST /api/raw-materials`, `PUT /api/raw-materials/:id`, `DELETE /api/raw-materials/:id`

### Work Orders
- `GET /api/work-orders` - List (filtered by tenant)
- `POST /api/work-orders` - Create
- `POST /api/work-orders/bulk` - Bulk create
- `GET /api/work-orders/:id` - Get details
- `PUT /api/work-orders/:id` - Update
- `POST /api/work-orders/:id/submit` - Submit (DRAFT to SUBMITTED)
- `POST /api/work-orders/:id/cancel` - Cancel with reason
- `POST /api/work-orders/:id/allocate` - Manual partner allocation

### Job Cards
- `GET /api/job-cards` - List (filtered by tenant)
- `GET /api/job-cards/:id` - Get details (deep linkable via WhatsApp)
- `POST /api/job-cards` - Create
- `PUT /api/job-cards/:id` - Update
- `PUT /api/job-cards/:id/assign` - Assign installer
- `POST /api/job-cards/:id/acknowledge` - Partner acknowledges
- `POST /api/job-cards/:id/schedule` - Schedule appointment
- `POST /api/job-cards/:id/pre-installation` - Upload 4 photos
- `POST /api/job-cards/:id/start` - Start work (requires pre-installation)
- `POST /api/job-cards/:id/complete` - Mark completed
- `POST /api/job-cards/:id/request-approval` - Request approval
- `POST /api/job-cards/:id/approve` - Approve/reject
- `POST /api/job-cards/:id/request-e-warranty` - Apply e-warranty
- `POST /api/job-cards/:id/request-rework` - Request rework
- `POST /api/job-cards/:id/mark-fixed` - Mark rework as fixed
- `POST /api/job-cards/:id/settle-payment` - Settle payment
- `POST /api/job-cards/:id/apply-warranty` - Register warranty

### Partners
- `GET /api/partners`, `POST /api/partners`, `POST /api/partners/bulk`
- `GET /api/partners/:id`, `PUT /api/partners/:id`, `DELETE /api/partners/:id`
- `GET /api/partners/:id/service-categories` - Partner's categories
- `GET /api/partners-with-categories` - Partners grouped by category
- `GET /api/partners/:partnerId/staff` - List staff
- `POST /api/partners/:partnerId/staff` - Add staff
- `PUT /api/partners/:partnerId/staff/:staffId` - Update staff
- `DELETE /api/partners/:partnerId/staff/:staffId` - Remove staff

### Allocations
- `GET /api/allocations`, `POST /api/allocations`
- `PUT /api/allocations/:id`, `DELETE /api/allocations/:id`

### Pricing
- `GET /api/pricing-rules`, `POST /api/pricing-rules`, `PUT /api/pricing-rules/:id`, `DELETE /api/pricing-rules/:id`
- `GET /api/pricing/dealership/:dealershipId/service/:serviceId` - Get dealership price
- `GET /api/pricing/detailer/:detailerId/service/:serviceId` - Get detailer price

### Commissions
- `GET /api/commission-rules`, `POST /api/commission-rules`, `PUT /api/commission-rules/:id`, `DELETE /api/commission-rules/:id`
- `GET /api/commissions` - List commissions
- `GET /api/commissions/summary` - Dashboard summary

### Payouts
- `GET /api/payouts` - List payouts
- `POST /api/payouts/:id/recalculate` - Recalculate a payout
- `POST /api/payouts/bulk-recalculate` - Bulk recalculate (super admin only)
- `POST /api/payouts/:id/settle` - Settle payout
- `GET /api/payout-settlement` - Settlement page data

### Sales Persons
- `GET /api/sales-persons`, `POST /api/sales-persons`, `PUT /api/sales-persons/:id`, `DELETE /api/sales-persons/:id`
- `GET /api/sales-persons/:id/metrics` - Performance metrics

### Dashboard & Reports
- `GET /api/dashboard/metrics` - KPI metrics
- `GET /api/dashboard/charts/orders-trend` - Chart data
- `GET /api/dashboard/charts/dealership-performance`
- `GET /api/dashboard/charts/vehicle-upsells`
- `GET /api/dashboard/charts/territory-performance`
- `GET /api/dashboard/charts/service-popularity`
- `GET /api/dashboard/charts/monthly-trends`
- `GET /api/reports/metrics` - Report data

### System & Webhooks
- `POST /api/webhooks/pulse/user-access` - Pulse webhook (HMAC verified)
- `GET /api/system-settings/:key`, `PUT /api/system-settings/:key`
- `GET /api/knowledge-hub`, `POST /api/knowledge-hub`, `PUT /api/knowledge-hub/:id`, `DELETE /api/knowledge-hub/:id`
- `GET /api/audit-logs` - Activity logs

---

## Key Business Flows

### Work Order Lifecycle
```
DRAFT -> SUBMITTED -> ASSIGNED -> IN_PROGRESS -> COMPLETED_PENDING_APPROVAL -> APPROVED -> CLOSED
    |                                                                    |
    +-- Cancel (cascades to job card, payouts, commissions)             +-- Rework requested
```

### Job Card Lifecycle (linked to work order)
```
AWAITING_ACK -> ACKNOWLEDGED -> SCHEDULED -> IN_PROGRESS -> COMPLETED -> PENDING_APPROVAL -> APPROVED -> PENDING_SALES_INVOICE -> INVOICE_RAISED -> CLOSED
       |                                                                                                                    |
       +-- NO_SHOW / CANCELLED                                                                                              +-- WARRANTY_REGISTRATION
```

**Status Sync**: When job card goes IN_PROGRESS, work order also goes IN_PROGRESS. When job card is APPROVED, work order goes APPROVED.

### Partner Allocation Flow
1. Work order is submitted
2. System looks for partners based on:
   - Showroom-level allocation (highest priority)
   - Dealership-level allocation (fallback)
   - Brand match (partner handles that car brand)
   - Service category match
3. If auto-allocation fails, admin manually allocates

### Pre-Installation Inspection
Before starting work, partner must upload **4 mandatory photos**: Front, Back, Left Side, Right Side. The "Start Work" button is disabled until complete. Photos stored in GCS with private ACLs, served via **signed URLs** (1-hour expiry).

### Billing & Payout Flow
1. Work order gets auto-priced from DEALERSHIP_PRICING rules
2. When job card is approved, a **payout** is created using DETAILER_PRICING
3. **Commission** calculated for sales person from COMMISSION_RULES
4. **OEM royalty** calculated from OEM_ROYALTY_RULES
5. Admin settles payouts when payment is made

---

## Authentication & Authorization

### Middleware Stack
Every protected route goes through:
1. **`authenticate`** - Verify JWT from `Authorization: Bearer` header
2. **`requireRole([roles])`** - Check role is in allowed list
3. **`requireOEMAccess`** - For partners, verify OEM access via `partner_oems`
4. **`blockAdminDelete`** - ADMIN role cannot perform DELETE operations
5. **`hasStateAccess`** - MANAGER role restricted to `allowedStates`

### Role Permissions Summary
| Role | Create | Edit | Delete | Notes |
|---|---|---|---|---|
| SUPER_ADMIN | All | All | All | Full access |
| ADMIN | All | All | None | Cannot delete anything |
| MANAGER | Work orders, Sales persons | None | None | Read-only with state filtering |
| OEM_ADMIN | Own OEM entities | Own OEM entities | Own OEM entities | Scoped to OEM |
| DEALERSHIP_ADMIN | Own dealership entities | Own dealership entities | Own dealership entities | Scoped to dealership |
| SHOWROOM_MANAGER | Work orders | Own work orders | None | Scoped to showroom |
| SALES_PERSON | Work orders | None | None | Scoped to showroom |
| PARTNER_ADMIN | Job cards, staff | Own partner data | None | Scoped to partner |
| PARTNER_STAFF | Job card status | Own job cards | None | Scoped to assigned job cards |

---

## External Integrations

### Pulse Webhook
- **Endpoint**: `POST /api/webhooks/pulse/user-access`
- **Purpose**: External Pulse system sends partner activation/deactivation events
- **Security**: HMAC-SHA256 signature verification + timestamp validation
- **Actions**: Activate/deactivate PARTNER_ADMIN and PARTNER_STAFF users

### WhatsApp (Meta WABA)
- Template-based messages for job card lifecycle events
- Single WABA account configured via environment variables
- Templates stored in `whatsapp_templates` table

### Email (Hybrid AWS SES + SMTP)
- Primary: AWS SES SDK
- Fallback: Nodemailer SMTP
- Sends: OTPs, work order notifications, job card status updates, accounts team invoice alerts, partner application notifications
- HTML templates with embedded P91 logo

### Google Cloud Storage
- Job card photos stored with **private ACLs**
- **Signed URLs** (1-hour TTL) for secure viewing
- Client-side image compression (HEIC/HEIF conversion, max 1MB) before upload

---

## Folder Structure

```
pulse-vas/
├── client/                          # Frontend (React + Vite)
│   └── src/
│       ├── App.tsx                  # Main router with all 27 pages
│       ├── pages/                   # Page components
│       │   ├── login.tsx, dashboard.tsx, work-orders.tsx
│       │   ├── JobCardsNew.tsx, job-cards.tsx
│       │   ├── partners.tsx, partner-staff.tsx, allocations.tsx
│       │   ├── pricing.tsx, commissions.tsx, payouts.tsx
│       │   ├── payout-settlement.tsx, oems.tsx, dealerships.tsx
│       │   ├── showrooms.tsx, vehicles.tsx, services.tsx
│       │   ├── ServiceCategories.tsx, Brands.tsx, RawMaterials.tsx
│       │   ├── sales-persons.tsx, reports.tsx, audit.tsx
│       │   ├── settings.tsx, KnowledgeHub.tsx
│       │   ├── forgot-password.tsx, reset-password.tsx, not-found.tsx
│       ├── components/
│       │   ├── ui/                  # 40+ Shadcn UI components
│       │   ├── layout/              # Layout, Header, Sidebar, MainLayout
│       │   ├── modals/              # 20+ Create/Edit modals
│       │   ├── forms/               # Reusable form components
│       │   ├── cards/               # Data display cards
│       │   └── job-cards/           # Job card specific components
│       ├── hooks/
│       │   ├── use-auth.tsx         # Authentication context
│       │   ├── use-oem-context.tsx  # OEM selection context
│       │   ├── use-tenant.ts        # Tenant filtering
│       │   └── use-toast.ts         # Toast notifications
│       └── lib/
│           ├── queryClient.ts       # React Query setup
│           └── ga4.ts               # Google Analytics
│
├── server/                          # Backend (Express)
│   ├── index.ts                     # Entry point
│   ├── routes.ts                    # 200+ API endpoints (8,500 lines)
│   ├── storage.ts                   # IStorage + DB impl (4,800 lines)
│   ├── db.ts                        # Drizzle ORM + Neon connection
│   ├── auth.ts                      # JWT auth service
│   ├── middleware.ts                # Auth, RBAC, tenant middleware
│   ├── objectStorage.ts             # GCS upload/download
│   ├── objectAcl.ts                 # ACL management
│   ├── vite.ts                      # Vite integration
│   ├── services/                    # Business logic
│   │   ├── pricingService.ts, pricing.ts
│   │   ├── commissionService.ts, commission.ts
│   │   ├── workOrderService.ts, jobCardService.ts
│   │   ├── notificationService.ts, notification.ts
│   │   ├── email-service.ts, whatsapp-service.ts
│   │   ├── sms-service.ts, webhook.ts
│   │   └── pulseWebhookService.ts
│   ├── middleware/
│   │   ├── auth.ts, rbac.ts, tenancy.ts, validation.ts
│   ├── jobs/
│   │   ├── sla-monitor.ts, queue.ts
│   ├── workers/
│   │   └── queueWorker.ts
│   └── utils/
│       ├── otp.ts, webhooks.ts
│
├── shared/                          # Shared between FE and BE
│   ├── schema.ts                    # Drizzle schema + Zod types (1,100 lines)
│   ├── types.ts                     # Shared TypeScript types
│   └── constants.ts                 # Constants/enums
│
├── db/                              # Database migrations
├── migrations/                      # Drizzle migrations
├── scripts/                         # Utility scripts
├── uploads/                         # Temporary file uploads
├── docs/                            # Documentation
├── postman/                         # Postman collections
├── attached_assets/                 # Static assets (logo, etc.)
├── package.json                     # Dependencies
├── tailwind.config.ts               # Tailwind config
├── drizzle.config.ts                # Drizzle config
├── vite.config.ts                   # Vite config
├── tsconfig.json                    # TypeScript config
└── replit.md                        # Project overview
```

---

## Getting Started

### Prerequisites
- Node.js 18 or higher
- PostgreSQL 15 or higher
- Redis 7 or higher

### Environment Variables
Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT signing
- `REDIS_URL` - Redis connection string
- `META_WABA_ACCESS_TOKEN` - Meta WhatsApp API token
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` - AWS SES credentials
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` - SMTP fallback

### Installation

1. **Clone and install dependencies**
```bash
npm install
```

2. **Push database schema**
```bash
npm run db:push
```

3. **Start development server**
```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server (Express + Vite) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Push Drizzle schema to database |

---

## Performance Optimizations

- **31 database indexes** on frequently queried columns (work_orders, job_cards, commissions, etc.)
- **Server-side dashboard caching** with 60-second TTL for chart endpoints
- **Frontend React Query caching** with 5-minute staleTime for reference data, 2-minute refetch for dynamic data
- **N+1 query fixes** in OEMs, Dealerships, and Showrooms endpoints (5-20x speedup)
- **Bulk queries** for dropdown data to eliminate per-item database calls
