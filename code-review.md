# Code Review — changes since `9bb52123`

Severity legend: **[critical]** · **[high]** · **[medium]** · **[low]** · **[nit]**

---

## Security

### [high] `?token=` query param accepted on ALL authenticated endpoints

`distribution_backend/internal/auth/middleware.go`

`RequireAuth` now falls back to `r.URL.Query().Get("token")` for *every* protected endpoint, not just the SSE route. This means any request with a `?token=…` parameter bypasses the Authorization header. Tokens passed as query params are:
- Logged verbatim in every reverse-proxy and server access log
- Stored in browser history
- Leaked via the `Referer` header on cross-origin navigation

The fallback should be scoped only to the SSE endpoint (`/api/inventory/subscribe`), or the SSE endpoint should use a short-lived, single-use exchange token rather than the main JWT.

---

### [high] User input interpolated directly into JSON error strings

`distribution_backend/internal/handlers/requests.go:304,312`

```go
http.Error(w, fmt.Sprintf(`{"error":"invalid code '%s': material instance not found"}`, code), ...)
http.Error(w, fmt.Sprintf(`{"error":"invalid code '%s': does not belong to the expected material type"}`, code), ...)
```

`code` is user-supplied. If it contains `"` or `\`, the response body is malformed JSON. Use a struct + `json.Marshal` or `json.NewEncoder`:

```go
type errBody struct { Error string `json:"error"` }
json.NewEncoder(w).Encode(errBody{Error: "invalid code '" + code + "': material instance not found"})
```

---

### [medium] Rollback is not atomic — no transaction

`distribution_backend/internal/db/audit_rollback.go:RollbackAuditEntry`

The entity update and `MarkRolledBack` are two separate DB calls with no transaction. If the process dies between them, the entity is already restored but the audit entry still shows `rolled_back = false`, so the same rollback could be applied again on the next attempt. Wrap both in a `sql.Tx`.

---

## Correctness

### [high] `request.archive`/`unarchive` rollbacks will always fail

`distribution_backend/internal/handlers/requests.go:397-401`

`ArchiveIncomingRequest` logs:
```go
_ = h.auditLogger.Log(..., "request.archive", ..., map[string]interface{}{"archived": true}, nil)
//                                                                                            ^^^
```

`previousState` is `nil`. But `RollbackAuditEntry` checks:
```go
if entry.PreviousState == nil {
    return ..., ErrNoPreviousState
}
```

So every attempt to roll back a `request.archive` or `request.unarchive` will be rejected with `ErrNoPreviousState`, even though the rollback logic exists. The previous archive state needs to be fetched before the operation and passed as `previousState`.

---

### [medium] `GetAuditEntry` handler returns 404 for all errors, including DB failures

`distribution_backend/internal/handlers/audit.go:82-86`

```go
entry, err := h.store.GetAuditEntry(r.Context(), id)
if err != nil {
    http.Error(w, `{"error":"audit entry not found"}`, http.StatusNotFound)
    return
}
```

A connection timeout or constraint violation would silently return 404. Should check `errors.Is(err, sql.ErrNoRows)` for 404 and fall back to 500 for everything else. Same issue exists in `ListAuditEntries` (less critical since it returns empty slice, not a 500 mask).

---

### [medium] `inventory.update` audit logs incomplete `newState`

`distribution_backend/internal/handlers/inventory.go:615-618`

`previousState` captures all six fields correctly. `newState` (stored as `details`) only logs:
```go
"status":   instance.Status,
"location": instance.Location,
```

But `UpdateMaterialInstanceInput` can also update `description`. Anyone reading the audit log to understand what changed will see an incomplete picture. Either log all changed fields or log the full post-update instance.

---

### [medium] `ValidateMaterialCode` does not check instance status

`distribution_backend/internal/handlers/inventory.go:ValidateMaterialCode`

The endpoint validates that a code exists and belongs to the correct material type, but doesn't check `instance.Status`. An `archived` or already-`assigned` instance will pass validation and be accepted by the packaging workflow. The check should also verify `status == "available"` (or whatever the valid states for packaging are).

---

### [low] `AuditHandler.auditLogger` field is never used

`distribution_backend/internal/handlers/audit.go`

```go
type AuditHandler struct {
    store       *db.Store
    auditLogger *db.AuditLogger  // stored but never read
}
```

`AuditHandler` only reads entries and triggers rollbacks — it doesn't write new ones. The field can be removed.

---

### [low] `NewInventoryHandler`, `NewRequestsHandler`, `NewAuthHandler` are dead constructors

`main.go` now exclusively uses the `WithAudit` variants. The original constructors remain but are no longer called. They'll cause confusion ("which one do I use?"). Either remove them or collapse them (make the `auditLogger` param nilable in a single constructor, which is already how the nil-guard checks work).

---

### [low] Rollback zero-value coercion for missing JSON fields

`distribution_backend/internal/db/audit_rollback.go:rollbackMaterialInstance`

```go
useCount, _ := prev["useCount"].(float64)   // returns 0.0 if key is absent
...
SET use_count = $4 ...
int(useCount)  // 0
```

If a `previousState` was logged without `useCount` (e.g. a future code path), the rollback silently sets `use_count = 0` instead of leaving it unchanged. This is an implicit data-loss risk. Consider checking `ok` and skipping the field update if missing.

---

## Design / Architecture

### [medium] SSE subscriber filtering is O(N) per customer in org backend

`organization_backend/internal/api/request_handlers.go:631`

```go
if notif.CustomerID != claims.CustomerID {
    continue
}
```

Every notification from `request_change_channel` is delivered to every connected SSE subscriber, who then discard it if it doesn't match their customer ID. For many concurrent users this becomes wasteful. A per-customer subscriber map keyed by `customerID` would deliver directly. Low urgency for current scale, but worth a TODO comment.

---

### [medium] `InventoryNotifier` opens a second PG listener connection

`distribution_backend/internal/db/inventory_notify.go`

`distribution_backend` already has an `AvailabilityNotifier` (the pre-existing one) listening on `availability_change_channel`. `InventoryNotifier` opens a separate `pq.Listener` on the same channel. Two listeners on the same channel both receive every notification (PG fan-out), so functionally correct — but it doubles the idle DB connections for the same channel. Consider sharing one listener if the availability notifier is still in use, or consolidating into a single notifier.

---

### [low] `orgadmin` `url.ts` was not updated

`frontend/orgadmin/src/utils/url.ts` is not in the diff, meaning it still has the old `getBaseUrl()` / `isLoopbackHost()` logic while the other three apps were simplified. Either intentional (orgadmin doesn't serve assets) or an oversight.

---

## Nits / Minor

### [nit] Silent bad `from`/`to` params in audit list

`audit.go:ListAuditEntries` — if `from` or `to` fails `time.Parse`, the error is silently ignored and the filter is skipped. The request succeeds but returns unfiltered results, which is surprising. Consider returning a 400.

### [nit] `fmt.Fprintf` write errors ignored in SSE handlers

Both `SubscribeInventory` and `SubscribeMyRequests` discard `fmt.Fprintf` errors. On client disconnect, writes fail silently until `r.Context().Done()` fires. This is generally fine for SSE, but logging the error at debug level would help diagnose connection issues.

### [nit] `plans/` directory committed to main

`plans/audit-log.md`, `plans/dist-workflow.md`, etc. are pre-implementation specs that have already been implemented. They add noise to the working tree. Move to a `docs/` folder or remove.

### [nit] `distribution/src/services/api.ts` — `API_BASE` hardcoded to `''`

```ts
const API_BASE = '';
```

The env var `VITE_API_URL` was silently removed. If you ever need to run the distribution frontend against a different API origin during local dev, this will need to be added back. A comment explaining the intentional removal would help.

### [nit] `mockRequests.ts` deleted, `mockReturns.ts` kept

`frontend/distribution/src/services/mockRequests.ts` was deleted but `mockReturns.ts` remains. If returns now also use real API calls, `mockReturns.ts` should be deleted too. If still in use, `mockRequests.ts` deletion should be verified not to break any fallback path.

---

## Summary

| # | Severity | Issue |
|---|---|---|
| 1 | **high** | `?token=` accepted on all authenticated routes, not just SSE |
| 2 | **high** | User input interpolated into JSON error strings (broken JSON / info leak) |
| 3 | **medium** | Rollback not atomic — no DB transaction wrapping update + mark |
| 4 | **high** | `request.archive`/`unarchive` rollbacks always fail (`previousState` is nil) |
| 5 | **medium** | `GetAuditEntry` handler returns 404 for all DB errors |
| 6 | **medium** | `inventory.update` audit logs incomplete `newState` (missing description) |
| 7 | **medium** | `ValidateMaterialCode` doesn't check instance status |
| 8 | **low** | `AuditHandler.auditLogger` field is stored but never used |
| 9 | **low** | Three `New*Handler` constructors are dead code |
| 10 | **low** | Rollback silently sets numeric fields to 0 if missing from `previousState` |
| 11 | **medium** | SSE request subscriber does O(N) filtering per notification |
| 12 | **medium** | Two PG listener connections on the same channel |
| 13 | **low** | `orgadmin/url.ts` not updated with the simplified logic |
