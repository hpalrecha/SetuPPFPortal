# Test Login Credentials

## Quick Reference
Use these credentials to log into the SetuPPF application for testing different user roles.

**Default Password for all accounts**: `password123`

---

## Partner Users (Multi-OEM Access)
These users have access to multiple OEMs and will see an OEM selector after login:

| Email | Role | Company | Password |
|-------|------|---------|----------|
| admin@delhippf.com | PARTNER_ADMIN | Delhi PPF Services | password123 |
| admin@mumbaicare.com | PARTNER_ADMIN | Mumbai Car Care | password123 |
| admin@blrppf.com | PARTNER_ADMIN | Bangalore PPF Solutions | password123 |

---

## ✅ Super Admin (WORKING)
Full system access:

| Email | Role | Access | Password |
|-------|------|---------|----------|
| admin@setuppf.com | SUPER_ADMIN | All OEMs & Data | password123 |

---

## OEM Users (Single OEM Access)
These users are tied to specific OEMs:

| Email | Role | OEM | Password |
|-------|------|-----|----------|
| admin@hyundai.com | OEM_ADMIN | Hyundai | password123 |
| admin@hyundaiindia.com | OEM_ADMIN | Hyundai India | password123 |
| admin@maruti.com | OEM_ADMIN | Maruti Suzuki | password123 |
| admin@tata.com | OEM_ADMIN | Tata Motors | password123 |

---

## Dealership Users

| Email | Role | Organization | Password |
|-------|------|--------------|----------|
| dealer@bangaloretata.com | DEALERSHIP_ADMIN | Bangalore Tata Dealer | password123 |
| dealer@delhimaruti.com | DEALERSHIP_ADMIN | Delhi Maruti Dealer | password123 |
| dealer@mumbaihyundai.com | DEALERSHIP_ADMIN | Mumbai Hyundai Dealer | password123 |

---

## Showroom Managers

| Email | Role | Showroom | Password |
|-------|------|----------|----------|
| manager@andherihyundai.com | SHOWROOM_MANAGER | Andheri Hyundai | password123 |
| manager@cpmaruti.com | SHOWROOM_MANAGER | CP Maruti | password123 |
| manager@koramangatata.com | SHOWROOM_MANAGER | Koramangala Tata | password123 |
| manager@ljmaruti.com | SHOWROOM_MANAGER | Lajpat Maruti | password123 |

---

## Sales Person

| Email | Role | Name | Password |
|-------|------|------|----------|
| rahul@gmail.com | SALES_PERSON | Rahul | password123 |

---

## Partner Staff (Detailers & Installers)

| Email | Role | Name | Password |
|-------|------|------|----------|
| detailer1@delhippf.com | PARTNER_STAFF | Arjun Detailer | password123 |
| detailer2@mumbaicare.com | PARTNER_STAFF | Priya Installer | password123 |
| detailer3@blrppf.com | PARTNER_STAFF | Suresh PPF Expert | password123 |
| installer1@blrppf.com | PARTNER_STAFF | Suresh Installer | password123 |
| installer1@delhippf.com | PARTNER_STAFF | Rajesh Installer | password123 |
| installer1@mumbaicare.com | PARTNER_STAFF | Amit Installer | password123 |

---

## How to Test Multi-Tenant Features

### Partner User Flow:
1. Login with any partner email (e.g., `admin@delhippf.com`)
2. You'll see an **OEM Selector** screen
3. Choose which OEM to work with (Mahindra, Tata, Maruti)
4. Access dashboard and features for that specific OEM
5. Can switch between OEMs by logging out and back in

### Regular User Flow:
1. Login with non-partner email (e.g., `admin@mahindra.com`)
2. Direct access to dashboard (no OEM selection needed)
3. Only see data for your assigned OEM

---

## Testing Notes
- All accounts are pre-populated with sample data
- Partner users can access multiple OEMs through the partner_oems mapping
- Non-partner users are restricted to their assigned OEM only
- Super admin can access all data across all OEMs

---

*Last Updated: December 12, 2025*