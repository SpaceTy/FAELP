# FALP Architecture Document

## First Aid Logistics Platform - Comprehensive Architecture Overview

---

## 1. Executive Summary

The **First Aid Logistics Platform (FALP)** is a platform for freely and temporarily distributing first aid education material to schools. It streamlines the process of schools requesting first aid education material for specific dates and returning it after use.

### Key Goals
- Enable schools to request first aid training materials for temporary use
- Route requests to optimal distribution centers based on availability and location
- Track inventory, packaging, and returns across multiple distribution centers
- Provide real-time updates on request status via live streaming

---

## 2. System Architecture Overview

### 2.1 High-Level Architecture

The system follows a **distributed microservices architecture** with clear separation between organizational coordination and logistics operations.

```mermaid
flowchart TB
    subgraph External["External Users"]
        Schools["Schools/Customers"]
    end

    subgraph FrontendLayer["Frontend Layer"]
        UserFrontend["User Frontend<br/>Preact - Planned"]
        LogisticsFrontend["Logistics Frontend<br/>Preact - Planned"]
        OrgAdminFrontend["Org Admin Frontend<br/>Preact - Planned"]
        DistAdminFrontend["Distribution Admin Frontend<br/>Preact - Planned"]
    end

    subgraph BackendLayer["Backend Layer"]
        OrgBackend["Organization Backend<br/>Go + PostgreSQL<br/>Implemented"]
        LogBackend["Logistics Backend<br/>Planned"]
    end

    subgraph DistributionBlock["Distribution Center Block"]
        DistCenter1["Distribution Center 1"]
        DistCenterN["Distribution Center N"]
    end

    Schools --> UserFrontend
    UserFrontend --> OrgBackend
    OrgBackend --> LogBackend
    LogBackend --> DistCenter1
    LogBackend --> DistCenterN
    
    LogisticsFrontend --> LogBackend
    OrgAdminFrontend --> OrgBackend
    DistAdminFrontend --> LogBackend
```

### 2.2 Component Breakdown

| Component | Technology | Status | Purpose |
|-----------|------------|--------|---------|
| **Organization Backend** | Go + PostgreSQL | Implemented | Central coordination, request routing, customer management |
| **Logistics Backend** | TBD | Planned | Distribution center operations, inventory, packaging, returns |
| **User Frontend** | Preact | Planned | School/customer interface for requesting materials |
| **Logistics Frontend** | Preact | Planned | Distribution center staff interface |
| **Org Admin Frontend** | Preact | Planned | Organization-wide administration |
| **Distribution Admin Frontend** | Preact | Planned | Per-distribution-center administration |

---

## 3. Organization Backend (orgbackend)

### 3.1 Overview

The Organization Backend is the **central coordination service** written in Go. It handles:
- Customer (school) management
- Request creation and lifecycle management
- Request routing to appropriate distribution centers
- Real-time updates via Server-Sent Events (SSE)

**Status**: Implemented  
**Location**: [`organization_backend/`](organization_backend/)  
**Database**: PostgreSQL

### 3.2 Project Structure

```
organization_backend/
├── cmd/server/
│   └── main.go                 # Application entry point
├── internal/
│   ├── api/
│   │   ├── handlers.go         # HTTP request handlers
│   │   └── routes.go           # Route definitions
│   ├── config/
│   │   └── config.go           # Configuration management
│   ├── db/
│   │   ├── db.go               # Database connection
│   │   ├── migrate.go          # Migration runner
│   │   ├── models.go           # Database models
│   │   ├── notify.go           # PostgreSQL NOTIFY/LISTEN
│   │   ├── queries.go          # SQL queries
│   │   └── migrations/         # SQL migrations
│   │       └── 001_init.sql
│   ├── domain/
│   │   ├── customer.go         # Customer domain model
│   │   └── request.go          # Request domain model
│   ├── service/
│   │   └── request_service.go  # Business logic
│   └── transport/
│       └── sse.go              # Server-Sent Events transport
├── config.yaml                 # Configuration file
├── go.mod                      # Go module definition
└── Makefile                    # Build automation
```

