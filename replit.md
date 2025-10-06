# Overview

SetuPPF is a comprehensive multi-tenant web application for managing Paint Protection Film (PPF) installation orders across the automotive industry. The platform connects Vehicle OEMs, dealerships, showrooms, and installation partners through a complete workflow management system with real-time tracking, automated pricing, and commission management.

The application serves multiple user roles including Super Admins, OEM Admins, Dealership Admins, Showroom Managers, Sales Persons, and Partner Staff, each with role-specific dashboards and permissions. Key features include work order lifecycle management, job card tracking, partner allocation systems, hierarchical pricing rules, automated commission calculations, and comprehensive audit trails.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: Next.js 14 with TypeScript for type safety and modern React features
- **Styling**: Tailwind CSS with Shadcn UI component library for consistent design system
- **State Management**: React Query for server state management and caching
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Routing**: Wouter for lightweight client-side routing
- **Build System**: Vite for fast development and optimized production builds

## Backend Architecture
- **Framework**: Express.js with TypeScript for robust API development
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: JWT-based authentication with role-based access control (RBAC)
- **File Storage**: Google Cloud Storage with signed URLs for secure file handling
- **Background Processing**: BullMQ with Redis for job queues and background tasks
- **Validation**: Zod schemas for consistent data validation across frontend and backend

## Multi-Tenant Architecture
- **Tenant Isolation**: Complete OEM-level data isolation with hierarchical access control
- **Role-Based Permissions**: Six distinct user roles with specific permissions and data access
- **Middleware Stack**: Authentication, tenant context, and RBAC middleware for request processing
- **Data Scoping**: Automatic tenant-specific data filtering based on user context

## Core Business Logic
- **Work Order Management**: Complete lifecycle from draft to completion with approval workflows
- **Job Card System**: Real-time status tracking with SLA monitoring and automated notifications
- **Partner Allocation**: Priority-based auto-assignment system with manual override capabilities and partner billing controls
- **Pricing Engine**: Hierarchical pricing rules with flexible resolution (Partner > Showroom > Dealership)
- **Commission System**: Automated commission calculation with percentage/fixed amount rules and caps/floors
- **Billing System**: Automated billing detail population with hierarchical rules and partner billing control
  - **Bill From**: Defaults to "Plus Nine One Inc"; uses Partner address if "Partner Bills Customer Directly" toggle is enabled
  - **Bill To Hierarchy**: OEM (if billDirectlyToOem) > Showroom (if billDirectlyToShowroom) > Dealership
  - **Ship To**: Always uses Showroom's ship to address
  - **Partner Direct Billing**: Partners can bill customers directly, bypassing system billing (configurable per allocation)
- **Audit System**: Comprehensive activity logging with timeline views and export capabilities

## Database Design
- **Schema Management**: Drizzle migrations with version control
- **Relationships**: Well-defined foreign key relationships with cascade handling
- **Enums**: PostgreSQL enums for status fields and user roles
- **Indexing**: Strategic indexes for query performance optimization
- **Data Types**: Proper use of UUID, timestamps, decimals, and JSONB for flexible data storage
- **Billing Data**: JSONB fields (billFrom, billTo, shipTo) store complete billing/shipping addresses with GSTIN
- **Allocation Controls**: Partner-level billing flags (partnerBillsDirectly) at allocation level for granular control

## File Management
- **Object Storage**: Google Cloud Storage integration through Replit Object Storage
- **Access Control**: ACL policies for fine-grained file access control
- **Signed URLs**: Temporary access URLs for secure file downloads
- **Media Handling**: Support for proof uploads with metadata tracking

## Background Jobs
- **Queue System**: BullMQ with Redis for reliable job processing
- **SLA Monitoring**: Automated breach detection with configurable thresholds
- **Notifications**: Multi-channel notification system (Email, WhatsApp)
  - **Email**: Hybrid AWS SES SDK (primary) + SMTP fallback for reliable delivery
  - **WhatsApp**: Meta WABA integration for Job Card lifecycle notifications
- **Webhook Delivery**: Outbound webhook system with retry logic and failure handling
- **Report Generation**: Automated report generation and distribution

# External Dependencies

## Database & Storage
- **PostgreSQL 15+**: Primary database for all application data with advanced features like JSONB and enums
- **Redis 7+**: Used for session storage, job queues, and caching layer
- **Google Cloud Storage**: Object storage through Replit Object Storage for file management

## Authentication & Security
- **JWT**: JSON Web Tokens for stateless authentication
- **bcryptjs**: Password hashing and verification
- **CORS**: Cross-origin resource sharing configuration

## Frontend Libraries
- **@radix-ui**: Comprehensive set of accessible UI primitives
- **@tanstack/react-query**: Server state management and caching
- **@hookform/resolvers**: React Hook Form integration with validation libraries
- **date-fns**: Date manipulation and formatting utilities
- **embla-carousel-react**: Carousel component for image galleries
- **class-variance-authority**: Type-safe CSS class management

## Backend Libraries
- **drizzle-orm**: Type-safe SQL ORM with PostgreSQL support
- **@neondatabase/serverless**: Serverless PostgreSQL connection handling
- **connect-pg-simple**: PostgreSQL session store for Express
- **nanoid**: URL-safe unique string ID generator

## Development Tools
- **TypeScript**: Static type checking for both frontend and backend
- **Vite**: Fast build tool with HMR for development
- **ESBuild**: Fast JavaScript bundler for production builds
- **Tailwind CSS**: Utility-first CSS framework
- **PostCSS**: CSS post-processing with autoprefixer

## API Integration
- **RESTful APIs**: Standard HTTP methods with JSON payloads
- **Webhook System**: Outbound webhooks for external system integration
- **File Upload**: Direct-to-storage upload with presigned URLs
- **Real-time Updates**: Polling-based updates for dashboard metrics
- **WhatsApp Business API (WABA)**: Meta Graph API v19.0 for automated notifications
  - **Job Card Created**: Notifies customer and assigned partner
  - **Job Card Scheduled**: Notifies partner with schedule details
  - **Job Card Started**: Notifies showroom POC for monitoring
  - **Job Card Completed**: Notifies showroom POC for approval
  - **Job Card Approved**: Notifies partner with approval confirmation
- **Email Service**: Hybrid delivery system (AWS SES SDK + SMTP fallback)
  - Work Order notifications (created, updated, completed)
  - Job Card notifications (completion, approval)
  - Password reset and OTP verification emails

## Monitoring & Observability
- **Console Logging**: Structured logging for debugging and monitoring
- **Error Handling**: Comprehensive error boundaries and API error responses
- **Audit Trails**: Complete activity logging for compliance and debugging
- **Performance Metrics**: Query optimization and response time monitoring