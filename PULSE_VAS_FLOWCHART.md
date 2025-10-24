# Pulse VAS - Complete Business Process Flowchart

## Mermaid Diagram Code

Copy and paste this code into any Mermaid renderer (GitHub, Mermaid Live Editor, etc.)

```mermaid
graph TB
    subgraph ORG["🏢 ORGANIZATION HIERARCHY"]
        style ORG fill:#e1f5ff,stroke:#01579b,stroke-width:3px
        
        OEM["🏭 OEM / BRAND<br/>(Vehicle Manufacturer)"]
        DEAL["🏪 DEALERSHIP<br/>(Multi-location dealer)"]
        SHOW["🏬 SHOWROOM<br/>(Sales location)"]
        SALES["👤 SALES PERSON<br/>(Commission earner)"]
        
        OEM --> DEAL
        DEAL --> SHOW
        SHOW --> SALES
    end
    
    subgraph PARTNER["🤝 PARTNER NETWORK"]
        style PARTNER fill:#f3e5f5,stroke:#4a148c,stroke-width:3px
        
        PART["🔧 PARTNER<br/>(Studio/Installer)"]
        PSTAFF["👷 PARTNER STAFF<br/>(Detailer/Installer)"]
        ALLOC["📍 PARTNER ALLOCATION<br/>(Priority-based assignment)"]
        
        PART --> PSTAFF
        PART --> ALLOC
    end
    
    subgraph OPS["⚙️ OPERATIONS WORKFLOW"]
        style OPS fill:#fff3e0,stroke:#e65100,stroke-width:3px
        
        WO["📝 WORK ORDER<br/>(Customer request)"]
        WO_SUB["✅ Submit for Assignment"]
        AUTO["🤖 Auto-Assign Partner<br/>(Brand + Category + Priority)"]
        JC["🎫 JOB CARD<br/>(Execution tracking)"]
        
        JC_ACK["✓ Acknowledge (2hr SLA)"]
        JC_SCH["📅 Schedule"]
        JC_START["▶️ Start Work"]
        JC_COMP["✔️ Complete + Upload Proof"]
        JC_APP["👍 Approve"]
        
        WO --> WO_SUB
        WO_SUB --> AUTO
        AUTO --> JC
        JC --> JC_ACK
        JC_ACK --> JC_SCH
        JC_SCH --> JC_START
        JC_START --> JC_COMP
        JC_COMP --> JC_APP
    end
    
    subgraph PRICE["💰 PRICING SYSTEM (3 Layers)"]
        style PRICE fill:#e8f5e9,stroke:#1b5e20,stroke-width:3px
        
        DPRICE["💵 DEALERSHIP PRICING<br/>(What dealership pays)<br/>Scope: Dealership + Service + Vehicle"]
        PPRICE["💳 PARTNER PRICING<br/>(What partner charges)<br/>Scope: Partner + Showroom + Service + Vehicle"]
        DETPRICE["💸 DETAILER PRICING<br/>(What installer earns)<br/>Scope: Detailer + Service Category"]
        
        DPRICE -.->|"Sets billing value"| WO
        PPRICE -.->|"Used for partner invoice"| JC
        DETPRICE -.->|"Used for payout calculation"| JC
    end
    
    subgraph COMM["💎 COMMISSION SYSTEM"]
        style COMM fill:#fce4ec,stroke:#880e4f,stroke-width:3px
        
        CRULE["📋 COMMISSION RULE<br/>(8-level hierarchy)<br/>Percent or Fixed Amount<br/>Floor + Cap"]
        CCOMP["💰 COMMISSION CALCULATION<br/>Status: PENDING"]
        CFINAL["✨ COMMISSION FINALIZED<br/>Status: COMPUTED"]
        CPAID["💵 COMMISSION PAID<br/>Status: PAID"]
        
        CRULE --> CCOMP
        CCOMP --> CFINAL
        CFINAL --> CPAID
    end
    
    subgraph PAYOUT["💸 PAYOUT SYSTEM"]
        style PAYOUT fill:#fff9c4,stroke:#f57f17,stroke-width:3px
        
        PAUTO["🔄 Auto-Create Payout<br/>Status: pending_review<br/>Amount: ₹0"]
        PCALC["🧮 Calculate Payout<br/>(Lookup DETAILER_PRICING)<br/>Status: due"]
        PSETTLE["✅ Settle Payout<br/>Status: paid"]
        
        PAUTO --> PCALC
        PCALC --> PSETTLE
    end
    
    subgraph ROYAL["👑 OEM ROYALTY SYSTEM"]
        style ROYAL fill:#e0f2f1,stroke:#004d40,stroke-width:3px
        
        RRULE["📜 OEM ROYALTY RULE<br/>(Percentage of job value)<br/>Scope: OEM + Service Category"]
        RCALC["💎 ROYALTY CALCULATION<br/>(Job Value × Percentage)"]
        
        RRULE --> RCALC
    end
    
    subgraph BILLING["🧾 BILLING & INVOICING"]
        style BILLING fill:#f1f8e9,stroke:#33691e,stroke-width:3px
        
        BILL["📄 BILLING DETAILS<br/>Bill From: Partner or Default<br/>Bill To: OEM/Dealership/Showroom<br/>Ship To: Showroom"]
        INV["🧾 INVOICE GENERATION<br/>Based on PARTNER_PRICING"]
        
        BILL --> INV
    end
    
    subgraph NOTIF["🔔 NOTIFICATION SYSTEM"]
        style NOTIF fill:#ede7f6,stroke:#311b92,stroke-width:3px
        
        EMAIL["📧 Email<br/>(SMTP Direct)"]
        WA["💬 WhatsApp<br/>(Meta WABA - 5 templates)"]
        SMS["📱 SMS<br/>(SLA alerts)"]
        PUSH["🔔 Push<br/>(In-app)"]
    end
    
    subgraph AUDIT["📊 REPORTS & AUDIT"]
        style AUDIT fill:#efebe9,stroke:#3e2723,stroke-width:3px
        
        ALOG["📝 AUDIT LOG<br/>(All user actions)"]
        REP["📈 REPORTS<br/>(Financial, Operations, Analytics)"]
        DASH["📊 DASHBOARDS<br/>(Role-based views)"]
        
        ALOG --> REP
        REP --> DASH
    end
    
    %% Main Process Flow
    SHOW -->|"Creates"| WO
    SALES -.->|"Assigned to"| WO
    
    ALLOC -->|"Assigns to"| AUTO
    AUTO -->|"Creates"| JC
    JC -->|"Assigned to"| PSTAFF
    
    %% Pricing Triggers
    WO -->|"At creation"| DPRICE
    JC_APP -->|"At approval"| PPRICE
    JC_START -->|"When started"| PAUTO
    JC_APP -->|"When approved"| PCALC
    
    %% Commission Flow
    WO -->|"At creation"| CCOMP
    DPRICE -.->|"Estimated value"| CCOMP
    JC_APP -->|"Final value"| CFINAL
    CRULE -.->|"Rule lookup"| CCOMP
    SALES -.->|"Earns"| CPAID
    
    %% Payout Flow
    DETPRICE -.->|"Price lookup"| PCALC
    PSTAFF -.->|"Receives"| PSETTLE
    
    %% Royalty Flow
    JC_APP -->|"Triggers"| RCALC
    RRULE -.->|"Rule lookup"| RCALC
    OEM -.->|"Receives"| RCALC
    
    %% Billing Flow
    JC_APP -->|"Generates"| BILL
    PPRICE -.->|"Price source"| BILL
    BILL --> INV
    
    %% Notification Triggers
    JC -->|"Created"| WA
    JC -->|"Created"| EMAIL
    JC_ACK -->|"Overdue"| SMS
    JC_COMP -->|"Completed"| WA
    JC_APP -->|"Approved"| WA
    
    %% Audit Trail
    WO -.->|"Logs"| ALOG
    JC -.->|"Logs"| ALOG
    CFINAL -.->|"Logs"| ALOG
    PCALC -.->|"Logs"| ALOG
    
    %% Financial Reporting
    CPAID -->|"Aggregates"| REP
    PSETTLE -->|"Aggregates"| REP
    RCALC -->|"Aggregates"| REP
    INV -->|"Aggregates"| REP
    
    classDef orgStyle fill:#bbdefb,stroke:#0d47a1,stroke-width:2px
    classDef opsStyle fill:#ffe0b2,stroke:#e65100,stroke-width:2px
    classDef priceStyle fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    classDef finStyle fill:#f8bbd0,stroke:#c2185b,stroke-width:2px
    classDef sysStyle fill:#d7ccc8,stroke:#4e342e,stroke-width:2px
    
    class OEM,DEAL,SHOW,SALES,PART,PSTAFF,ALLOC orgStyle
    class WO,WO_SUB,AUTO,JC,JC_ACK,JC_SCH,JC_START,JC_COMP,JC_APP opsStyle
    class DPRICE,PPRICE,DETPRICE priceStyle
    class CRULE,CCOMP,CFINAL,CPAID,PAUTO,PCALC,PSETTLE,RRULE,RCALC,BILL,INV finStyle
    class EMAIL,WA,SMS,PUSH,ALOG,REP,DASH sysStyle
```