### 3.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/requests` | Create a new request |
| GET | `/requests` | List requests with pagination, search, filters |
| GET | `/requests/{id}` | Get a specific request by ID |
| GET | `/requests/{id}/subscribe` | Subscribe to real-time updates for a request (SSE) |
| GET | `/requests/subscribe` | Subscribe to real-time updates for list queries (SSE) |

### 3.4 Data Models

#### Domain Models

**Customer** ([`domain/customer.go`](organization_backend/internal/domain/customer.go)):
```go
type Customer struct {
    ID        string    `json:"id"`
    Email     string    `json:"email"`
    Name      string    `json:"name"`
    Token     string    `json:"token"`        // Authentication token
    CreatedAt time.Time `json:"createdAt"`
}
```

**Request** ([`domain/request.go`](organization_backend/internal/domain/request.go)):
```go
type Request struct {
    ID                   string          `json:"id"`
    Customer             Customer        `json:"customer"`
    Items                map[string]int  `json:"items"`        // materialTypeID -> quantity
    DeliveryDate         time.Time       `json:"deliveryDate"`
    Status               string          `json:"status"`       // pending | inAction | returned
    ShippingCustomerName string          `json:"shippingCustomerName"`
    ShippingAddress      ShippingAddress `json:"shippingAddress"`
    CreatedAt            time.Time       `json:"createdAt"`
    UpdatedAt            time.Time       `json:"updatedAt"`
    Metadata             map[string]any  `json:"metadata,omitempty"`
}
```

#### Database Schema

**Tables** ([`migrations/001_init.sql`](organization_backend/internal/db/migrations/001_init.sql)):

| Table | Description |
|-------|-------------|
| `customers` | School/customer information |
| `requests` | Request header data with shipping address |
| `request_items` | Line items for each request (material types + quantities) |
| `distribution_centers` | Distribution center locations |
| `material_available` | Inventory availability per distribution center |

**Key Indexes**:
- `requests_created_at_idx` - For pagination (newest first)
- `requests_updated_at_idx` - For live updates
- `requests_status_idx` - For filtering by status
- `requests_customer_idx` - For customer lookups

### 3.5 Live Update Strategy

The orgbackend implements **real-time updates** using PostgreSQL's NOTIFY/LISTEN mechanism:

1. **Database Trigger**: On INSERT/UPDATE/DELETE on `requests` table, a trigger fires `NOTIFY requests_channel` with a JSON payload containing `request_id`, `action`, and `updated_at`.

2. **Notifier Service** ([`db/notify.go`](organization_backend/internal/db/notify.go)): Maintains a persistent LISTEN connection to PostgreSQL and fans out updates to subscribed clients.

3. **SSE Transport** ([`transport/sse.go`](organization_backend/internal/transport/sse.go)): Streams events to HTTP clients using Server-Sent Events.

4. **Subscription Types**:
   - Single request subscription: Client receives updates only for a specific request ID
   - List subscription: Client receives updates for requests matching their query filters

### 3.6 Authentication Strategy

**For Schools (Customers)**:
- Token-based authentication
- Tokens are generated by the orgbackend and sent to schools via email with an access link
- Token is stored in the `customers.token` field

**For Distribution Center Staff**:
- Not yet implemented
- Planned: Conventional username/password authentication using an established library

---

## 4. Logistics Backend (logbackend)

### 4.1 Overview

The Logistics Backend handles **distribution center operations**. Each distribution center runs an instance of this backend to manage their local inventory and fulfill requests routed to them by the orgbackend.

**Status**: Planned (not yet implemented)  
**Location**: [`distribution_backend/`](distribution_backend/) (currently empty)

### 4.2 Responsibilities

