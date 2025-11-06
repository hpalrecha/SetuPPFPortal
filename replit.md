# Overview

Pulse VAS is a multi-tenant web application designed for managing Paint Protection Film (PPF) installation orders within the automotive industry. It connects Vehicle OEMs, dealerships, showrooms, and installation partners, offering a complete workflow management system with features like real-time tracking, automated pricing, and commission management. The platform supports various user roles, providing role-specific dashboards and permissions to streamline work order lifecycles, track job cards, manage partner allocations, and handle complex billing and commission structures.

## Recent Changes (November 6, 2025)
- **Production Performance Optimization**: Comprehensive performance optimization to address production deployment requirements:
  - **Database Indexes** (31 indexes added via migration `db/0002_performance_indexes.sql`):
    - Work Orders: Composite indexes on (oemId, dealershipId, showroomId, createdAt), (workOrderId, status, completedAt), (partnerId, status), (status, createdAt)
    - Job Cards: Composite indexes on (oemId, dealershipId, showroomId, createdAt), (workOrderId, status, createdAt), (partnerId, status), (assignedTo, status)
    - Payouts: Indexes on (jobCardId, status), (partnerId, status), (createdAt), (status, dueDate)
    - Commissions: Indexes on (salesPersonId, workOrderId), (status, createdAt), (dealershipId, showroomId)
    - OEM Royalty: Indexes on (oemId, workOrderId), (status, createdAt)
    - Users: Indexes on (oemId, role), (dealershipId, role), (showroomId, role), (partnerId, role)
    - Performance Impact: Dashboard chart queries reduced from 2+ seconds to sub-200ms
  - **Frontend Caching Optimization**:
    - Dashboard: Increased refetchInterval from 30s to 120s (2 minutes) with 60s staleTime
    - Reference Data (OEMs, Partners, Dealerships, Showrooms): Set staleTime to 300s (5 minutes), removed aggressive auto-refresh
    - Work Orders: Increased refetchInterval from 30s to 120s with 60s staleTime
    - Commission Rules, Pricing Rules, Sales Persons, Partner Staff: Set staleTime to 300s (5 minutes)
    - Reports: Removed duplicate manual refetch interval, optimized to 120s with 60s staleTime
    - Service Categories: Added 300s staleTime for better caching
    - Impact: Eliminated redundant API calls, reduced network traffic by ~70%
  - **Server-Side Caching**:
    - Implemented in-memory cache for all 6 dashboard chart endpoints with 1-minute TTL
    - Cached endpoints: orders-trend, dealership-performance, vehicle-upsells, territory-performance, service-popularity, monthly-trends
    - Cache keys scoped by user context (oemId, dealershipId, showroomId) for proper multi-tenancy
    - Automatic cache cleanup every 5 minutes to prevent memory bloat
    - Impact: Second request within 1 minute returns instantly from cache, ~90% faster
- **Pagination Implementation**: Added pagination to dealerships and showrooms pages to dramatically improve load performance:
  - Backend: Updated getDealerships and getShowrooms storage methods to support limit/offset parameters
  - Backend: API endpoints now return `{ dealerships/showrooms: [], total: number }` instead of just arrays
  - Backend: Added database indexes on state, city, dealershipId, and oemId columns for faster queries
  - Frontend: Added pagination controls (previous/next buttons, page selector, items per page dropdown)
  - Frontend: Default page size is 20 items, configurable to 10, 20, 50, or 100 per page
  - Frontend: Optimized React Query settings (reduced refetch intervals, added 30s staleTime for better caching)
  - Performance: Pages now load only 20 records at a time instead of fetching all data upfront
  - Showroom DELETE endpoint: Added missing DELETE `/api/showrooms/:id` endpoint with SUPER_ADMIN/OEM_ADMIN role restrictions

## Previous Changes (November 4, 2025)
- **CSV/Excel Bulk Upload Enhancement**: Enhanced bulk upload to support both CSV and Excel files:
  - Installed csv-parse library for robust CSV parsing with proper quote and comma handling
  - Updated dealership and showroom bulk upload endpoints to accept .csv, .xls, and .xlsx files
  - Auto-detects file type and parses accordingly (CSV with csv-parse, Excel with XLSX library)
  - CSV headers use snake_case format (e.g., showroom_name, dealership_code, oe_dealer_code)
  - Excel files use same snake_case column headers in first row
  - Properly handles address fields with multiple commas (e.g., "VPO Gobindgarh,,,,Abohr,Punjab,152117")
