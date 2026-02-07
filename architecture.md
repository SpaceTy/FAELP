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
        OrgAdmins["Organization Admins"]
    end

    subgraph FrontendLayer["Frontend Layer"]
        UserFrontend["User Frontend<br/>Preact + Vite - IMPLEMENTED"]
        OrgAdminFrontend["Org Admin Frontend<br/>Preact + Vite - IMPLEMENTED"]
        LogisticsFrontend["Logistics Frontend<br/>Preact - Planned"]
        DistAdminFrontend["Distribution Admin Frontend<br/>Preact - Planned"]
    end

    subgraph BackendLayer["Backend Layer"]
        OrgBackend["Organization Backend<br/>Go + PostgreSQL + WorkOS<br/>IMPLEMENTED"]
        LogBackend["Logistics Backend<br/>Planned"]
    end

    subgraph DistributionBlock["Distribution Center Block"]
        DistCenter1["Distribution Center 1"]
        DistCenterN["Distribution Center N"]
    end

    Schools --> UserFrontend
    OrgAdmins --> OrgAdminFrontend
    UserFrontend --> OrgBackend
    OrgAdminFrontend --> OrgBackend
    OrgBackend --> LogBackend
    LogBackend --> DistCenter1
    LogBackend --> DistCenterN
    
    LogisticsFrontend --> LogBackend
    DistAdminFrontend --> LogBackend
```

### 2.2 Component Breakdown

| Component | Technology | Status | Purpose |
|-----------|------------|--------|---------|
| **Organization Backend** | Go + PostgreSQL + WorkOS | Implemented | Central coordination, request routing, customer management, authentication |
| **Logistics Backend** | TBD | Planned | Distribution center operations, inventory, packaging, returns |
| **User Frontend** | Preact + Vite + TypeScript + Tailwind | Implemented | School/customer interface for requesting materials |
| **Org Admin Frontend** | Preact + Vite + TypeScript + Tailwind | Implemented | Organization-wide administration, material type management |
| **Logistics Frontend** | Preact | Planned | Distribution center staff interface |
| **Distribution Admin Frontend** | Preact | Planned | Per-distribution-center administration |

---

## 3. Organization Backend (orgbackend)

### 3.1 Overview

The Organization Backend is the **central coordination service** written in Go. It handles:
- Customer (school) management
- Request creation and lifecycle management
- Request routing to appropriate distribution centers
- Real-time updates via Server-Sent Events (SSE)
- Authentication via WorkOS magic links
- Material type management with image uploads
- Admin role management

**Status**: Implemented  
**Location**: [`organization_backend/`](organization_backend/)  
**Database**: PostgreSQL  
**Authentication**: WorkOS (magic links) + JWT

### 3.2 Project Structure

```
organization_backend/
├── cmd/server/
│   └── main.go                    # Application entry point
├── internal/
│   ├── api/
│   │   ├── handlers.go            # HTTP request handlers (requests)
│   │   ├── auth_handlers.go       # Authentication handlers (WorkOS)
│   │   ├── material_type_handlers.go  # Material type CRUD handlers
│   │   ├── upload_handlers.go     # Image upload handlers
│   │   ├── routes.go              # Route definitions
│   │   ├── middleware.go          # CORS and other middleware
│   │   └── auth_middleware.go     # JWT & Admin middleware
│   ├── auth/
│   │   ├── jwt.go                 # JWT token generation/validation
│   │   └── workos.go              # WorkOS integration
│   ├── config/
│   │   └── config.go              # Configuration management
│   ├── db/
│   │   ├── db.go                  # Database connection
│   │   ├── migrate.go             # Migration runner
│   │   ├── models.go              # Database models
│   │   ├── notify.go              # PostgreSQL NOTIFY/LISTEN
│   │   ├── queries.go             # SQL queries
│   │   └── migrations/            # SQL migrations
│   │       ├── 001_init.sql
│   │       ├── 002_add_workos_auth.sql
│   │       ├── 003_add_material_types.sql
│   │       └── 004_rename_customer_to_user.sql
│   ├── domain/
│   │   ├── customer.go            # Customer/User domain model
│   │   ├── material_type.go       # Material type domain model
│   │   └── request.go             # Request domain model
│   ├── service/
│   │   └── request_service.go     # Business logic
│   └── transport/
│       └── sse.go                 # Server-Sent Events transport
├── config.yaml                    # Configuration file
├── go.mod                         # Go module definition
└── Makefile                       # Build automation
```

### 3.3 API Endpoints

#### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/magic-link` | Request magic link via email | No |
| POST | `/auth/callback` | Authenticate with magic code | No |
| GET | `/auth/me` | Get current authenticated user | Yes |

