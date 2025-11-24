# Pulse VAS - Administrator Guide

**Version 1.0 | Last Updated: November 2025**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Dashboard Module](#dashboard-module)
4. [Organizations Module](#organizations-module)
5. [Work Orders Module](#work-orders-module)
6. [Job Cards Module](#job-cards-module)
7. [Partner Management](#partner-management)
8. [Pricing & Commissions](#pricing--commissions)
9. [Knowledge Hub](#knowledge-hub)
10. [Settings & User Management](#settings--user-management)
11. [Troubleshooting & Best Practices](#troubleshooting--best-practices)

---

## System Overview

### What is Pulse VAS?

Pulse VAS is a comprehensive multi-tenant web application designed to manage Paint Protection Film (PPF) installation orders across the automotive industry. It connects:

- **Vehicle OEMs** (Original Equipment Manufacturers)
- **Dealerships** and their showrooms
- **Installation Partners** (Studios and Installers)
- **Sales Personnel**

### Key Features

- **Multi-tenant Architecture**: Each OEM operates as an independent tenant with isolated data
- **Role-Based Access Control (RBAC)**: 9 distinct user roles with hierarchical permissions
- **Complete Order Lifecycle**: From draft creation to installation completion and warranty registration
- **Real-time Tracking**: Job card status updates, SLA monitoring, and notifications
- **Automated Systems**: Pricing rules, commission calculations, and billing generation
- **Integration Ready**: WhatsApp Business API, Email notifications, Pulse webhook integration

### Technology Stack

- **Frontend**: React with TypeScript, Tailwind CSS, Shadcn UI components
- **Backend**: Express.js with TypeScript, JWT authentication
- **Database**: PostgreSQL with Drizzle ORM
- **File Storage**: Google Cloud Storage for photos and documents
- **Background Jobs**: BullMQ with Redis for notifications and scheduling

---

## User Roles & Permissions

### Role Hierarchy

```
SUPER_ADMIN (Highest)
    ├── ADMIN
    ├── MANAGER
    ├── OEM_ADMIN
    │   └── DEALERSHIP_ADMIN
    │       ├── SHOWROOM_MANAGER
    │       └── SALES_PERSON
    └── PARTNER_ADMIN
        └── PARTNER_STAFF
```

### 1. SUPER_ADMIN

**Highest level access with complete system control**

**Can:**
- Create, edit, and DELETE all entities (OEMs, dealerships, showrooms, partners, users)
- Manage pricing rules, commissions, and billing configurations
- Access all data across all OEMs
- Delete users, pricing rules, and other critical resources
- View and manage all work orders and job cards system-wide

**Cannot:**
- Be restricted by state or OEM boundaries

**Use Case**: System administrators, platform owners

---

### 2. ADMIN

**Full read/write access WITHOUT delete permissions**

**Can:**
- Create and edit OEMs, dealerships, showrooms, partners
- Create and edit work orders, sales persons, allocations
- Manage pricing rules, service categories, vehicle models
- Create and edit Knowledge Hub resources
- Access all data across all OEMs

**Cannot:**
- Delete any entity (403 Forbidden on all DELETE operations)
- Delete users, partners, dealerships, work orders, etc.

**Use Case**: Operations managers who need full operational access but shouldn't delete critical data

---

### 3. MANAGER

**State-based READ-ONLY access with selective creation rights**

**Can:**
- **View** ALL OEMs (no state filtering on OEMs)
- **View** dealerships, showrooms, work orders, partners, job cards **filtered by allowedStates** (e.g., Karnataka, Kerala)
- **Create** work orders and sales persons (only for dealerships/showrooms in allowed states)
- Access dashboard analytics filtered by their allowed states

**Cannot:**
- Create partners or allocations
- Edit any entities (except work orders they create)
- Delete any resources
- Access entities outside their allowedStates
- Access payout settlement pages

**Frontend Behavior:**
- Add buttons shown ONLY for "Work Orders" and "Sales Persons"
- All other modules are view-only (no create/edit/delete buttons)

**Use Case**: Regional managers overseeing specific states

---

### 4. OEM_ADMIN

**Full access within a single OEM tenant**

**Can:**
- View and manage all dealerships, showrooms, and partners within their OEM
- Create and edit work orders, sales persons, allocations
- View all pricing rules, commissions, and billing data for their OEM
- View Knowledge Hub resources (cannot create/edit/delete)

**Cannot:**
- Access data from other OEMs
- Create or edit OEMs
- Delete any entities

**Use Case**: OEM operations team (e.g., Hyundai India admin)

---

### 5. DEALERSHIP_ADMIN

**Manages a single dealership and its showrooms**

**Can:**
- View and edit their own dealership details
- Manage showrooms under their dealership
- Create sales persons and showroom managers
- View work orders from their dealership
- Update dealership contact information, address, GSTIN, PAN

**Cannot:**
- Access other dealerships
- Create or manage partners
- Access system-wide pricing or commission settings

**Auto-Sync**: Contact email and phone sync from dealership to user profile on login

**Use Case**: Dealership owners or managers

---

### 6. SHOWROOM_MANAGER

**Manages a single showroom**

**Can:**
- View and edit their showroom details
- Create work orders for their showroom
- View job cards assigned to their showroom
- Update showroom contact information and address

**Cannot:**
- Access other showrooms
- Manage partners or allocations
- View or edit pricing rules

**Auto-Sync**: Contact email and phone sync from showroom to user profile on login

**Use Case**: Showroom branch managers

---

### 7. SALES_PERSON

**Creates work orders for their assigned showroom**

**Can:**
- Create work orders
- View work orders they created
- View job card status for their orders
- Update their profile information

**Cannot:**
- Edit showroom or dealership details
- Access pricing rules or commissions
- Manage partners or allocations

**Use Case**: Sales staff at showrooms who interact with customers

---

### 8. PARTNER_ADMIN

**Manages a partner organization (Studio or Installer)**

⚠️ **CRITICAL**: Partner accounts are **ONLY created via Pulse webhook integration**, not manually through the portal.

**Can:**
- View and update their partner profile
- View job cards assigned to their partner
- Update job card status (PENDING → IN_PROGRESS → COMPLETED)
- Upload pre-installation inspection photos (4 mandatory photos)
- Request e-warranty application (for partner-billed jobs)
- View their commission and payout reports

**Cannot:**
- Access other partners' data
- Create or assign work orders
- Access dealership or showroom information

**Login**: Uses email/username and password created during partner onboarding via Pulse

**Use Case**: Partner business owners

---

### 9. PARTNER_STAFF

**Staff member working under a PARTNER_ADMIN**

⚠️ **CRITICAL**: Partner staff accounts are **ONLY created via Pulse webhook integration**, not manually through the portal.

**Can:**
- View job cards assigned to their partner
- Update job card status and upload photos
- Complete pre-installation inspection
- Mark jobs as completed

**Cannot:**
- Edit partner profile
- View financial reports (commissions/payouts)
- Request e-warranty applications

**Use Case**: Technicians and field staff at partner locations

---

## Dashboard Module

### Overview

The Dashboard provides real-time analytics and insights into your operations. Access varies by role:

- **SUPER_ADMIN/ADMIN**: See all data across all OEMs
- **MANAGER**: See data filtered by their allowedStates
- **OEM_ADMIN**: See data for their OEM only
- **DEALERSHIP_ADMIN**: See data for their dealership
- **SHOWROOM_MANAGER**: See data for their showroom
- **PARTNER_ADMIN**: See their partner performance metrics

### Key Metrics

1. **Orders Overview**
   - Total orders this month
   - Pending orders requiring action
   - Completed orders
   - Growth percentages vs. last month

2. **Revenue Metrics**
   - Total revenue generated
   - Pending revenue (work in progress)
   - Commission payable to partners

3. **Partner Performance**
   - Active partners count
   - Average job completion time
   - Partner-wise breakdown

### Charts & Analytics

**Orders Trend (Line Chart)**
- Daily/Weekly/Monthly order volume
- Status breakdown (Draft, Pending, In Progress, Completed, Cancelled)

**Dealership Performance (Bar Chart)**
- Top performing dealerships by order volume
- Revenue contribution by dealership

**Vehicle Upsells (Pie Chart)**
- Distribution of vehicle models serviced
- Popular car segments (Sedan, SUV, Hatchback, etc.)

**Territory Performance (Map/Table)**
- State-wise order distribution
- Regional growth trends

**Service Popularity (Bar Chart)**
- Most requested service categories
- PPF packages breakdown (Full Body, Front, Custom)

**Monthly Trends**
- Year-over-year comparison
- Seasonal patterns

### Using the Dashboard

1. **Select Time Period**: Use date filters to view specific periods
2. **Export Reports**: Click export buttons to download CSV/PDF reports
3. **Drill Down**: Click on chart segments to view detailed breakdowns
4. **Refresh Data**: Dashboard auto-refreshes every 2 minutes

---

## Organizations Module

### OEM Management

**Who Can Access**: SUPER_ADMIN, ADMIN only

**What is an OEM?**
An OEM (Original Equipment Manufacturer) represents a car manufacturer like Hyundai, Maruti, Tata, etc. Each OEM is a separate tenant in the system.

**Creating an OEM**

1. Navigate to **Settings** → **Organization Management** → **OEMs** tab
2. Click **"+ Add OEM"**
3. Fill in required fields:
   - **Name**: OEM display name (e.g., "Hyundai India")
   - **Code**: Unique identifier (e.g., "HYUNDAI")
   - **Logo**: Upload company logo (optional)
   - **Contact Details**: Email, phone, address
4. Click **"Create OEM"**

**Editing an OEM**

1. Find the OEM in the list
2. Click the **Edit** icon
3. Update details and save

**Important Notes**:
- Only SUPER_ADMIN can delete OEMs
- Deleting an OEM will cascade to all its dealerships, showrooms, and data
- OEM codes must be unique

---

### Dealership Management

**Who Can Access**: SUPER_ADMIN, ADMIN, OEM_ADMIN

**What is a Dealership?**
A dealership represents an authorized dealer for an OEM (e.g., "Mumbai Hyundai Showroom"). Dealerships can have multiple showroom locations.

**Creating a Dealership**

1. Navigate to **Settings** → **Organization Management** → **Dealerships** tab
2. Click **"+ Add Dealership"**
3. Fill in required fields:
   - **Name**: Dealership name
   - **OEM**: Select the parent OEM(s) - supports multiple OEMs
   - **Contact Person**: Name of the dealership owner/manager
   - **Email & Phone**: Contact details
   - **Address**: Complete address with city, state, pincode
   - **GSTIN**: GST identification number
   - **PAN**: PAN card number
   - **State**: Important for MANAGER role filtering

4. Click **"Create Dealership"**

**Auto-User Creation**:
✅ Creating a dealership **automatically creates** a DEALERSHIP_ADMIN user account
- Username: Auto-generated from dealership name
- Password: `admin@123` (user should change on first login)
- Email: Uses dealership contact email

**Editing a Dealership**

1. Navigate to dealerships list
2. Click on the dealership card
3. Edit details in the modal
4. Save changes

**Important Notes**:
- Dealership names should be unique per OEM
- State field is critical for MANAGER role filtering
- GSTIN and PAN are mandatory for billing

---

### Showroom Management

**Who Can Access**: SUPER_ADMIN, ADMIN, OEM_ADMIN, DEALERSHIP_ADMIN

**What is a Showroom?**
A showroom is a physical location under a dealership where customers visit and place orders (e.g., "Mumbai Hyundai Andheri Showroom").

**Creating a Showroom**

1. Navigate to **Settings** → **Organization Management** → **Showrooms** tab
2. Click **"+ Add Showroom"**
3. Fill in required fields:
   - **Name**: Showroom name/branch name
   - **Dealership**: Select parent dealership
   - **Contact Person**: Showroom manager name
   - **Email & Phone**: Contact details
   - **Address**: Complete showroom address
   - **Operating Hours**: Business hours (optional)

4. Click **"Create Showroom"**

**Auto-User Creation**:
✅ Creating a showroom **automatically creates** a SHOWROOM_MANAGER user account
- Username: Auto-generated from showroom name (lowercase, no spaces)
- Password: `admin@123` (user should change on first login)
- Email: Uses showroom contact email

**Note on Username Generation**:
- Showroom name is converted to lowercase
- Spaces are removed
- Example: "Novelty Hyundai Court Road" → username: `noveltyhundaicourtroad`

**Managing Showroom Users**

**Sales Persons**:
- DEALERSHIP_ADMIN and SHOWROOM_MANAGER can create sales persons
- Navigate to showroom details → "Sales Persons" section
- Click "Add Sales Person"
- Fill in name, email, phone, password
- Sales persons can immediately start creating work orders

**Editing a Showroom**

1. Navigate to showrooms list
2. Click on showroom card
3. Update details and save

**Important Notes**:
- Showroom names must be unique within a dealership
- Contact email and phone auto-sync to SHOWROOM_MANAGER user on login
- Each showroom can have multiple sales persons

---

## Work Orders Module

### Overview

Work orders represent customer requests for PPF installation services. They follow a **draft-submit workflow** with manual partner allocation.

### Work Order Lifecycle

```
DRAFT → PENDING → ALLOCATED → IN_PROGRESS → COMPLETED → APPROVED
                                                ↓
                                           CANCELLED
```

**Status Definitions**:

- **DRAFT**: Work order saved but not submitted. Can be edited freely.
- **PENDING**: Submitted and awaiting partner allocation
- **ALLOCATED**: Partner has been assigned manually
- **IN_PROGRESS**: Partner has started the job
- **COMPLETED**: Partner has finished installation
- **APPROVED**: Final approval by dealership/admin
- **CANCELLED**: Order cancelled (can happen at any stage)
- **WARRANTY_REGISTRATION**: E-warranty has been registered with STEK India

### Creating a Work Order (SALES_PERSON Flow)

**Step 1: Customer Information**

1. Navigate to **Work Orders** → **"+ Create Work Order"**
2. Fill in customer details:
   - Customer Name (required)
   - Phone Number (required)
   - Email (optional)
   - Address (optional)

**Step 2: Vehicle Information**

3. Select vehicle details:
   - **OEM**: Select car manufacturer
   - **Vehicle Model**: Select from dropdown (filtered by OEM)
   - **Registration Number**: Enter vehicle registration
   - **Variant**: Enter variant name (optional)
   - **Color**: Select vehicle color
   - **Manufacturing Year**: Enter year

**Step 3: Service Selection**

4. Choose PPF services:
   - Select one or more service categories
   - Options: Full Body PPF, Front PPF, Roof PPF, Hood PPF, Custom PPF, etc.
   - Pricing will auto-calculate based on configured rules

**Step 4: Billing & Shipping**

5. Configure billing details:
   - **Bill From**: Auto-populated based on rules (Dealership/OEM/Partner)
   - **Bill To**: Customer or Showroom (based on configuration)
   - **Ship To**: Showroom address (where car will be serviced)

**Step 5: Additional Details**

6. Add optional information:
   - Customer remarks
   - Special instructions for partner
   - Internal notes (not visible to partner)

**Step 6: Save or Submit**

- **Save as Draft**: Click "Save Draft" to save and continue later
- **Submit Order**: Click "Submit" to send to PENDING status for partner allocation

### Manual Partner Allocation (ADMIN/OEM_ADMIN Flow)

**When**: After work order is PENDING

**Who Can Allocate**: SUPER_ADMIN, ADMIN, OEM_ADMIN, DEALERSHIP_ADMIN

**Steps**:

1. Navigate to **Work Orders** → Filter by "Pending" status
2. Click on a pending work order
3. In the work order details, click **"Allocate Partner"**
4. View suggested partners:
   - Partners are shown based on:
     - Service category expertise
     - Geographic proximity
     - Current workload
     - Priority score
5. Select a partner from the dropdown
6. Choose billing mode:
   - **Partner Billed**: Partner will bill the customer directly
   - **Dealership Billed**: Dealership bills customer, pays partner
7. Click **"Allocate"**

**What Happens After Allocation**:
✅ Work order status → ALLOCATED
✅ Job card automatically created for the partner
✅ Partner receives WhatsApp and email notification
✅ Partner can now view the job card in their dashboard

### Editing Work Orders

**Draft Status**: Full editing allowed
**Pending Status**: Limited editing allowed
**Allocated/In Progress**: Cannot edit customer or service details
**Completed/Approved**: Read-only

### Cancelling Work Orders

**Who Can Cancel**: SUPER_ADMIN, ADMIN, OEM_ADMIN, DEALERSHIP_ADMIN

**Steps**:
1. Open work order details
2. Click **"Cancel Order"** button
3. Enter cancellation reason
4. Confirm cancellation

**Cascade Effects**:
⚠️ Cancelling a work order will:
- Cancel associated job card
- Void pending commissions
- Remove from payout calculations
- Send cancellation notification to partner

### Viewing Work Orders

**Filters Available**:
- Status (Draft, Pending, Allocated, In Progress, Completed, etc.)
- Date range
- OEM
- Dealership
- Showroom
- Partner
- Service category

**Bulk Actions**:
- Export to CSV/Excel
- Bulk status update (SUPER_ADMIN only)

**Search**:
- Search by customer name, phone, registration number, work order number

---

## Job Cards Module

### Overview

Job cards are created automatically when a partner is allocated to a work order. They track the installation work from partner's perspective.

### Job Card Lifecycle

```
PENDING → IN_PROGRESS → COMPLETED → APPROVED
    ↓
CANCELLED
```

**Status Definitions**:

- **PENDING**: Job card created, partner not started yet
- **IN_PROGRESS**: Partner has begun work (pre-installation photos uploaded)
- **COMPLETED**: Partner has finished installation and submitted
- **APPROVED**: Work approved by dealership/admin
- **CANCELLED**: Job cancelled (due to work order cancellation)

### Pre-Installation Inspection (Critical Step)

**Mandatory Requirement**: Before starting work, partners **MUST** upload 4 labeled photos:

1. **Front View**: Front of the vehicle
2. **Back View**: Rear of the vehicle
3. **Left Side View**: Driver side
4. **Right Side View**: Passenger side

**Each photo can have**:
- Optional remarks/notes
- Timestamp (auto-captured)
- Stored securely in Google Cloud Storage with private ACL

**Why Mandatory?**:
- Documents vehicle condition before work
- Protects partner from damage claims
- Required for warranty claims
- Quality control measure

**Partner Flow**:

1. Partner logs in and sees assigned job cards
2. Opens job card details
3. Clicks **"Pre-Installation Inspection"**
4. Uploads 4 photos with labels
5. Adds optional remarks for each photo
6. Clicks **"Complete Inspection"**
7. **"Start Work"** button becomes enabled
8. Clicks "Start Work" → Status changes to IN_PROGRESS

### Work Order Status Synchronization (Nov 2025)

⚠️ **Automatic Sync**: Job card status changes automatically update the parent work order status:

- Job card → IN_PROGRESS ⇒ Work order → IN_PROGRESS
- Job card → COMPLETED ⇒ Work order → COMPLETED
- Job card → APPROVED ⇒ Work order → APPROVED

This ensures consistent status tracking across the system.

### Partner Updates Job Card

**During Work (IN_PROGRESS)**:

Partners can:
- Add progress notes
- Upload work-in-progress photos
- Update estimated completion time
- Add consumed material details (for billing)

**Completing the Job**:

1. Partner clicks **"Mark as Completed"**
2. Uploads final installation photos (optional but recommended)
3. Adds completion remarks
4. Submits for approval
5. Status → COMPLETED

### E-Warranty Application

**Two Separate Flows**:

**Flow 1: Partner E-Warranty Request** (for partner-billed jobs)
- **Who**: Partner can request
- **When**: After job completion
- **Action**: Click "Request E-Warranty"
- **Result**: Notification email sent to STEK India team
- **Data**: Includes customer details, vehicle info, services performed
- **Warranty Reference**: NOT required at this stage

**Flow 2: Admin Warranty Registration**
- **Who**: SUPER_ADMIN, ADMIN, OEM_ADMIN
- **When**: After receiving warranty reference number from STEK
- **Action**: Click "Register Warranty" → Enter warranty reference number
- **Result**: Status changes to WARRANTY_REGISTRATION
- **Data**: Warranty reference stored in job card

### Approval Process (DEALERSHIP_ADMIN/OEM_ADMIN)

1. Review completed job card
2. Check uploaded photos and quality
3. Verify services performed
4. Options:
   - **Approve**: Click "Approve" → Status → APPROVED
   - **Request Rework**: Click "Request Changes" → Add notes → Send back to partner
   - **Reject**: Rare, used for major quality issues

**What Happens on Approval**:
✅ Commissions are finalized
✅ Payouts are calculated
✅ Work order marked as APPROVED
✅ Partner receives approval notification

### Viewing Job Cards

**Partner View**:
- See only job cards assigned to their partner
- Filter by status
- View customer details, services, billing info

**Admin/Dealership View**:
- See all job cards (filtered by OEM/Dealership)
- Monitor SLA compliance
- Track partner performance
- View financial details (commissions, payouts)

**Filters**:
- Status
- Date range
- Partner
- Dealership
- Service category
- SLA status (On Time / Delayed)

---

## Partner Management

### ⚠️ CRITICAL: Partner Creation via Pulse Webhook ONLY

**Partners are NOT created manually in this portal.**

Partners and their admin users are created **exclusively through the Pulse system** via webhook integration.

### How Partner Creation Works

**External System: Pulse**
- Pulse is a separate partner management system
- When a new partner is onboarded in Pulse, it triggers a webhook to Pulse VAS

**Webhook Endpoint**: `POST /api/webhooks/pulse/user-access`

**Security**:
- HMAC-SHA256 signature verification
- Timestamp validation (5-minute window)
- Uses `PULSE_WEBHOOK_SECRET` for authentication

**Webhook Payload Example**:

```json
{
  "action": "ACTIVATE",
  "partner": {
    "id": "partner-uuid-from-pulse",
    "displayName": "XYZ Auto Studio",
    "type": "STUDIO",
    "email": "contact@xyzauto.com",
    "phone": "+919876543210",
    "contactPersonName": "Rajesh Kumar",
    "address": "123 MG Road",
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560001",
    "gstin": "29ABCDE1234F1Z5",
    "pan": "ABCDE1234F"
  },
  "user": {
    "email": "admin@xyzauto.com",
    "username": "xyzauto_admin",
    "password": "temporary_password_123",
    "role": "PARTNER_ADMIN"
  },
  "timestamp": "2025-11-24T10:30:00Z",
  "signature": "hmac_sha256_signature_here"
}
```

**What Pulse VAS Does**:

1. **Validates Signature**: Verifies HMAC-SHA256 signature
2. **Checks Timestamp**: Ensures request is within 5-minute window (prevents replay attacks)
3. **Creates/Updates Partner**: Creates partner record in database
4. **Creates User Account**: 
   - Creates PARTNER_ADMIN user with provided credentials
   - Links user to partner via `partnerId`
   - Sets email and phone as verified
5. **Sends Welcome Email**: Optional notification to partner
6. **Returns Success**: Confirms partner activation

**Actions Supported**:

- **ACTIVATE**: Create new partner and user, or reactivate existing
- **DEACTIVATE**: Disable partner and user accounts
- **UPDATE**: Update partner details (not commonly used)

### Managing Existing Partners in Portal

**What Admins CAN Do**:

✅ **View Partner Details**: All partner information
✅ **Edit Partner Profile**: Update contact details, address, GSTIN, PAN
✅ **Manage Service Categories**: Assign which services partner can perform
✅ **Manage Allocations**: Define partner's service areas (dealerships/showrooms)
✅ **View Performance**: See job completion rates, SLA compliance
✅ **View Financials**: Commission reports, payout history
✅ **Reset Password**: Reset partner admin password if needed

**What Admins CANNOT Do**:

❌ Create new partners manually (use Pulse system)
❌ Delete partners (managed via Pulse webhook DEACTIVATE)
❌ Change partner type (STUDIO/INSTALLER)

### Viewing Partners

1. Navigate to **Partners** in main menu
2. View partner list with filters:
   - Partner type (Studio / Installer)
   - State
   - Service categories
   - Active/Inactive status

3. Click on a partner to view:
   - Contact details
   - Service categories
   - Assigned dealerships/showrooms
   - Performance metrics
   - Job history
   - Commission summary

### Editing Partner Details

**Who Can Edit**: SUPER_ADMIN, ADMIN, OEM_ADMIN, DEALERSHIP_ADMIN

**Steps**:
1. Navigate to partner details page
2. Click **"Edit Partner"**
3. Update allowed fields:
   - Display name
   - Contact person name
   - Phone, email
   - Address, city, state, pincode
   - GSTIN, PAN
   - Bank details (for payouts)

4. Click **"Save Changes"**

### Partner Service Categories

**Purpose**: Define which types of PPF services a partner can perform

**Configuration**:
1. Open partner details
2. Navigate to "Service Categories" section
3. Click **"Manage Services"**
4. Select from available categories:
   - Full Body PPF
   - Front PPF
   - Roof PPF
   - Hood PPF
   - Custom PPF
   - Ceramic Coating
   - etc.
5. Save selections

**Impact**: Only partners with matching service categories will appear in allocation suggestions

### Partner Allocations

**Purpose**: Define geographical service areas for partners

**Types**:
- **Dealership Level**: Partner serves all showrooms under a dealership
- **Showroom Level**: Partner serves specific showrooms only

**Configuration**:
1. Navigate to partner details
2. Go to "Allocations" tab
3. Click **"Add Allocation"**
4. Select:
   - **Level**: Dealership or Showroom
   - **Location**: Choose dealership/showroom
   - **Priority**: 1-10 (higher = preferred partner)
   - **Is Primary**: Mark as primary partner for location
   - **Billing Type**: Partner-billed or Dealership-billed

5. Save allocation

**Priority System**:
- During work order allocation, partners are sorted by priority
- Higher priority partners appear first in suggestions
- Primary partners are highlighted

### Partner Login & Authentication

**Login Credentials**:
- Created by Pulse webhook during partner activation
- Username: Provided by Pulse (usually company-based)
- Password: Temporary password sent by Pulse
- Partner should change password on first login

**Login Flow**:
1. Partner visits portal login page
2. Enters email/username and password
3. System validates credentials
4. Retrieves allowed OEM IDs from `partner_oems` mapping
5. Generates JWT token with `allowedOemIds`
6. Partner can access their dashboard

**Multi-OEM Partners**:
- Some partners may serve multiple OEMs
- During login, partner selects which OEM context to work in
- Can switch OEM context from dropdown in header

### Partner Staff Accounts

**Created By**: Pulse webhook (action: ACTIVATE with role: PARTNER_STAFF)

**Permissions**:
- View job cards assigned to their partner
- Update job card status
- Upload photos and documents
- Cannot view financial reports
- Cannot edit partner profile

**Management**:
- Partner staff are managed in Pulse system
- Portal admins cannot create partner staff manually
- Password resets can be done by admins if needed

---

## Pricing & Commissions

### Pricing Engine

**Overview**: Hierarchical pricing rules automatically calculate work order prices

**Pricing Hierarchy** (Applied in order):

```
1. DEALERSHIP_PRICING (Highest priority)
2. OEM_PRICING (Fallback)
3. DEFAULT (System default)
```

**How It Works**:

When a work order is created with:
- OEM: Hyundai
- Dealership: Mumbai Hyundai
- Vehicle Model: Creta
- Service: Full Body PPF

System checks:
1. Is there a DEALERSHIP_PRICING rule for Mumbai Hyundai + Creta + Full Body PPF? → Use it
2. If not, is there an OEM_PRICING rule for Hyundai + Creta + Full Body PPF? → Use it
3. If not, use default price configured for the service category

### OEM-Level Pricing (Nov 2025 Feature)

**Purpose**: Set default prices for an entire OEM, reducing manual configuration

**Benefits**:
- Instead of configuring 13,800+ dealership-level rules
- Configure ~50 OEM-level rules (1 per OEM × Vehicle Model × Service)
- Dealerships automatically inherit OEM pricing unless overridden

**Creating OEM Pricing Rule**:

1. Navigate to **Pricing Rules** → **"+ Add Pricing Rule"**
2. Select:
   - **Type**: OEM Pricing
   - **OEM**: e.g., Hyundai
   - **Vehicle Model**: e.g., Creta
   - **Service Category**: e.g., Full Body PPF
3. Enter:
   - **Price**: ₹45,000
   - **Effective From**: Start date
   - **Effective To**: End date (optional)
4. Save rule

**Example**:
- OEM: Hyundai
- Model: Creta
- Service: Full Body PPF
- Price: ₹45,000

Now ALL Hyundai dealerships selling Creta Full Body PPF will use ₹45,000 unless they have a specific DEALERSHIP_PRICING override.

### Dealership-Level Pricing Override

**Purpose**: Set custom pricing for specific dealerships

**Use Case**: Premium dealerships, special promotions, regional pricing

**Creating Dealership Pricing Rule**:

1. Navigate to **Pricing Rules** → **"+ Add Pricing Rule"**
2. Select:
   - **Type**: Dealership Pricing
   - **Dealership**: e.g., Mumbai Hyundai Premium
   - **Vehicle Model**: e.g., Creta
   - **Service Category**: e.g., Full Body PPF
3. Enter:
   - **Price**: ₹50,000 (premium pricing)
4. Save rule

This overrides the OEM-level price of ₹45,000 for this specific dealership.

### Viewing & Managing Pricing Rules

**Filters**:
- Pricing type (OEM / Dealership)
- OEM
- Dealership
- Service category
- Vehicle model
- Active / Expired rules

**Bulk Actions**:
- Export to CSV
- Bulk update prices
- Clone rules to other dealerships

### Commission System

**Overview**: Automated commission calculations for partners based on completed jobs

**Commission Types**:

1. **Percentage-Based**: e.g., 15% of job value
2. **Fixed Amount**: e.g., ₹2,000 per job
3. **Tiered**: Different rates based on job value ranges

**Commission Rules Configuration**:

1. Navigate to **Commissions** → **"+ Add Commission Rule"**
2. Select:
   - **Partner**: Specific partner or "All Partners"
   - **Service Category**: Which services this applies to
   - **Commission Type**: Percentage or Fixed
3. Enter:
   - **Rate/Amount**: 15% or ₹2,000
   - **Min Cap**: Minimum commission (optional)
   - **Max Cap**: Maximum commission (optional)
4. Set effective dates
5. Save rule

**Example Commission Rules**:

```
Partner: XYZ Studio
Service: Full Body PPF
Type: Percentage
Rate: 15%
Min Cap: ₹3,000
Max Cap: ₹10,000
```

If job value = ₹40,000:
- Commission = 15% of ₹40,000 = ₹6,000 ✅ (within min-max range)

If job value = ₹15,000:
- Commission = 15% of ₹15,000 = ₹2,250
- But Min Cap = ₹3,000
- Actual Commission = ₹3,000 ✅

### Commission Approval Flow

1. Job card approved → Commission auto-calculated
2. Commission moves to "Pending Approval" state
3. Admin reviews commission details
4. Admin approves or adjusts commission
5. Approved commissions move to payouts

### Payouts

**Overview**: Consolidated partner payments for approved commissions

**Payout Cycle**:
- Monthly (configurable)
- Bi-weekly (configurable)
- On-demand (admin-triggered)

**Generating Payouts**:

1. Navigate to **Payouts** → **"Generate Payout"**
2. Select:
   - **Partner**: Choose partner or "All Partners"
   - **Date Range**: Commission period
3. Review:
   - List of approved commissions
   - Total payout amount
   - Bank details confirmation
4. Click **"Generate Payout"**
5. Status → PENDING

**Payout Settlement**:

1. Admin processes bank transfer externally
2. Returns to portal → Payouts → Pending
3. Clicks **"Mark as Paid"**
4. Enters:
   - Payment reference number
   - Payment date
   - Payment mode (NEFT/RTGS/UPI/Cheque)
5. Status → PAID

**Partner View**:
- Partners can view their payout history
- See pending commissions
- Download payout statements

---

## Knowledge Hub

### Overview

Knowledge Hub is a centralized resource library for:
- Training materials
- Product documentation
- Offers and promotions
- Installation guides
- Marketing materials
- Communication templates

### Permissions

- **SUPER_ADMIN**: Create, edit, delete resources
- **ADMIN**: Create, edit resources (cannot delete)
- **OEM_ADMIN, MANAGER**: View-only
- **All Other Roles**: View-only (filtered by applicable roles)

### Resource Categories

1. **Knowledge Base**: Technical documentation, installation guides
2. **Offers**: Promotional offers, discounts, seasonal campaigns
3. **Communication**: Email templates, WhatsApp message templates
4. **Training**: Video tutorials, certification programs
5. **Marketing**: Brochures, presentations, social media content

### Content Types

- **PDF**: Documents, brochures, certificates
- **Video**: MP4 video files
- **YouTube**: YouTube video links
- **Link**: External URLs
- **Image**: Photos, infographics

### Creating a Resource

**Who Can Create**: SUPER_ADMIN, ADMIN

**Steps**:

1. Navigate to **Knowledge Hub**
2. Click **"+ Add Resource"**
3. Fill in details:
   - **Title**: Resource name (required)
   - **Category**: Select from dropdown (required)
   - **Content Type**: PDF/Video/YouTube/Link/Image (required)
   - **File/URL**: Upload file OR paste external link
   - **Description**: Brief summary (optional)
   - **Applicable To**: Select roles who can access (required)
     - Options: ALL, PARTNER_ADMIN, PARTNER_STAFF, OEM_ADMIN, DEALERSHIP_ADMIN, etc.
   - **Active Status**: Enable/Disable visibility

4. Click **"Create Resource"**

**Applicable To Logic**:
- If "ALL" selected → Visible to everyone
- If specific roles selected → Only those roles see it
- Partners only see resources marked for PARTNER_ADMIN/PARTNER_STAFF

### Managing Resources

**Editing**:
1. Find resource in Knowledge Hub
2. Click **Edit** icon (pencil)
3. Update details
4. Save changes

**Deleting** (SUPER_ADMIN only):
1. Find resource
2. Click **Delete** icon (trash)
3. Confirm deletion
4. Resource is permanently removed

**Viewing Analytics**:
- View count tracked per resource
- Last accessed date
- Popular resources report

### Filters & Search

**Available Filters**:
- Category (Knowledge Base, Offers, Communication, etc.)
- Content Type (PDF, Video, YouTube, Link, Image)
- Status (Active / Inactive)

**Search**:
- Search by title or description
- Full-text search across all fields

**Sorting**:
- Newest first
- Most viewed
- Alphabetical

### User Experience

**All Users**:
1. Navigate to Knowledge Hub
2. Browse or search for resources
3. Click on resource card to view details
4. Download files or open links
5. View count increments automatically

**Partners**:
- See only resources applicable to partners
- Access training materials for job requirements
- Download installation guides
- View current offers to communicate to customers

---

## Settings & User Management

### User Management

**Access**: SUPER_ADMIN only (can delete users), ADMIN can view/create/edit

**User List View**:
1. Navigate to **Settings** → **Users** tab
2. View all system users
3. Filter by:
   - Role (SUPER_ADMIN, ADMIN, MANAGER, OEM_ADMIN, etc.)
   - Status (Active / Inactive)
   - Search by name, email, phone

### Creating Users Manually

**When to Create Manually**:
- SUPER_ADMIN users
- ADMIN users
- MANAGER users
- Additional OEM_ADMIN users

**Auto-Created Users** (Don't create manually):
- DEALERSHIP_ADMIN (created with dealership)
- SHOWROOM_MANAGER (created with showroom)
- SALES_PERSON (created via showroom management)
- PARTNER_ADMIN (created via Pulse webhook)
- PARTNER_STAFF (created via Pulse webhook)

**Steps to Create User**:

1. Navigate to **Settings** → **Users**
2. Click **"+ Add User"**
3. Fill in details:
   - **Name**: Full name
   - **Email**: Work email (required, must be unique)
   - **Phone**: Contact number
   - **Role**: Select from dropdown
   - **Password**: Temporary password (user should change)
   - **For MANAGER role**:
     - **Allowed States**: Select states (e.g., Karnataka, Kerala)

4. Click **"Create User"**

**Manager-Specific Fields**:
- **Allowed States**: Multi-select dropdown
- Only users in dealerships/showrooms from these states will be visible to MANAGER

### Editing Users

**Who Can Edit**: SUPER_ADMIN, ADMIN (for non-SUPER_ADMIN users)

**Steps**:
1. Find user in list
2. Click **Edit** icon
3. Update allowed fields:
   - Name
   - Phone
   - Active status
   - For MANAGER: Update allowed states
4. Cannot change:
   - Email (used for login)
   - Role (create new user if role change needed)

### Deleting Users

**Who Can Delete**: SUPER_ADMIN ONLY

⚠️ **Important Restrictions**:
- SUPER_ADMIN cannot delete their own account (self-deletion prevented)
- ADMIN cannot delete any users (403 Forbidden)
- Deletion is permanent and cannot be undone

**Steps**:
1. Navigate to user in Settings → Users
2. Click **Delete** icon (trash)
3. Confirm: "Are you sure you want to delete [User Name]? This action cannot be undone."
4. User is permanently removed from system

**When to Delete**:
- Employee left organization
- Duplicate accounts
- Test accounts cleanup

**Alternative to Deletion**:
- Consider marking user as "Inactive" instead
- Inactive users cannot log in but data is preserved
- Can be reactivated later if needed

### Password Management

**Resetting User Password**:

**Who Can Reset**: SUPER_ADMIN, OEM_ADMIN, DEALERSHIP_ADMIN (for their users)

**Steps**:
1. Navigate to user details
2. Click **"Reset Password"**
3. System generates temporary password (8 characters)
4. Copy temporary password and share securely with user
5. User must change password on next login

**Example Temporary Password**: `AB12CD34`

**Self-Service Password Change**:
1. User logs in with temporary password
2. System prompts "Password Change Required"
3. User enters:
   - Current password
   - New password
   - Confirm new password
4. Password updated successfully

### Profile Settings

**For All Users**:

1. Navigate to **Settings** → **Profile** tab
2. View/Edit:
   - Profile photo (upload image)
   - Display name
   - Email (read-only, contact admin to change)
   - Phone number
   - Preferred language (EN/HI)
   - Theme preference (Light/Dark - coming soon)

**For DEALERSHIP_ADMIN**:
- Organization Name (read-only, synced from dealership)
- Username (Login ID) displayed
- Contact details auto-sync from dealership

**For SHOWROOM_MANAGER**:
- Showroom Name (read-only, synced from showroom)
- Username (Login ID) displayed
- Contact details auto-sync from showroom

### Organization Management (SUPER_ADMIN Only)

**Tabs**:
1. **OEMs**: Create and manage OEMs
2. **Dealerships**: Create and manage dealerships
3. **Showrooms**: Create and manage showrooms

**See detailed instructions in "Organizations Module" section above**

### System Settings (SUPER_ADMIN Only)

**Email Configuration**:
- SMTP server settings
- From email address
- Email templates

**WhatsApp Configuration**:
- Meta WABA credentials (stored as secrets)
- Message templates
- Webhook configuration

**Storage Configuration**:
- Google Cloud Storage bucket
- Public/Private directory paths
- File size limits

**Job Settings**:
- SLA thresholds (hours)
- Auto-reminder schedules
- Notification preferences

**Billing Settings**:
- Default billing rules
- GST rates
- Invoice numbering format

---

## Troubleshooting & Best Practices

### Common Issues

#### Issue: "Username already exists" when creating showroom

**Cause**: Another showroom has a similar name that generates the same username

**Solution**:
1. Check existing showrooms with similar names
2. Add a unique identifier to showroom name (e.g., "Mumbai Hyundai Andheri" instead of just "Mumbai Hyundai")
3. Or manually create the user with a custom username first

#### Issue: Work order pricing shows "0.00"

**Cause**: No pricing rule configured for that OEM + Vehicle Model + Service combination

**Solution**:
1. Navigate to Pricing Rules
2. Check if OEM_PRICING exists for that vehicle model + service
3. If not, create OEM_PRICING rule
4. Or create DEALERSHIP_PRICING override
5. Edit work order to recalculate price

#### Issue: Partner not appearing in allocation dropdown

**Cause**: Partner doesn't have required service category assigned OR not allocated to that dealership/showroom

**Solution**:
1. Open partner details
2. Check "Service Categories" → Ensure correct service is selected
3. Check "Allocations" → Ensure partner is allocated to the dealership/showroom
4. Refresh work order page and retry

#### Issue: MANAGER role cannot see any data

**Cause**: No data exists in their allowed states OR allowedStates not configured

**Solution**:
1. Check user profile → Verify allowedStates is set (e.g., Karnataka, Kerala)
2. Check if dealerships exist in those states
3. If dealerships have NULL state → Update dealership state field
4. Run SQL update to fix NULL states (contact SUPER_ADMIN)

#### Issue: Partner cannot upload pre-installation photos

**Cause**: File size too large OR wrong file format OR storage permissions issue

**Solution**:
1. Ensure image files are < 10MB each
2. Use supported formats: JPG, PNG, HEIC
3. Check internet connection (upload requires stable connection)
4. If issue persists, contact SUPER_ADMIN to check Google Cloud Storage permissions

#### Issue: Email notifications not sending

**Cause**: SMTP configuration issue OR email service credentials expired

**Solution**:
1. Check Settings → System Settings → Email Configuration
2. Verify SMTP server settings are correct
3. Test email connection
4. Check AWS SES console for errors (if using AWS SES)
5. Verify email templates are configured

#### Issue: WhatsApp notifications not sending

**Cause**: Meta WABA credentials invalid OR template not approved OR phone number invalid

**Solution**:
1. Check Meta Business Manager for WABA status
2. Verify phone number format: +91XXXXXXXXXX (include country code)
3. Check message templates are approved by Meta
4. Verify webhook secrets are correct
5. Check BullMQ queue for failed jobs

---

### Best Practices

#### Data Entry

1. **Consistent Naming**: Use consistent naming conventions for dealerships, showrooms
   - Good: "Mumbai Hyundai Andheri", "Mumbai Hyundai Bandra"
   - Bad: "Hyundai Mumbai 1", "Hyundai Dealer 2"

2. **Complete Addresses**: Always fill complete address with pincode
   - Required for geolocation and partner allocation
   - Required for accurate billing

3. **Valid Contact Details**: Ensure email and phone numbers are correct
   - Auto-sync depends on accurate contact info
   - Notifications will fail if contact details are wrong

4. **State Field**: ALWAYS fill the state field for dealerships
   - Critical for MANAGER role filtering
   - Required for regional analytics

#### Partner Management

1. **Service Categories**: Assign accurate service categories to partners
   - Improves allocation suggestions
   - Prevents mismatched allocations

2. **Allocations**: Configure partner allocations before creating work orders
   - Saves time during manual allocation
   - Enables auto-suggestion features

3. **Priority Scores**: Use priority scores strategically
   - High priority (8-10): Preferred, reliable partners
   - Medium priority (5-7): Backup partners
   - Low priority (1-4): New or less reliable partners

#### Pricing Rules

1. **Start with OEM Pricing**: Configure OEM-level pricing first
   - Covers majority of scenarios
   - Easy to maintain

2. **Dealership Overrides**: Only create dealership overrides when necessary
   - For premium locations
   - For special promotions
   - For regional pricing differences

3. **Effective Dates**: Always set effective dates for pricing rules
   - Prevents stale pricing
   - Easy to track pricing history
   - Plan future price changes in advance

#### Work Order Management

1. **Use Draft Status**: Encourage sales persons to use draft status
   - Allows time to gather complete information
   - Can be reviewed before submission
   - Prevents incomplete orders

2. **Verify Before Allocation**: Double-check work order details before allocating partner
   - Customer contact details
   - Service requirements
   - Vehicle information

3. **Communication**: Add clear notes in "Special Instructions"
   - Helps partners understand requirements
   - Reduces back-and-forth communication

#### User Management

1. **Disable Instead of Delete**: When employee leaves, mark as inactive instead of deleting
   - Preserves audit trail
   - Can be reactivated if they return
   - Historical data remains intact

2. **Regular Password Resets**: Encourage password changes every 90 days
   - Improves security
   - Prevent unauthorized access

3. **Role Assignment**: Assign minimal required role
   - Don't make everyone ADMIN
   - Use MANAGER for regional oversight
   - Use OEM_ADMIN for OEM operations team

#### Performance Optimization

1. **Use Filters**: Always use filters when viewing large lists
   - Faster page load
   - Easier to find specific records
   - Reduces server load

2. **Export Reports**: Use CSV export for large datasets
   - Better than viewing in browser
   - Can analyze in Excel/Google Sheets
   - Reduces browser memory usage

3. **Regular Cleanup**: Archive or delete old draft work orders
   - Improves system performance
   - Easier to manage active orders

---

### Security Best Practices

1. **Strong Passwords**: Enforce strong passwords for all users
   - Minimum 8 characters
   - Mix of letters, numbers, symbols
   - No common words or patterns

2. **Secrets Management**: Never share webhook secrets or API keys
   - Stored securely in environment variables
   - Only SUPER_ADMIN should access
   - Rotate secrets periodically

3. **Access Control**: Review user permissions regularly
   - Remove inactive users
   - Audit SUPER_ADMIN access
   - Monitor for unauthorized access attempts

4. **Data Privacy**: Follow data privacy regulations
   - Don't share customer phone/email unnecessarily
   - Use secure channels for sensitive data
   - Regular data backup and recovery testing

---

### Getting Help

**For Technical Issues**:
- Contact system administrator (SUPER_ADMIN)
- Check application logs
- Review error messages carefully

**For Process Questions**:
- Refer to this guide
- Contact your OEM admin or dealership admin
- Training resources in Knowledge Hub

**For Feature Requests**:
- Submit to product team
- Discuss with SUPER_ADMIN
- Prioritize based on business impact

---

## Appendix

### Glossary

- **OEM**: Original Equipment Manufacturer (car manufacturer)
- **PPF**: Paint Protection Film
- **GSTIN**: Goods and Services Tax Identification Number
- **PAN**: Permanent Account Number
- **SLA**: Service Level Agreement
- **RBAC**: Role-Based Access Control
- **JWT**: JSON Web Token (authentication)
- **HMAC**: Hash-based Message Authentication Code
- **Webhook**: Automated HTTP callback for system integration

### System Limits

- Max file upload size: 10 MB
- Max work orders per page: 50
- Max bulk partner fetch: 100
- Password reset link expiry: 24 hours
- JWT token expiry: 7 days
- Session timeout: 30 minutes of inactivity

### Contact Information

**System Support**: [Your support email]
**Technical Issues**: [Your tech support email]
**Business Queries**: [Your business email]

---

**Document Version**: 1.0
**Last Updated**: November 24, 2025
**Next Review Date**: February 2026

---

*This guide is a living document and will be updated as new features are added and processes evolve.*