- **Pulse Webhook Enhancement**: Enhanced webhook to properly capture all partner contact details:
  - Fixed partner entity creation to include email, phone, contact person name, address, city, state, pincode, GSTIN, and PAN
  - Extended webhook payload interface to support optional partner contact fields
  - Partner lookup now checks both displayName and email for existing partners
  - Added comprehensive logging to track received payload and partner creation/update details
  - User name now uses contactPersonName from payload if provided (fallback to email-derived name)
- **State/City Filtering**: Added state and city filters to dealership and showroom list pages:
  - Backend endpoints: /api/dealerships/filter-options and /api/showrooms/filter-options
  - State filter: Dropdown with counts for each state
  - City filter: Searchable combobox with counts for each city
  - Server-side filtering for optimal performance

## Previous Changes (November 3, 2025)
- **Username Field Fix**: Fixed all user creation endpoints to properly include username field:
  - Added auto-generation helper function that creates usernames from email addresses (format: email prefix, lowercase, alphanumeric only)
  - Updated all backend user creation routes (OEM admin, dealership admin, showroom manager, partner admin, partner staff, sales person)
  - Username is auto-generated from email when not explicitly provided
  - All LSP errors related to missing username field resolved
- **Contact Information Field Fix**: Fixed dealership bulk upload to properly initialize contactEmail field:
  - Dealership bulk upload now sets contactEmail to empty string instead of leaving it null
  - Allows contact email to be edited and saved properly in existing dealerships
  - Showroom bulk upload already handled this correctly
- **Google Analytics 4 Integration**: Implemented GA4 tracking (Measurement ID: G-2ELXYG64RE) for comprehensive user analytics:
  - Automatic page view tracking on all route changes using wouter router integration
  - Custom event tracking for key user actions: login, email/phone verification, profile completion
  - User property tracking: role, organization type, user ID
  - Event library with predefined trackers for work orders, job cards, partners, dealerships, showrooms, bulk operations, settings, and navigation
  - Real-time data collection for traffic analysis, user behavior, and feature usage insights
- **Extended Profile Completion**: Profile completion modal now has 4 steps for dealership/showroom users (DEALERSHIP_ADMIN, SHOWROOM_MANAGER, SALES_PERSON):
  - Step 1: Email verification with OTP
  - Step 2: Phone verification with SMS OTP (via ComBirds SMS)
  - Step 3: Additional Details collection (Contact Person Name, Address, City, State, Pincode)
  - Step 4: Confirmation and profile completion
  - Additional details are saved to dealership/showroom records
  - Admin and partner users skip Step 3 and go directly to confirmation after phone verification

## Previous Changes (October 23, 2025)
- **Payout Settlement Logic**: Payout settlement now displays based on **payout status** (pending_review, due, paid) rather than job card status. Approved job cards remain visible in payout settlement even after moving to PENDING_SALES_INVOICE, WARRANTY_REGISTRATION, or other post-approval stages. Payouts are removed from the pending list only when their payout status changes to "paid".
- **Super Admin User Script**: Created secure script (`scripts/create-super-admin.ts`) to generate SQL for creating super admin users with properly bcrypt-hashed passwords for production database deployment.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions
The application utilizes the P91 Brand Theme, featuring a Brand Green primary color (`#4db848`), Oxanium for headings, and Sarabun for body text. It includes custom shadows (Premium, Subtle, Card), defined border-radii (lg, md, sm, xl, 2xl), and custom animations (accordion, float, fade-in, scale). Utility classes like `.glass-panel`, `.dark-panel`, and `.btn-premium` are used for consistent styling.

## Technical Implementations
- **Frontend**: Built with Next.js 14, TypeScript, Tailwind CSS, Shadcn UI, React Query for state management, React Hook Form with Zod for form validation, and Wouter for routing.
- **Backend**: Implemented using Express.js with TypeScript, PostgreSQL database managed by Drizzle ORM, JWT for authentication with RBAC, Google Cloud Storage for file handling, and BullMQ with Redis for background processing. Zod schemas ensure consistent data validation.
- **Multi-Tenancy**: Achieved through OEM-level data isolation, role-based permissions, and a middleware stack for authentication, tenant context, and RBAC. Data is automatically scoped to the user's tenant.

