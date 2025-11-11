# Overview

Pulse VAS is a multi-tenant web application for managing Paint Protection Film (PPF) installation orders within the automotive industry. It connects Vehicle OEMs, dealerships, showrooms, and installation partners, providing a complete workflow management system. Key features include real-time tracking, automated pricing, commission management, role-specific dashboards to streamline order lifecycles, and a draft-submit workflow for work orders with manual partner allocation and cancellation capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions
The application uses the P91 Brand Theme with a Brand Green primary color, Oxanium for headings, and Sarabun for body text. It incorporates custom shadows, defined border-radii, and animations. Utility classes like `.glass-panel`, `.dark-panel`, and `.btn-premium` ensure consistent styling.

## Technical Implementations
- **Frontend**: Built with Next.js 14, TypeScript, Tailwind CSS, Shadcn UI, React Query, React Hook Form with Zod, and Wouter for routing.
- **Backend**: Uses Express.js with TypeScript, PostgreSQL via Drizzle ORM, JWT for authentication with RBAC, Google Cloud Storage, and BullMQ with Redis for background processing. Zod schemas are used for data validation.
- **Multi-Tenancy**: Achieved through OEM-level data isolation, role-based permissions, and a middleware stack for authentication, tenant context, and RBAC, ensuring data is scoped to the user's tenant.

## Feature Specifications
- **Work Order Management**: Full lifecycle management with draft-submit workflow, manual partner allocation for PENDING orders, and cancellation with cascade effects (job cards, payouts, commissions).
- **Job Card System**: Real-time status tracking, SLA monitoring, and notifications.
  - **Pre-Installation Inspection** (Nov 2025): Mandatory photo documentation before starting work. Partners must upload 4 labeled photos (Front, Back, Left Side, Right Side) with optional remarks. Photos are stored in object storage with private ACLs. The "Start Work" button is only enabled after pre-installation inspection is completed.
  - **Status Synchronization** (Nov 2025): Work order status automatically syncs with job card status changes. When job card moves to IN_PROGRESS, work order also updates to IN_PROGRESS. When job card is approved, work order updates to APPROVED. This ensures consistent status tracking across the system.
  - **E-Warranty Application** (Nov 2025): Two separate flows exist: 1) Partner e-warranty request (for partner-billed jobs) sends notification emails to STEK India without requiring warranty reference number, 2) Admin warranty registration requires warranty reference number and sets status to WARRANTY_REGISTRATION.
- **Partner Allocation**: Priority-based auto-assignment with manual overrides and billing controls.
- **Pricing Engine**: Hierarchical pricing rules applied at OEM, Dealership, and Partner levels.
  - **OEM Pricing** (Nov 2025): OEM-level default pricing rules that apply to all dealerships under an OEM, reducing manual pricing management from 13,800+ to ~50 rules. Pricing hierarchy: DEALERSHIP_PRICING → OEM_PRICING (fallback). Each rule defines price for a specific OEM + Service + Vehicle Model combination.
- **Commission System**: Automated calculations based on percentages/fixed amounts, with caps/floors.
- **Billing System**: Automated detail population with hierarchical rules, supporting "Bill From" and "Bill To" logic, "Ship To" from Showroom, and partner direct billing.
- **Audit System**: Comprehensive activity logging and timeline views.
- **Hierarchical Permission System** (Nov 2025): Added ADMIN and MANAGER roles:
  - **ADMIN Role**: Full read/write access to all resources except DELETE operations (blocked from all deletes)
    - Can create/edit OEMs, dealerships, showrooms, sales persons, work orders
    - Can access pricing rules, commissions, vehicles, service categories, brands, raw materials
    - Cannot delete any resources (403 Forbidden on all DELETE operations)
  - **MANAGER Role**: READ-ONLY state-based access control with allowedStates field
    - View: Can see ALL OEMs (no state filtering), but dealerships, showrooms, work orders, partners, and sales persons are filtered by allowedStates
    - Filtering Hierarchy: OEMs (ALL visible) → Dealerships (state-filtered) → Showrooms (state-filtered via dealership)
    - Create: Can only create work orders (only for dealerships in allowed states)
    - Restrictions: Cannot create/edit dealerships, showrooms, or users; cannot access entities outside allowedStates; no delete permissions
    - Frontend: Add buttons hidden for dealerships, showrooms, and sales persons
  - Existing roles (SUPER_ADMIN, OEM_ADMIN, DEALERSHIP_ADMIN, SHOWROOM_MANAGER, SALES_PERSON, PARTNER_ADMIN, PARTNER_STAFF) remain unchanged