| Function | Description |
|----------|-------------|
| **Inventory Management** | Track physical items, their condition, location, and availability |
| **Request Fulfillment** | Process incoming requests from orgbackend, reserve items |
| **Packaging** | Manage the packaging process for outgoing shipments |
| **Returns Processing** | Handle returned items, inspect condition, restock |
| **Material Instances** | Track individual physical items (not just types) with serial numbers |

### 4.3 Planned Data Models

**Material Instance**:
```
{
  id: string,              // Unique serial number
  typeId: string,          // References MaterialType
  status: "available" | "rented" | "returned" | "maintenance",
  useCount: number,        // Track wear and tear
  location: string,        // Current physical location
  currentAssignment: {
    requestId: string | null,
    customerId: string | null,
  },
  condition: "excellent" | "good" | "fair" | "needs_repair",
}
```

**Material Available**:
```
{
  materialTypeId: string,
  amount: number,          // Count of available items
  distributionCenterId: string,
}
```

### 4.4 Communication with OrgBackend

- **Protocol**: HTTPS requests
- **Authentication**: Custom auth system (details TBD)
- **Flow**:
  1. Orgbackend receives request from school
  2. Orgbackend determines optimal distribution center based on:
     - Material availability
     - Geographic proximity
     - Current workload
  3. Orgbackend forwards request to appropriate logbackend instance
  4. Logbackend confirms fulfillment capability
  5. Logbackend updates inventory and manages physical logistics

---

## 5. Frontend Architecture

### 5.1 Overview

The frontend is split into **four distinct interfaces** targeting different user roles.

**Status**: Demo implemented in vanilla HTML/CSS; real implementation planned in Preact  
**Location**: [`frontend/`](frontend/)

### 5.2 Frontend Components

| Frontend | Target Users | Purpose | Status |
|----------|--------------|---------|--------|
| **User Frontend** | Schools/Teachers | Browse materials, create requests, track orders | Demo implemented |
| **Logistics Frontend** | DC Staff/Volunteers | Process requests, manage packaging, handle returns | Demo implemented |
| **Org Admin Frontend** | Organization Admins | Oversee all distribution centers, manage customers | Not started |
| **Distribution Admin Frontend** | DC Admins | Manage single distribution center settings | Not started |

### 5.3 Demo Frontend Structure

**User Frontend** ([`frontend/user/`](frontend/user/)):
- [`page/index.html`](frontend/user/page/index.html) - Material catalog with filters
- [`page/my-requests.html`](frontend/user/page/my-requests.html) - Request history
- [`page/request-cart.html`](frontend/user/page/request-cart.html) - Shopping cart for requests
- [`page/profile.html`](frontend/user/page/profile.html) - User profile
- [`styles/styles.css`](frontend/user/styles/styles.css) - Stylesheet

**Logistics Frontend** ([`frontend/logistics/`](frontend/logistics/)):
- [`page/requests.html`](frontend/logistics/page/requests.html) - Incoming requests
- [`page/packaging.html`](frontend/logistics/page/packaging.html) - Packaging queue
- [`page/packing-detail.html`](frontend/logistics/page/packing-detail.html) - Packing detail view
- [`page/returns.html`](frontend/logistics/page/returns.html) - Returns processing
- [`page/return-detail.html`](frontend/logistics/page/return-detail.html) - Return detail view
- [`page/inventory.html`](frontend/logistics/page/inventory.html) - Inventory management
- [`styles/logistics.css`](frontend/logistics/styles/logistics.css) - Stylesheet

### 5.4 Planned Tech Stack

- **Framework**: Preact (React alternative, smaller bundle size)
- **Build Tool**: TBD (Vite or similar)
- **Styling**: CSS Modules or similar
- **State Management**: TBD
- **API Client**: Fetch API with custom wrappers

---

## 6. Material Catalog

### 6.1 Material Categories

The platform manages first aid training materials organized into three categories:

#### Reanimation (Resuscitation)
| Material ID | Name | Image |
|-------------|------|-------|
| `AED_Trainer` | AED Trainer | [`assets/material/Reanimation/AED_Trainer.webp`](frontend/user/assets/material/Reanimation/AED_Trainer.webp) |
| `Laerdal_Family_Satz` | Laerdal Family Set | [`assets/material/Reanimation/Laerdal_Family_Satz.webp`](frontend/user/assets/material/Reanimation/Laerdal_Family_Satz.webp) |
| `Mini-Anne_10er` | Mini-Anne 10-pack | [`assets/material/Reanimation/Mini-Anne_10er.webp`](frontend/user/assets/material/Reanimation/Mini-Anne_10er.webp) |
| `Mini-Anne_einzeln` | Mini-Anne Single | [`assets/material/Reanimation/Mini-Anne_einzeln.webp`](frontend/user/assets/material/Reanimation/Mini-Anne_einzeln.webp) |
| `QCPR_Junior_Puppe-4er` | QCPR Junior Puppet 4-pack | [`assets/material/Reanimation/QCPR_Junior_Puppe-4er.webp`](frontend/user/assets/material/Reanimation/QCPR_Junior_Puppe-4er.webp) |
| `QCPR_Junior_Puppe` | QCPR Junior Puppet | [`assets/material/Reanimation/QCPR_Junior_Puppe.webp`](frontend/user/assets/material/Reanimation/QCPR_Junior_Puppe.webp) |
| `QCPR_Little_Anne` | QCPR Little Anne | [`assets/material/Reanimation/QCPR_Little_Anne.webp`](frontend/user/assets/material/Reanimation/QCPR_Little_Anne.webp) |

#### Wundversorgung & Trauma (Wound Care & Trauma)
| Material ID | Name | Image |
|-------------|------|-------|
| `Dreieckstuch` | Triangular Bandage | [`assets/material/Wundversorgung&Trauma/Dreieckstuch.webp`](frontend/user/assets/material/Wundversorgung&Trauma/Dreieckstuch.webp) |
| `Fixierbinde` | Fixation Bandage | [`assets/material/Wundversorgung&Trauma/Fixierbinde.webp`](frontend/user/assets/material/Wundversorgung&Trauma/Fixierbinde.webp) |
| `Rettungsdecke` | Emergency Blanket | [`assets/material/Wundversorgung&Trauma/Rettungsdecke.webp`](frontend/user/assets/material/Wundversorgung&Trauma/Rettungsdecke.webp) |
| `Sterile_Kompressen-10x10` | Sterile Compresses 10x10 | [`assets/material/Wundversorgung&Trauma/Sterile_Kompressen-10x10.webp`](frontend/user/assets/material/Wundversorgung&Trauma/Sterile_Kompressen-10x10.webp) |
| `Tourniquet` | Tourniquet | [`assets/material/Wundversorgung&Trauma/Tourniquet.webp`](frontend/user/assets/material/Wundversorgung&Trauma/Tourniquet.webp) |

#### Zubehoer (Accessories)
| Material ID | Name | Image |
|-------------|------|-------|
| `Airwaykopf` | Airway Head | [`assets/material/Zubehoer/Airwaykopf.webp`](frontend/user/assets/material/Zubehoer/Airwaykopf.webp) |
| `Apollo_Uebungsmatte` | Apollo Training Mat | [`assets/material/Zubehoer/Apollo_Uebungsmatte.webp`](frontend/user/assets/material/Zubehoer/Apollo_Uebungsmatte.webp) |

### 6.2 Material Type Schema

```
MaterialType {
  id: string,              // Unique identifier (e.g., "AED_Trainer")
  name: string,            // Display name
  description: string,     // Detailed description
  imageUrl: string,        // Path to image asset
  category: string,        // "Reanimation" | "Wundversorgung&Trauma" | "Zubehoer"
}
```

---

## 7. Database Architecture

### 7.1 PostgreSQL Configuration

The platform uses **PostgreSQL** as the primary database for both orgbackend and logbackend instances.