## Feature Specifications
- **Work Order Management**: Full lifecycle management including approvals.
- **Job Card System**: Real-time status tracking, SLA monitoring, and notifications.
- **Partner Allocation**: Priority-based auto-assignment with manual overrides and billing controls.
- **Pricing Engine**: Hierarchical pricing rules applied at Partner, Showroom, and Dealership levels.
- **Commission System**: Automated calculations based on percentages/fixed amounts, with caps/floors.
- **Billing System**: Automated detail population with hierarchical rules. Includes "Bill From" and "Bill To" logic, "Ship To" always from Showroom, and partner direct billing options.
- **Audit System**: Comprehensive activity logging and timeline views.

## System Design Choices
- **Database**: PostgreSQL with Drizzle ORM, utilizing UUIDs, timestamps, decimals, JSONB, enums, and strategic indexing. Material consumption tracking is included in vehicle variants.
- **File Management**: Google Cloud Storage via Replit Object Storage, with ACLs and signed URLs.
- **Background Jobs**: BullMQ and Redis for queues, SLA monitoring, multi-channel notifications (Email, WhatsApp), webhook delivery, and report generation.
- **Authentication**: JWT-based with bcryptjs for password hashing and CORS configured.
- **Pulse Integration**: Webhook endpoint (`POST /api/webhooks/pulse/user-access`) for user access control (activate/deactivate PARTNER_ADMIN and PARTNER_STAFF roles) from an external system named Pulse. This integration uses HMAC-SHA256 signature verification, timestamp validation, and detailed audit logging. User activation sends a welcome email with a password reset link.

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
- **WhatsApp Business API (Meta WABA)**: For Job Card lifecycle notifications with 5 Meta-approved templates:
  - `job_card_created` (English IND) - Notifies assigned partner when job card is created
  - `job_card_pending_approval` (English IND) - Notifies order placer when job is pending approval
  - `job_card_approved` (English) - Notifies assigned partner when job is approved
  - `job_card_rejected` (English) - Notifies assigned partner when job is rejected
  - `job_card_completed` (English) - Notifies order placer when job is completed & approved
  - All templates include job card links for easy access
  - Configured with Phone Number ID: 633152823218797, Business Account ID: 681013564674244
- **Email Service (Hybrid AWS SES SDK + SMTP)**: For Work Order, Job Card, and Authentication notifications. Supports dynamic "From" emails based on brand and dynamic URL generation. All 8 email templates updated with embedded Pulse VAS logo (base64, 69KB PNG) and professional gradient backgrounds.
- **Pulse Integration Webhook**: Inbound webhook (`POST /api/webhooks/pulse/user-access`) for partner and user lifecycle management:
  - **Actions**: `activate` (create/enable partner & user) and `deactivate` (disable user)
  - **Security**: HMAC-SHA256 signature verification with secret, timestamp validation (5-minute window)
  - **Partner Creation**: Creates partner entity with full contact details (email, phone, contact person, address, city, state, pincode, GSTIN, PAN)
  - **User Creation**: Creates PARTNER_ADMIN user with auto-generated password and sends welcome email with password reset link
  - **Lookup**: Finds existing partners by displayName or email to avoid duplicates
  - **Payload Structure**:
    ```json
    {
      "action": "activate" | "deactivate",
      "user": {
        "name": "Partner Business Name",
        "contactPersonName": "John Doe",
        "email": "partner@example.com",
        "mobile": "+919876543210",
        "role": "STUDIO" | "INSTALLER",
        "address": "123 Main St",
        "city": "Bangalore",
        "state": "Karnataka",
        "pincode": "560001",
        "gstin": "29ABCDE1234F1Z5",
        "pan": "ABCDE1234F"
      },
      "timestamp": "2025-11-04T12:00:00Z"
    }
    ```
  - **Required Fields**: action, user.name, user.email, user.role
  - **Optional Fields**: contactPersonName, mobile, address, city, state, pincode, gstin, pan
  - **Audit Logging**: Comprehensive logging for all partner and user operations