# Changes Since `9bb52123` (2026-03-01 "static podman volumes, and fix route")

**16 commits** across 70 files: +3806 / -512 lines.
Branch: `main`. Date range: 2026-03-01 → 2026-03-05.

---

## 1. Audit Log System (new feature — `feature/audit-log`)

### Backend (`distribution_backend`)

#### Database
- **`migrations/009_audit_log.sql`** — new `audit_log` table with `id`, `timestamp`, `user_id`, `username`, `action`, `entity_type`, `entity_id`, `details` (jsonb), `previous_state` (jsonb), `rolled_back`, `rolled_back_at`, `rolled_back_by`. Four indexes: timestamp, entity, user, action.

#### `db/audit.go` (new)
- `AuditLogger` struct wrapping `*Store`.
- `Log()` method — normalises `details`/`previousState` to `map[string]interface{}` and calls `InsertAuditEntry`. Logs on failure but does not crash callers.

#### `db/audit_queries.go` (new)
- `InsertAuditEntry`, `GetAuditEntry`, `ListAuditEntries` (dynamic WHERE + ORDER BY + LIMIT/OFFSET), `MarkRolledBack`.
- `ListAuditEntriesParams` supports filtering by `EntityType`, `EntityID`, `UserID`, `Action`, `From`/`To` time range.

#### `db/audit_rollback.go` (new)
- `RollbackAuditEntry` — looks up the entry, checks `rollbackableActions` whitelist, dispatches to entity-specific rollback:
  - **`material_instance`**: `inventory.update` (restores all fields), `inventory.delete` (re-inserts row), `inventory.archive`/`unarchive` (toggles status).
  - **`request`**: `request.archive`/`unarchive` (inserts/removes from `request_archive_state`).
  - **`user`**: `user.set_admin` (restores `is_admin`).
- Rollbackable actions: `inventory.update/delete/archive/unarchive`, `request.archive/unarchive`, `user.set_admin`.
- Errors: `ErrAlreadyRolledBack`, `ErrNotRollbackable`, `ErrNoPreviousState`.

#### `handlers/audit.go` (new)
- `AuditHandler` with three endpoints:
  - `GET /api/audit` — list with query param filters (entityType, entityId, userId, action, from, to, limit, offset).
  - `GET /api/audit/{id}` — single entry.
  - `POST /api/audit/{id}/rollback` — executes rollback; returns `RollbackResult` JSON.
- All routes registered as **admin-only** in `main.go`.

#### Audit instrumentation added to existing handlers
| Handler | Actions logged |
|---|---|
| `handlers/auth.go` | `user.create`, `user.delete`, `user.reset_password`, `user.set_admin` |
| `handlers/inventory.go` | `inventory.create`, `inventory.update` (with previous state), `inventory.delete` (with previous state), `inventory.archive`, `inventory.unarchive`, `inventory.assign`, `inventory.release`, `inventory.import` |
| `handlers/requests.go` | `request.approve`, `request.in_action`, `request.cancel`, `request.archive`, `request.unarchive` |

`update`, `delete`, `archive`, `unarchive` all pre-fetch the existing row to populate `previous_state` (required for rollback).

### Frontend (`distadmin`)

#### `src/types/audit.ts` (new)
- `AuditEntry` and `AuditFilters` TypeScript interfaces.

#### `src/services/audit.ts` (new)
- `listAuditEntries(filters)`, `getAuditEntry(id)`, `rollbackAuditEntry(id)`.

#### `src/pages/AuditLogPage.tsx` (new, 372 lines)
- Full audit log viewer with:
  - Filter bar: entity type, action, user ID, date range.
  - Table showing timestamp, user, action, entity type/id, rollback status.
  - Entry detail modal (displays `details` and `previousState` JSON).
  - Rollback confirmation modal (only shown for rollbackable actions).
  - Locale-formatted dates (`de-DE`).

#### `src/App.tsx` + `src/components/Header.tsx`
- New `/audit` route added; "Audit Log" navigation link in the Header.

---

## 2. SSE Real-Time Updates (new feature — `feature/dist-workflow` + `feature/user-pages`)

### Distribution backend — inventory SSE

