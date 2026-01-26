## Org Backend Plan (Go + PostgreSQL)

### Goal
Provide a Go service that stores and serves **Request** data. It must support:
- Create a request
- Retrieve a request by id
- Live-updating retrieval when a request changes (via PostgreSQL notifications)
- Latest requests with pagination + search + live updates

The data model should be easy to extend in the future.

---

## 1) Data Model (PostgreSQL)

### Core tables
- `customers`
  - `id` (uuid, pk)
  - `email` (text, unique)
  - `name` (text)
  - `token` (text, unique)
  - `created_at` (timestamptz)

- `requests`
  - `id` (uuid, pk)
  - `customer_id` (uuid, fk -> customers.id)
  - `delivery_date` (date or timestamptz; pick based on UX)
  - `status` (text; enum-like check constraint: pending | inAction | returned)
  - `shipping_customer_name` (text)
  - `shipping_address_line1` (text)
  - `shipping_address_line2` (text, nullable)
  - `shipping_city` (text)
  - `shipping_zip_code` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

- `request_items`
  - `request_id` (uuid, fk -> requests.id)
  - `material_type_id` (text; string id from MaterialType)
  - `quantity` (int)
  - composite pk (`request_id`, `material_type_id`)

### Notes for extensibility
- Prefer **JSONB** columns for optional or evolving fields (example: `requests.metadata jsonb`).
- Use **migration-based** schema management (e.g., `db/migrations/`).
- Use `updated_at` trigger on `requests` to avoid scattered timestamp logic.
- Keep enum-like values in one place (Go type + SQL check constraint).

---

## 2) Live Update Strategy

### PostgreSQL NOTIFY/LISTEN
- Trigger on `requests` table (`INSERT/UPDATE/DELETE`) that does:
  - `NOTIFY requests_channel, json_payload`
  - Payload should include at least `{ request_id, action, updated_at }`.

### Go server
- Maintain a single LISTEN connection.
- Fan out updates to interested clients (WebSocket or SSE).
- Allow subscription to:
  - a specific request id
  - a query set (latest/search endpoint)

---

## 3) API Endpoints

### REST (base)
- `POST /requests`
  - Create a new request and request_items
  - Response: created request with items

- `GET /requests/{id}`
  - Retrieve request by id
  - Response: request with items

- `GET /requests`
  - Query: `q` (search), `limit`, `cursor`, `status`, `customerId`, `from`, `to`
  - Response: list of latest requests, plus pagination cursor

### Live updates
- `GET /requests/{id}/subscribe`
  - Streams updates for a single request (SSE or WebSocket).

- `GET /requests/subscribe`
  - Streams updates for list queries (latest/search).
  - Use same query params as `GET /requests`.

---

## 4) Search + Pagination

### Pagination approach
- Cursor-based (preferred for live updates):
  - `cursor` is based on `(created_at, id)` or `(updated_at, id)`.
  - Newest-first sorting.

### Search
- Start simple:
  - `q` matches customer name, email, or request id (ILIKE).
- Future-friendly:
  - Add trigram indexes or full-text search later.

---

## 5) Go Project Structure (suggested)

```
organization_backend/
  cmd/server/
    main.go
  internal/
    api/
      handlers.go
      routes.go
      middleware.go
    db/
      queries.go
      models.go
      notify.go
      migrations/
    domain/
      request.go
      customer.go
    service/
      request_service.go
    transport/
      sse.go
      websocket.go
  pkg/
    pagination/
    search/
```

### Key design choices
- Keep SQL in `db/queries.go` or use sqlc for generated code.
- Separate `domain` structs from `db` structs for flexibility.
- Use DTOs in `api` layer for response shaping.

---

## 6) Request Data Shape (Go)

Use struct composition so it is easy to add fields:

```
type Request struct {
  ID              string
  Customer        Customer
  Items           map[string]int
  DeliveryDate    time.Time
  Status          string
  ShippingAddress ShippingAddress
  CreatedAt       time.Time
  UpdatedAt       time.Time
  Metadata        map[string]any
}
```

---

## 7) Error Handling + Validation

- Validate request payload on create:
  - customer exists or create if allowed
  - items not empty
  - quantities > 0
  - deliveryDate in the future if required
- Return structured errors (field + message).

---

## 8) Future Extensions

- Add `material_instances` association or reservation tracking.
- Support status transitions with rules (pending -> inAction -> returned).
- Audit log table for all changes.
- Role-based access control (org admins vs staff).