## System Design Choices
- **Database**: PostgreSQL with Drizzle ORM, using UUIDs, timestamps, decimals, JSONB, enums, and strategic indexing.
- **File Management**: Google Cloud Storage via Replit Object Storage, utilizing ACLs and signed URLs.
- **Background Jobs**: BullMQ and Redis manage queues, SLA monitoring, multi-channel notifications (Email, WhatsApp), webhook delivery, and report generation.
- **Authentication**: JWT-based with bcryptjs for password hashing and CORS configured.
- **Pulse Integration**: A webhook endpoint (`POST /api/webhooks/pulse/user-access`) manages user access control (activate/deactivate PARTNER_ADMIN and PARTNER_STAFF roles) from an external system named Pulse, including HMAC-SHA256 signature verification and timestamp validation.

## Performance Optimizations
- **Database Indexes** (Applied Nov 2025): Added 31 strategic indexes on critical tables (work_orders, job_cards, commissions, payouts, allocations, etc.) covering frequently queried columns, composite queries, and timestamp-based filtering.
- **Frontend Caching** (Nov 2025): Optimized React Query settings across all pages:
  - Reference data (OEMs, partners, dealerships, showrooms, services, vehicle models): 5-minute staleTime with no auto-refresh
  - Dynamic data (dashboard, work orders): 2-minute refetchInterval with 1-minute staleTime
  - List views: Balanced caching for optimal user experience
  - Modal dropdowns: All reference data queries cache for 5 minutes, eliminating 2-3 second delays on subsequent opens
- **Server-Side Caching** (Nov 2025): Implemented DashboardCache class with 60-second TTL for 6 dashboard chart endpoints (orders-trend, dealership-performance, vehicle-upsells, territory-performance, service-popularity, monthly-trends). Automatic cache cleanup runs every 5 minutes.
- **Query Optimization** (Nov 2025): 
  - Fixed N+1 query problem in `/api/oems` endpoint by fetching all dealerships and showrooms in 2 queries instead of 2*N queries, then counting in memory. Result: 5-10x performance improvement (2.9s → 0.3s).
  - Fixed N+1 query problem in `/api/dealerships` endpoint by fetching all showrooms, sales staff, and OEM mappings in bulk (3 queries instead of N*3). With 460+ dealerships, this reduces ~1,380 queries to 3, improving response time from 7-8 seconds to <1 second.
  - Fixed N+1 query problem in `getShowrooms()` storage method by fetching all users and work orders in bulk (3 queries total instead of 3,200+ queries). With 1,600+ showrooms, this eliminates 2 database queries per showroom. Expected improvement: 2100ms → <100ms (**20x faster**).
  - Added 9 critical database indexes: users (showroom_id, dealership_id, oem_id, partner_id), work_orders (showroom_id, dealership_id, oem_id, status, assigned_partner_id). These indexes speed up bulk queries and filtering operations.

# External Dependencies

## Database & Storage
- **PostgreSQL 15+**: Primary data storage.
- **Redis 7+**: Session storage, job queues, caching.
- **Google Cloud Storage**: Object storage for files.

## Authentication & Security
- **JWT**: Stateless authentication.
- **bcryptjs**: Password hashing.
- **CORS**: Cross-origin resource sharing.

## Frontend Libraries
- **@radix-ui**: Accessible UI primitives.
- **@tanstack/react-query**: Server state management.
- **@hookform/resolvers**: Form validation integration.
- **date-fns**: Date manipulation.
- **embla-carousel-react**: Carousel component.
- **class-variance-authority**: Type-safe CSS classes.

## Backend Libraries
- **drizzle-orm**: Type-safe SQL ORM.
- **@neondatabase/serverless**: Serverless PostgreSQL connection.
- **connect-pg-simple**: PostgreSQL session store.
- **nanoid**: Unique ID generator.

## API Integration
- **RESTful APIs**: Standard HTTP communication.
- **Webhook System**: Outbound webhooks.
- **WhatsApp Business API (Meta WABA)**: For Job Card lifecycle notifications using 5 Meta-approved templates.
- **Email Service (Hybrid AWS SES SDK + SMTP)**: For Work Order, Job Card, and Authentication notifications, supporting dynamic "From" emails and URL generation.
- **Pulse Integration Webhook**: Inbound webhook (`POST /api/webhooks/pulse/user-access`) for partner and user lifecycle management with HMAC-SHA256 signature verification.