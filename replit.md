# Overview

Pulse VAS is a multi-tenant web application designed for managing Paint Protection Film (PPF) installation orders within the automotive industry. It connects Vehicle OEMs, dealerships, showrooms, and installation partners, offering a complete workflow management system with features like real-time tracking, automated pricing, and commission management. The platform supports various user roles, providing role-specific dashboards and permissions to streamline work order lifecycles, track job cards, manage partner allocations, and handle complex billing and commission structures.

## Recent Changes (November 3, 2025)
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
- **Pulse Integration Webhook**: Inbound webhook for user lifecycle management (activate/deactivate).