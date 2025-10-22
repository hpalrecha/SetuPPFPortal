# Pulse VAS - PPF Installation Management Portal

A comprehensive multi-tenant web application for managing Paint Protection Film (PPF) installation orders across Vehicle OEMs, dealerships, showrooms, and installation partners with complete workflow automation, pricing management, and commission tracking.

## Features

### Core Functionality
- **Multi-tenant Architecture**: Complete OEM-level isolation with role-based access control
- **Work Order Management**: Complete lifecycle from draft to completion with approval workflows
- **Job Card Tracking**: Real-time status tracking for installation partners
- **Partner Management**: Allocation system with priority-based auto-assignment
- **Pricing Engine**: Hierarchical pricing rules with flexible resolution
- **Commission System**: Automated commission calculation for sales persons
- **File Management**: Secure proof upload with signed URLs
- **Audit Trail**: Complete activity logging and timeline views
- **Dashboard Analytics**: Role-specific dashboards with KPIs and metrics

### User Roles
- **Super Admin**: Global settings, tenants, pricing templates
- **OEM Admin**: Manages dealerships, brand vehicles, metrics visibility
- **Dealership Admin**: Manages showrooms, assigns sales persons, pricing overrides
- **Showroom Manager**: Raises work orders, approvals, commission settings
- **Sales Person**: Views orders and earnings (commission tracking)
- **Partner Admin/Staff**: Job execution, proof uploads, scheduling

## Tech Stack

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS with Shadcn UI components
- **State Management**: React Query for API state management
- **Forms**: React Hook Form with Zod validation
- **Routing**: Wouter for client-side routing

### Backend
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT with role-based access control
- **File Storage**: Object storage with signed URLs
- **Background Jobs**: BullMQ with Redis
- **Validation**: Zod schemas with type safety

### Infrastructure
- **Database**: PostgreSQL 15+
- **Cache/Queue**: Redis 7+
- **File Storage**: Google Cloud Storage (via Replit Object Storage)
- **Runtime**: Node.js 18+

## Getting Started

### Prerequisites
- Node.js 18 or higher
- PostgreSQL 15 or higher
- Redis 7 or higher
- Git

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd pulse-vas