#### Request Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/requests` | Create a new request | Yes |
| GET | `/requests` | List requests with pagination, search, filters | Yes |
| GET | `/requests/{id}` | Get a specific request by ID | Yes |
| GET | `/requests/{id}/subscribe` | Subscribe to real-time updates for a request (SSE) | Yes |
| GET | `/requests/subscribe` | Subscribe to real-time updates for list queries (SSE) | Yes |
| GET | `/my-requests` | Get requests for authenticated user | Yes |

#### Material Type Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/material-types` | List all material types with availability | No |
| GET | `/material-types/{id}` | Get a specific material type | No |
| POST | `/material-types` | Create a new material type | Yes + Admin |
| PUT | `/material-types/{id}` | Update a material type | Yes + Admin |
| DELETE | `/material-types/{id}` | Delete a material type | Yes + Admin |
| POST | `/material-types/{id}/image` | Upload image for material type | Yes + Admin |

#### Static Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/uploads/*` | Serve uploaded images |

### 3.4 Data Models

#### Domain Models

**Customer/User** ([`domain/customer.go`](organization_backend/internal/domain/customer.go)):
```go
type Customer struct {
    ID            string    `json:"id"`
    Email         string    `json:"email"`
    Name          string    `json:"name"`
    Token         string    `json:"token"`          // Authentication token
    WorkOSUserID  string    `json:"workosUserId"`   // WorkOS user ID
    EmailVerified bool      `json:"emailVerified"`  // Email verification status
    IsAdmin       bool      `json:"isAdmin"`        // Admin flag
    CreatedAt     time.Time `json:"createdAt"`
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

**MaterialType** ([`domain/material_type.go`](organization_backend/internal/domain/material_type.go)):
```go
type MaterialType struct {
    ID             string `json:"id"`
    Name           string `json:"name"`
    Description    string `json:"description"`
    ImageURL       string `json:"imageUrl"`
    AvailableCount int    `json:"availableCount"`
}
```

#### Database Schema

**Tables** (see migrations in [`internal/db/migrations/`](organization_backend/internal/db/migrations/)):

| Table | Description |
|-------|-------------|
| `users` | User/customer information (renamed from `customers`) |
| `requests` | Request header data with shipping address |
| `request_items` | Line items for each request (material types + quantities) |
| `material_types` | Catalog of available material types with images |
| `distribution_centers` | Distribution center locations |
| `material_available` | Inventory availability per distribution center |

**Key Indexes**:
- `requests_created_at_idx` - For pagination (newest first)
- `requests_updated_at_idx` - For live updates
- `requests_status_idx` - For filtering by status
- `requests_customer_idx` - For customer lookups
- `users_workos_user_id_idx` - For WorkOS user lookups
- `users_is_admin_idx` - For admin filtering
- `material_types_name_idx` - For material type lookups

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
- **WorkOS Magic Link Authentication**: Users receive a magic link via email
- **Flow**:
  1. User enters email on login page
  2. Backend calls WorkOS to send magic auth code
  3. User clicks link in email and enters code
  4. Backend authenticates with WorkOS using the code
  5. Backend creates/updates user in database
  6. Backend issues JWT token for session management
- **JWT Token**: Contains user ID, email, WorkOS user ID, and admin status
- **Token Expiry**: Configurable via JWT claims

**For Organization Admins**:
- Same WorkOS magic link authentication
- `is_admin` flag in database determines admin privileges
- Admin middleware checks `isAdmin` claim in JWT

**Configuration**:
- `WORKOS_API_KEY` - WorkOS API key
- `WORKOS_CLIENT_ID` - WorkOS client ID
- `JWT_SECRET` - Secret for signing JWT tokens
- `DATABASE_URL` - PostgreSQL connection string

### 3.7 Image Upload System

Material type images are uploaded via [`upload_handlers.go`](organization_backend/internal/api/upload_handlers.go):

- **Endpoint**: `POST /material-types/{id}/image`
- **Format**: Supports JPEG, PNG, WebP, GIF
- **Processing**: Images are resized to 400x300 and converted to WebP format
- **Storage**: Saved to `uploads/material-types/{id}.webp`
- **Serving**: Static file server at `/uploads/*`

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

The frontend is split into **four distinct interfaces** targeting different user roles. Two frontends are fully implemented, two are planned.

### 5.2 Frontend Components

| Frontend | Target Users | Purpose | Status |
|----------|--------------|---------|--------|
| **User Frontend** | Schools/Teachers | Browse materials, create requests, track orders | **IMPLEMENTED** (Preact + Vite) |
| **Org Admin Frontend** | Organization Admins | Manage material types, oversee operations | **IMPLEMENTED** (Preact + Vite) |
| **Logistics Frontend** | DC Staff/Volunteers | Process requests, manage packaging, handle returns | Demo (HTML) |
| **Distribution Admin Frontend** | DC Admins | Manage single distribution center settings | Not started |

### 5.3 User Frontend ([`frontend/user/`](frontend/user/))

**Technology Stack**:
- **Framework**: Preact 10.x (React alternative, smaller bundle)
- **Build Tool**: Vite 5.x
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 3.x + PostCSS
- **State Management**: Preact Signals (`@preact/signals`)
- **Routing**: `preact-router`

**Project Structure**:
```
frontend/user/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── public/
│   └── assets/material/       # Material images
├── src/
│   ├── App.tsx                # Main app component
│   ├── main.tsx               # Entry point
│   ├── index.css              # Global styles
│   ├── components/
│   │   ├── Auth/              # Authentication components
│   │   │   ├── CallbackPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── MagicLinkForm.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── UserMenu.tsx
│   │   ├── Layout/
│   │   │   └── Header.tsx
│   │   ├── Material/
│   │   │   └── MaterialCard.tsx
│   │   └── Request/
│   │       └── RequestCard.tsx
│   ├── context/
│   │   ├── AuthContext.tsx    # Authentication state
│   │   └── MaterialTypesContext.tsx
│   ├── hooks/
│   │   ├── useCart.ts
│   │   ├── useLocalStorage.ts
│   │   └── useRequests.ts
│   ├── pages/
│   │   ├── CartPage.tsx
│   │   ├── MaterialsPage.tsx
│   │   ├── ProfilePage.tsx
│   │   └── RequestsPage.tsx
│   ├── services/
│   │   ├── api.ts             # API client
│   │   ├── auth.ts            # Auth service
│   │   └── sse.ts             # SSE client
│   └── types/
│       ├── auth.ts
│       ├── material.ts
│       └── request.ts
```

**Routes**:
| Path | Page | Auth Required |
|------|------|---------------|
| `/` | Materials (catalog) | No |
| `/materials` | Materials (catalog) | No |
| `/login` | Login | No |
| `/callback` | Auth callback | No |
| `/requests` | My Requests | Yes |
| `/cart` | Shopping Cart | Yes |
| `/profile` | User Profile | Yes |

### 5.4 Org Admin Frontend ([`frontend/orgadmin/`](frontend/orgadmin/))

**Technology Stack**:
- Same as User Frontend: Preact + Vite + TypeScript + Tailwind + Signals

**Project Structure**:
```
frontend/orgadmin/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── components/
│   │   ├── DeleteConfirmationModal.tsx
│   │   ├── Header.tsx
│   │   ├── MaterialTypeFormModal.tsx
│   │   └── ProtectedRoute.tsx
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   └── MaterialTypesPage.tsx
│   ├── services/
│   │   ├── auth.ts
│   │   └── materialTypes.ts
│   └── types/
│       ├── auth.ts
│       └── material.ts
```

**Routes**:
| Path | Page | Auth Required |
|------|------|---------------|
| `/` | Material Types Management | Yes + Admin |
| `/material-types` | Material Types Management | Yes + Admin |
| `/login` | Login | No |

**Features**:
- Material type CRUD operations
- Image upload with drag-and-drop
- Real-time availability counts
- Admin-only access protection

### 5.5 Demo Frontend ([`frontend/demo/`](frontend/demo/))

The original HTML/CSS demo implementations are preserved in `frontend/demo/`:
- `frontend/demo/user/` - Static HTML demo for user interface
- `frontend/demo/logistics/` - Static HTML demo for logistics interface
- `frontend/demo/orgadmin/` - Placeholder
- `frontend/demo/logadmin/` - Placeholder

---

## 6. Material Catalog

### 6.1 Material Categories

The platform manages first aid training materials organized into three categories:

#### Reanimation (Resuscitation)
| Material ID | Name | Image |
|-------------|------|-------|
| `AED_Trainer` | AED Trainer | [`assets/material/Reanimation/AED_Trainer.webp`](frontend/user/public/assets/material/Reanimation/AED_Trainer.webp) |
| `Laerdal_Family_Satz` | Laerdal Family Set | [`assets/material/Reanimation/Laerdal_Family_Satz.webp`](frontend/user/public/assets/material/Reanimation/Laerdal_Family_Satz.webp) |
| `Mini-Anne_10er` | Mini-Anne 10-pack | [`assets/material/Reanimation/Mini-Anne_10er.webp`](frontend/user/public/assets/material/Reanimation/Mini-Anne_10er.webp) |
| `Mini-Anne_einzeln` | Mini-Anne Single | [`assets/material/Reanimation/Mini-Anne_einzeln.webp`](frontend/user/public/assets/material/Reanimation/Mini-Anne_einzeln.webp) |
| `QCPR_Junior_Puppe-4er` | QCPR Junior Puppet 4-pack | [`assets/material/Reanimation/QCPR_Junior_Puppe-4er.webp`](frontend/user/public/assets/material/Reanimation/QCPR_Junior_Puppe-4er.webp) |
| `QCPR_Junior_Puppe` | QCPR Junior Puppet | [`assets/material/Reanimation/QCPR_Junior_Puppe.webp`](frontend/user/public/assets/material/Reanimation/QCPR_Junior_Puppe.webp) |
| `QCPR_Little_Anne` | QCPR Little Anne | [`assets/material/Reanimation/QCPR_Little_Anne.webp`](frontend/user/public/assets/material/Reanimation/QCPR_Little_Anne.webp) |

#### Wundversorgung & Trauma (Wound Care & Trauma)
| Material ID | Name | Image |
|-------------|------|-------|
| `Dreieckstuch` | Triangular Bandage | [`assets/material/Wundversorgung&Trauma/Dreieckstuch.webp`](frontend/user/public/assets/material/Wundversorgung&Trauma/Dreieckstuch.webp) |
| `Fixierbinde` | Fixation Bandage | [`assets/material/Wundversorgung&Trauma/Fixierbinde.webp`](frontend/user/public/assets/material/Wundversorgung&Trauma/Fixierbinde.webp) |
| `Rettungsdecke` | Emergency Blanket | [`assets/material/Wundversorgung&Trauma/Rettungsdecke.webp`](frontend/user/public/assets/material/Wundversorgung&Trauma/Rettungsdecke.webp) |
| `Sterile_Kompressen-10x10` | Sterile Compresses 10x10 | [`assets/material/Wundversorgung&Trauma/Sterile_Kompressen-10x10.webp`](frontend/user/public/assets/material/Wundversorgung&Trauma/Sterile_Kompressen-10x10.webp) |
| `Tourniquet` | Tourniquet | [`assets/material/Wundversorgung&Trauma/Tourniquet.webp`](frontend/user/public/assets/material/Wundversorgung&Trauma/Tourniquet.webp) |

#### Zubehoer (Accessories)
| Material ID | Name | Image |
|-------------|------|-------|
| `Airwaykopf` | Airway Head | [`assets/material/Zubehoer/Airwaykopf.webp`](frontend/user/public/assets/material/Zubehoer/Airwaykopf.webp) |
| `Apollo_Uebungsmatte` | Apollo Training Mat | [`assets/material/Zubehoer/Apollo_Uebungsmatte.webp`](frontend/user/public/assets/material/Zubehoer/Apollo_Uebungsmatte.webp) |

### 6.2 Material Type Schema

```go
type MaterialType struct {
  ID             string  // Unique identifier (e.g., "AED_Trainer")
  Name           string  // Display name
  Description    string  // Detailed description
  ImageURL       string  // Path to image asset (e.g., "/uploads/material-types/AED_Trainer.webp")
  AvailableCount int     // Computed: total available across all DCs
}
```

---

## 7. Database Architecture

### 7.1 PostgreSQL Configuration

The platform uses **PostgreSQL** as the primary database for both orgbackend and logbackend instances.

**OrgBackend Database**:
- Stores users, requests, material types, and distribution center mappings
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

### 7.3 Migration History

| Migration | Description |
|-----------|-------------|
| `001_init.sql` | Initial schema: users, requests, request_items, distribution_centers, material_available |
| `002_add_workos_auth.sql` | Add WorkOS user ID and email verification columns |
| `003_add_material_types.sql` | Create material_types table with foreign key constraints |
| `004_rename_customer_to_user.sql` | Rename customers table to users, add is_admin field |

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

**Environment Variables** (keys are stored in .env file):
- `WORKOS_API_KEY` - WorkOS API key
- `WORKOS_CLIENT_ID` - WorkOS client ID
- `JWT_SECRET` - Secret for JWT signing

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

### 9.3 Frontend Development

```bash
# User Frontend
cd frontend/user
npm install
npm run dev        # Development server
npm run build      # Production build

# Org Admin Frontend
cd frontend/orgadmin
npm install
npm run dev        # Development server
npm run build      # Production build
```

### 9.4 Database Migrations

Migrations run automatically on startup ([`db/migrate.go`](organization_backend/internal/db/migrate.go)).

Manual migration files are located in [`organization_backend/internal/db/migrations/`](organization_backend/internal/db/migrations/).

---

## 10. Future Enhancements

| Feature | Description | Priority |
|---------|-------------|----------|
| **Logistics Backend** | Implement distribution center operations | High |
| **Logistics Frontend** | Build DC staff interface in Preact | High |
| **Distribution Admin Frontend** | DC admin interface for single center management | Medium |
| **Request Routing Algorithm** | Smart DC selection based on availability + location | Medium |
| **Status Transition Rules** | Enforce valid state machine transitions | Medium |
| **Audit Logging** | Track all changes for compliance | Medium |
| **Role-Based Access Control** | Differentiate org admins, DC admins, staff more granularly | Medium |
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
│   │   ├── api/
│   │   ├── auth/
│   │   ├── config/
│   │   ├── db/
│   │   │   └── migrations/
│   │   ├── domain/
│   │   ├── service/
│   │   └── transport/
│   ├── config.yaml
│   ├── go.mod
│   └── Makefile
├── distribution_backend/        # LogBackend - PLANNED (empty)
└── frontend/
    ├── demo/                    # Static HTML demos
    │   ├── user/
    │   ├── logistics/
    │   ├── orgadmin/
    │   └── logadmin/
    ├── user/                    # User Frontend - IMPLEMENTED (Preact + Vite)
    │   ├── src/
    │   │   ├── components/
    │   │   ├── context/
    │   │   ├── hooks/
    │   │   ├── pages/
    │   │   ├── services/
    │   │   └── types/
    │   └── public/assets/material/
    └── orgadmin/                # Org Admin Frontend - IMPLEMENTED (Preact + Vite)
        └── src/
            ├── components/
            ├── context/
            ├── pages/
            ├── services/
            └── types/
```

---

## 12. References

- [`whatisit.md`](whatisit.md) - Project overview
- [`datastructureplan.md`](datastructureplan.md) - Data model planning document
- [`organization_backend/orgplan.md`](organization_backend/orgplan.md) - Backend implementation plan
- [`structure.png`](structure.png) - Visual architecture diagram