---

## How to Use This Flowchart

### 1. **View in GitHub**
Simply paste this into any `.md` file in GitHub and it will render automatically.

### 2. **View in Mermaid Live Editor**
Go to https://mermaid.live and paste the code between the ` ```mermaid ` tags.

### 3. **Export as Image**
Use Mermaid Live Editor to export as:
- PNG (high resolution)
- SVG (vector, scalable)
- PDF (print-ready)

---

## Legend & Flow Explanation

### 📊 **Subgraph Colors**

| Color | Module | Description |
|-------|--------|-------------|
| 🔵 **Light Blue** | Organization | Entity hierarchy (OEM → Dealership → Showroom → Sales) |
| 🟣 **Purple** | Partner Network | External installation partners and staff |
| 🟠 **Orange** | Operations | Work order and job card execution workflow |
| 🟢 **Green** | Pricing System | 3-layer pricing (Dealership, Partner, Detailer) |
| 🔴 **Pink/Red** | Financials | Commissions, payouts, royalties, billing |
| 🟤 **Brown** | System | Notifications, audit logs, reports |

### 🔄 **Arrow Types**

| Arrow | Meaning |
|-------|---------|
| `-->` Solid | Direct process flow / creates / triggers |
| `-.->` Dotted | Data reference / influences / uses |