#### `db/inventory_notify.go` (new)
- `InventoryNotifier`: listens on `availability_change_channel` (reuses existing trigger), fan-out to `chan struct{}` subscribers.
- Subscribe/Unsubscribe methods; buffered channels (cap 10) with non-blocking send (slow clients drop events).

#### `handlers/inventory.go`
- `SubscribeInventory` — SSE endpoint at `GET /api/inventory/subscribe`. Sends `event: update\ndata: {"type":"change"}` on each inventory change.
- `ValidateMaterialCode` — new endpoint `GET /api/inventory/validate-code?code=&typeId=` (see section 3).

### Organization backend — request SSE

#### `db/migrations/014_request_notify_trigger.sql` (new)
- PostgreSQL trigger `requests_notify` on `requests` table (INSERT/UPDATE/DELETE) calling `pg_notify('request_change_channel', json…)` with `request_id`, `customer_id`, `status`, `action`.

#### `db/request_notify.go` (new)
- `RequestNotifier`: similar fan-out pattern as `InventoryNotifier`, but channels carry `RequestChangeNotification` (typed struct with `RequestID`, `CustomerID`, `Status`, `Action`).

#### `api/request_handlers.go`
- `SubscribeMyRequests` SSE endpoint — filters notifications by `claims.CustomerID` so each user only receives their own request events.
- `RequestHandler` struct gets `RequestNotifier *db.RequestNotifier` field.

### Frontend — polling replaced by SSE

#### `user/src/context/MaterialTypesContext.tsx`
- `setInterval` polling removed; replaced with `EventSource('/api/material-types/subscribe')`.
- Handles `snapshot` events (full replace) and `update` events (single item update).

#### `user/src/pages/MyRequestsPage.tsx`
- `setInterval` polling removed; replaced with `EventSource('/api/requests/subscribe?token=…')`.
- `fetchRequests` extracted as `useCallback` for reuse.

---

## 3. Distribution Workflow Improvements (`feature/dist-workflow`)

### Packaging codes validation

#### `handlers/inventory.go`
- `ValidateMaterialCode` endpoint: validates human code format (5 uppercase letters), looks up instance, optionally checks `typeId` match. Returns `{ valid, code, typeId, typeIdMatch?, error? }`.

#### `handlers/requests.go`
- `MarkIncomingRequestInAction` now accepts `items: [{materialTypeId, codes[]}]` in the request body.
- Before calling the org client, validates every code: checks it exists and belongs to the specified material type. Returns HTTP 400 with the offending code on failure.

#### `distribution/src/services/api.ts`
- `validateMaterialCode(code, typeId?)` — new method.
- `markIncomingRequestInAction` now passes `items` array to the backend.
- `API_BASE` constant changed from `import.meta.env.VITE_API_URL || ''` to `''` (hardcoded empty string — relies on reverse proxy).

### PackagingPage rework (`distribution/src/pages/PackagingPage.tsx`)
- Significant expansion (+170 lines); now includes per-type code entry fields with real-time backend validation via `validateMaterialCode`.

### RequestsPage simplification (`distribution/src/pages/RequestsPage.tsx`)
- Filter logic simplified; mock data dependency removed (`mockRequests.ts` deleted).

### ReturnsPage rework (`distribution/src/pages/ReturnsPage.tsx`)
- Refactored to use real return statuses (`inAction`, `returned`, `unpacked`) matching the backend/type system.
- `ReturnStats` type changed from `{overdue, dueToday, toInspect, completedToday}` to `{inAction, returned, unpacked}`.
- `ReturnStatus` union type extended with `'unpacked' | 'inAction' | 'returned'`.
- Mock data in `mockReturns.ts` updated to reflect new statuses.

---

## 4. User Frontend Pages (`feature/user-pages`)

### Removed: ProfilePage (`user/src/pages/ProfilePage.tsx`)
- File deleted; `/profile` route removed from `App.tsx`.

### Added: HilfePage (`user/src/pages/HilfePage.tsx`, new, 208 lines)
- Static help/FAQ page at `/hilfe`.
- No auth required (public route).

### Added: NotFoundPage (`user/src/pages/NotFoundPage.tsx`, new)
- Preact Router `default` catch-all route; displays 404 message.

