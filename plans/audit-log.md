# Branch: feature/audit-log

## Task: Logadmin audit log for all interactions with rollback

### Context
The distribution backend needs a comprehensive audit logging system that records all state-changing interactions (inventory changes, request status changes, user management actions). This log should be viewable through the distadmin frontend and support rollback of individual actions.

### Architecture

The audit log system has three parts:
1. **Backend**: Database table + trigger/middleware to capture all mutations
2. **API**: Endpoints to query and rollback audit entries
3. **Frontend**: New page in distadmin to browse and rollback

---

## Part 1: Backend — Audit Log Infrastructure

### 1.1 Create migration `009_audit_log.sql`

Path: `distribution_backend/internal/db/migrations/009_audit_log.sql`

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  timestamp timestamptz NOT NULL DEFAULT now(),
  user_id text NOT NULL,            -- who performed the action
  username text NOT NULL,           -- denormalized for display
  action text NOT NULL,             -- e.g. 'inventory.create', 'request.approve', 'user.delete'
  entity_type text NOT NULL,        -- 'material_instance', 'request', 'user'
  entity_id text NOT NULL,          -- the ID of the affected entity
  details jsonb NOT NULL DEFAULT '{}', -- action-specific data
  previous_state jsonb,             -- snapshot before the change (for rollback)
  rolled_back boolean NOT NULL DEFAULT false,
  rolled_back_at timestamptz,
  rolled_back_by text               -- user_id who performed rollback
);

CREATE INDEX IF NOT EXISTS audit_log_timestamp_idx ON audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);
```

### 1.2 Add audit log queries

Path: `distribution_backend/internal/db/audit_queries.go`

Functions to add to the `Store`:
- `InsertAuditEntry(ctx, entry)` — record an audit event
- `ListAuditEntries(ctx, params)` — list with filters (entity_type, entity_id, user_id, action, date range) and pagination
- `GetAuditEntry(ctx, id)` — get single entry
- `MarkRolledBack(ctx, id, rolledBackBy)` — mark entry as rolled back

### 1.3 Add audit logging to existing handlers

Create a helper/middleware approach. Add an `AuditLogger` struct in `distribution_backend/internal/db/audit.go` that wraps the Store:

```go
type AuditLogger struct {
    store *Store
}

func (a *AuditLogger) Log(ctx context.Context, userID, username, action, entityType, entityID string, details any, previousState any) error
```

Instrument these existing handlers to log:
- **Inventory handlers** (`handlers/inventory.go`):
  - `CreateMaterialInstance` → `inventory.create`
  - `UpdateMaterialInstance` → `inventory.update` (capture previous state)
  - `DeleteMaterialInstance` → `inventory.delete` (capture previous state)
  - `ArchiveMaterialInstance` → `inventory.archive`
  - `UnarchiveMaterialInstance` → `inventory.unarchive`
  - `AssignToRequest` → `inventory.assign`
  - `ReleaseFromRequest` → `inventory.release`
  - `ImportInventoryCSV` → `inventory.import` (log count of imported items)

- **Request handlers** (`handlers/requests.go`):
  - `ApproveIncomingRequest` → `request.approve`
  - `MarkIncomingRequestInAction` → `request.in_action`
  - `CancelAssignedIncomingRequest` → `request.cancel`
  - `ArchiveIncomingRequest` → `request.archive`
  - `UnarchiveIncomingRequest` → `request.unarchive`

- **User handlers** (`handlers/auth.go`):
  - `CreateUser` → `user.create`
  - `DeleteUser` → `user.delete` (capture previous state)
  - `SetUserAdmin` → `user.set_admin`
  - `ResetUserPassword` → `user.reset_password`

The user ID and username should come from the auth middleware context (already available via `auth.GetUserFromContext(r.Context())`).

### 1.4 Rollback logic

Path: `distribution_backend/internal/db/audit_rollback.go`

Rollback restores the `previous_state` snapshot. Not all actions are rollback-able:
- **Rollback-able**: inventory.update, inventory.delete, inventory.archive, inventory.unarchive, request.approve (→ back to pending), request.archive, request.unarchive, user.set_admin
- **Not rollback-able**: inventory.create (just delete it), request.in_action (physical shipment), request.cancel (notify customer), user.create, user.delete (security), user.reset_password

The `RollbackAuditEntry` function should:
1. Check that the entry hasn't already been rolled back
2. Check that the action is rollback-able
3. Restore the previous_state to the relevant table
4. Mark the audit entry as rolled back
5. Create a new audit entry for the rollback action itself

---

## Part 2: API Endpoints

### 2.1 Add routes in `cmd/server/main.go`

```
GET  /api/audit              — list audit entries (admin only)
GET  /api/audit/{id}         — get single entry (admin only)
POST /api/audit/{id}/rollback — rollback an entry (admin only)
```

All endpoints require admin authentication (`authMiddleware.RequireAdmin`).

### 2.2 Create handler

Path: `distribution_backend/internal/handlers/audit.go`

- `NewAuditHandler(store, auditLogger)`
- `ListAuditEntries` — accepts query params: `entity_type`, `entity_id`, `user_id`, `action`, `from`, `to`, `limit`, `offset`
- `GetAuditEntry` — returns full entry with previous_state
- `RollbackAuditEntry` — calls rollback logic, returns result

---

## Part 3: Distadmin Frontend — Audit Log Page

### 3.1 Create page

Path: `frontend/distadmin/src/pages/AuditLogPage.tsx`

Layout (matches existing distadmin pattern):
- **Sidebar**: Filters
  - Entity type filter (radio): All, Material Instance, Request, User
  - Action filter (dropdown or checkboxes)
  - Date range picker (from/to)
  - User filter (dropdown of users)
- **Main content**: Table of audit entries
  - Columns: Timestamp, User, Action, Entity, Details, Status (rolled back?), Actions
  - Each row has a "View" button → modal with full details and previous_state JSON
  - Rollback-able entries have a "Rollback" button with confirmation modal
  - Pagination at bottom

### 3.2 Add API service functions

Path: `frontend/distadmin/src/services/auth.ts` (or create a new `audit.ts` service)

- `listAuditEntries(params)` — GET /api/audit
- `getAuditEntry(id)` — GET /api/audit/{id}
- `rollbackAuditEntry(id)` — POST /api/audit/{id}/rollback

### 3.3 Add types

Path: `frontend/distadmin/src/types/audit.ts`

```typescript
interface AuditEntry {
  id: number;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  previousState: Record<string, unknown> | null;
  rolledBack: boolean;
  rolledBackAt: string | null;
  rolledBackBy: string | null;
}
```

### 3.4 Add route

Edit `frontend/distadmin/src/App.tsx`:
- Import AuditLogPage
- Add wrapper with `requireAdmin` protection
- Add route: `<AuditLogPageWrapper path="/audit" />`

Edit `frontend/distadmin/src/components/Header.tsx`:
- Add "Audit Log" nav link