### 📋 **Key Process Flows**

#### 1️⃣ **Order Creation Flow**
```
Showroom → Work Order → Dealership Pricing → Commission (PENDING)
```

#### 2️⃣ **Job Execution Flow**
```
Work Order → Auto-Assign → Job Card → Acknowledge → Schedule → Start → Complete → Approve
```

#### 3️⃣ **Payout Flow**
```
Job Started → Auto-Create Payout (pending_review) 
→ Job Approved → Calculate Payout (due) 
→ Admin Settlement → Payout Paid
```

#### 4️⃣ **Commission Flow**
```
Work Order Created → Commission (PENDING, estimated value)
→ Job Approved → Commission (COMPUTED, final value)
→ Admin Settlement → Commission (PAID)
```

#### 5️⃣ **Pricing Interaction**
```
- DEALERSHIP PRICING → Sets work order billing value (what dealership pays)
- PARTNER PRICING → Used for partner invoice (what partner charges)
- DETAILER PRICING → Used for payout calculation (what installer earns)
```

#### 6️⃣ **Financial Cascade**
```
Job Approved → Triggers 4 calculations:
1. Partner Pricing (invoice)
2. Detailer Payout (installer payment)
3. Commission Finalization (sales person earning)
4. OEM Royalty (brand fee)
```

---

## System Insights

### 💡 **Multi-Layer Pricing Strategy**

The system uses **3 independent pricing layers** to support different business models:

1. **Dealership Pricing**: What the dealership is charged for the service
2. **Partner Pricing**: What the installation partner charges (may be direct to customer)
3. **Detailer Pricing**: What the individual installer earns (payout)

This allows for:
- 🎯 Flexible margin management
- 🤝 Partner direct billing options
- 💰 Fair installer compensation
- 📊 Clear profit tracking at each level

### 💡 **Commission Hierarchy**

The system resolves commission rules through **8 priority levels**:

```
1. Showroom + SalesPerson + ServiceCategory (most specific)
2. Showroom + SalesPerson
3. Showroom + ServiceCategory
4. Dealership + SalesPerson + ServiceCategory
5. Dealership + SalesPerson
6. Dealership + ServiceCategory
7. OEM + ServiceCategory
8. OEM + SalesPerson (most general)
```

This ensures sales persons get the **most specific rate** that applies to them.

### 💡 **Partner Auto-Allocation**

When a work order is submitted, the system automatically assigns a partner using:

```
Priority 1: Showroom-level + Brand match + Service category + Active + Priority number
Priority 2: Dealership-level + Brand match + Service category + Active + Priority number
Priority 3: Basic allocation (no brand/category match)
```

This ensures the **most qualified partner** gets the job.

### 💡 **Financial Settlement Visibility**

Payout settlement displays based on **payout status**, not job card status:

- ✅ Shows: `pending_review`, `due`
- ❌ Hidden: `paid`

This means approved jobs remain visible for settlement even when job cards move to:
- PENDING_SALES_INVOICE
- INVOICE_RAISED
- WARRANTY_REGISTRATION
- PAYMENT_PENDING
- CLOSED

---

## Quick Reference: Who Does What?

| Role | Primary Actions | Financial Impact |
|------|----------------|------------------|
| **OEM Admin** | Manage dealerships, vehicles, OEM pricing | Sets dealership pricing rules |
| **Dealership Admin** | Manage showrooms, override pricing | Controls dealership-level pricing |
| **Showroom Manager** | Create work orders, approve jobs | Triggers commission calculation |
| **Sales Person** | Assigned to orders | Earns commission |
| **Partner Admin** | Manage jobs, staff | Receives payouts |
| **Partner Staff** | Execute installations | Earns individual payout |
| **Super Admin** | System configuration | All financial rules |

---

**Generated**: October 24, 2025  
**System**: Pulse VAS - PPF Management Platform  
**Version**: 1.0