### MaterialCard UX improvement (`user/src/components/Material/MaterialCard.tsx`)
- When an item is already in the cart, the "Material anfragen" button is replaced by an inline `−  qty  +` counter.
- `+` button disabled and styled amber when `cartItem.quantity >= material.availableCount`.
- Availability badge turns amber when the cart has reached max available quantity.

---

## 5. Dev Auth Bypass (`organization_backend`)

#### `internal/api/auth_middleware_devbypass.go` (new)
- Build tag `//go:build devbypass` — compiled only when explicitly requested.
- Replaces all auth middleware (`AuthMiddleware`, `APIKeyMiddleware`, `AdminMiddleware`) with pass-through versions.
- Injects hardcoded `devClaims` (`dev@localhost`, `isAdmin: true`) into every request context.
- Logs a warning on init: `"DEV AUTH BYPASS ENABLED"`.

---

## 6. Dark Mode & Design System (commits `d71a0e7`, `6a712be`)

All four frontend apps (`distadmin`, `distribution`, `user`, `orgadmin`) received:

#### `index.html`
- Inline `<script>` in `<head>` to apply `.dark` class before first paint (reads `localStorage.theme`, falls back to `prefers-color-scheme`). Eliminates flash of wrong theme.

#### `src/index.css`
- Comprehensive `.dark` override blocks added:
  - `distadmin`: covers `logistics-*`, `.btn-*`, `.data-table` custom classes (+171 lines).
  - `distribution`: ~372-line dark block covering all custom logistics CSS.
  - `user`: Tailwind utility overrides + custom token overrides (+145 lines net).
  - `orgadmin`: `.dark` overrides for Tailwind utility classes (+63 lines).

#### `src/components/Header.tsx` (all apps)
- Dark mode toggle button added (moon/sun SVG icon).
- Toggles `localStorage.theme` and `.dark` class on `<html>`.

#### `tailwind.config.js` (all apps)
- `darkMode: 'class'` added.
- Unified color palette confirmed across all 4 apps:
  - `primary: #48bb78`, `primary-hover: #38a169`
  - `secondary: #1a365d`, `secondary-hover: #2d4a77`
  - `background: #f0f2f5`, `text-primary: #1f2937`, `text-secondary: #4a5568`

---

## 7. Infrastructure / Deployment

#### `deployment/distbackend/template/docker-compose.yml`
- 2 lines added (likely volume or env var for new config).

#### `deployment/orgbackend/template/docker-compose.yml`
- 1 line added.

#### `distribution_backend/internal/auth/middleware.go`
- Minor changes (24 lines); likely token extraction from query param `?token=` to support SSE `EventSource` (which cannot set custom headers).

#### `distribution_backend/internal/db/queries.go`
- 17 lines added; likely `GetMaterialInstanceByHumanCode` query used by code validation.

#### `organization_backend/internal/api/routes.go`
- 1 line: SSE subscribe route registered.

#### `organization_backend/cmd/server/main.go`
- `RequestNotifier` wired into `RequestHandler`.

---

## 8. Plans Directory (`plans/`)

Four markdown plan files added (pre-implementation specs):
- `plans/audit-log.md` (188 lines)
- `plans/dist-workflow.md` (82 lines)
- `plans/user-pages.md` (68 lines)
- `plans/cart-ux.md` (43 lines)

---

## Summary Table

| Area | Type | Impact |
|---|---|---|
| Audit log (backend) | New feature | Full create/read/rollback pipeline for distadmin |
| Audit log (frontend) | New feature | AuditLogPage with filters, detail modal, rollback UI |
| SSE — inventory | New feature | Replaces polling; Postgres LISTEN/NOTIFY → EventSource |
| SSE — requests | New feature | Per-customer real-time request updates |
| Packaging code validation | Enhancement | Backend validates material codes before marking in-action |
| Returns rework | Enhancement | Statuses aligned to real workflow; mock data updated |
| HilfePage | New page | Public help/FAQ page at `/hilfe` |
| ProfilePage | Removed | Route and file deleted |
| 404 page | New page | Catch-all NotFoundPage |
| MaterialCard UX | Enhancement | Inline qty counter replaces repeat add button |
| Dark mode | New feature | All 4 apps; init script, toggle button, CSS overrides |
| Dev auth bypass | Dev tooling | `devbypass` build tag for orgbackend |
| Unified color palette | Design | Confirmed identical across all 4 Tailwind configs |