**OrgBackend Database**:
- Stores customers, requests, and distribution center mappings
- Uses `pgcrypto` extension for UUID generation
- Implements triggers for `updated_at` timestamps and change notifications

**LogBackend Database** (planned):
- Will store material instances, inventory counts, and fulfillment data
- Each distribution center maintains its own database instance

### 7.2 Key Database Features

| Feature | Purpose | Implementation |
|---------|---------|----------------|
| **UUID Primary Keys** | Distributed-safe identifiers | `gen_random_uuid()` from pgcrypto |
| **JSONB Metadata** | Flexible schema extension | `metadata jsonb` column on requests |
| **Triggers** | Automatic timestamp updates | `set_requests_updated_at()` function |
| **NOTIFY/LISTEN** | Real-time change propagation | `notify_request_change()` trigger |
| **Check Constraints** | Data validation | Status enum constraint |
| **Foreign Keys** | Referential integrity | ON DELETE behaviors configured |

---

## 8. Request Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Pending: School creates request
    Pending --> InAction: DC approves & ships
    InAction --> Returned: School returns materials
    Returned --> [*]: DC processes return
    
    Pending --> Cancelled: School cancels
    InAction --> Cancelled: Exception case
```

| Status | Description | Actor |
|--------|-------------|-------|
| **pending** | Request submitted, awaiting review | OrgBackend |
| **inAction** | Materials shipped, in use by school | Logistics Backend |
| **returned** | Materials returned and processed | Logistics Backend |

---

## 9. Deployment & Operations

### 9.1 Configuration

**OrgBackend Configuration** ([`config.yaml`](organization_backend/config.yaml)):
```yaml
DATABASE_URL: postgres://user:pass@localhost/falp_org
```

Environment variables override config file values.

### 9.2 Build & Run

```bash
# Organization Backend
cd organization_backend
make build
./bin/server

# Or with config
CONFIG_PATH=custom-config.yaml ./bin/server
```

### 9.3 Database Migrations

Migrations run automatically on startup ([`db/migrate.go`](organization_backend/internal/db/migrate.go)).

Manual migration:
```bash
# Migrations are in organization_backend/internal/db/migrations/
```

---

## 10. Future Enhancements

| Feature | Description | Priority |
|---------|-------------|----------|
| **Logistics Backend** | Implement distribution center operations | High |
| **Preact Frontends** | Replace demo HTML with proper SPA | High |
| **Request Routing Algorithm** | Smart DC selection based on availability + location | Medium |
| **Status Transition Rules** | Enforce valid state machine transitions | Medium |
| **Audit Logging** | Track all changes for compliance | Medium |
| **Role-Based Access Control** | Differentiate org admins, DC admins, staff | Medium |
| **Email Notifications** | Automated emails for status changes | Low |
| **Reporting Dashboard** | Usage analytics, inventory reports | Low |

---

## 11. File Structure Summary

```
FAELP/
├── architecture.md              # This document
├── whatisit.md                  # Project overview
├── datastructureplan.md         # Data model planning
├── structure.png                # Architecture diagram
├── organization_backend/        # OrgBackend - IMPLEMENTED
│   ├── cmd/server/
│   ├── internal/
│   ├── internal/db/migrations/
│   └── config.yaml
├── distribution_backend/        # LogBackend - PLANNED (empty)
└── frontend/                    # Frontends - DEMO IMPLEMENTED
    ├── user/                    # School interface
    ├── logistics/               # DC staff interface
    ├── orgadmin/                # Org admin interface (empty)
    └── logadmin/                # DC admin interface (empty)
```

---

## 12. References

- [`whatisit.md`](whatisit.md) - Project overview
- [`datastructureplan.md`](datastructureplan.md) - Data model planning document
- [`organization_backend/orgplan.md`](organization_backend/orgplan.md) - Backend implementation plan
- [`structure.png`](structure.png) - Visual architecture diagram
