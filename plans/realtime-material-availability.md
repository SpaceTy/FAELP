# Real-Time Material Availability Updates

## Overview

This plan describes implementing real-time material availability updates from distribution_backend to the user/orgadmin frontends via organization_backend, using PostgreSQL triggers and Server-Sent Events (SSE).

## Current Architecture

### Existing Trigger System (Requests)

The organization_backend already has a working PostgreSQL trigger notification system for requests:

```
┌─────────────────┐     pg_notify      ┌─────────────────┐     SSE     ┌─────────────────┐
│  requests table │ ─────────────────► │  Notifier.go    │ ──────────► │  user frontend  │
│  (trigger)      │  requests_channel  │  (listener)     │             │                 │
└─────────────────┘                    └─────────────────┘             └─────────────────┘
```

Key files:
- [`organization_backend/internal/db/migrations/001_init.sql`](organization_backend/internal/db/migrations/001_init.sql:66-85) - Trigger function `notify_request_change()`
- [`organization_backend/internal/db/notify.go`](organization_backend/internal/db/notify.go:32-58) - `Notifier` listens on `requests_channel`
- [`organization_backend/internal/api/handlers.go`](organization_backend/internal/api/handlers.go:198-251) - SSE handler `SubscribeRequests()`
- [`frontend/user/src/services/sse.ts`](frontend/user/src/services/sse.ts:48-72) - Frontend SSE subscription

### Current Material Availability Flow

```
┌───────────────────────┐                    ┌───────────────────────┐
│  distribution_backend │                    │  organization_backend │
│                       │                    │                       │
│  material_instances   │  HTTP/Unix Socket  │  material_available   │
│  (per-instance status)│ ─────────────────► │  (aggregated counts)  │
│                       │  manual API call   │                       │
└───────────────────────┘                    └───────────────────────┘
         │                                            │
         │ No automatic sync                          │ No real-time updates
         ▼                                            ▼
    Changes require                              Frontend must reload
    manual trigger                               to see changes
```

## Proposed Architecture

### Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                 PostgreSQL Databases                                  │
│                                                                                      │
│  ┌───────────────────────┐                         ┌───────────────────────┐        │
│  │  dist_backend DB      │                         │  org_backend DB       │        │
│  │                       │                         │                       │        │
│  │  material_instances   │  1. Trigger on change   │  material_available   │        │
│  │  (trigger)            │ ─────────────────────►  │  (trigger)            │        │
│  │                       │  notify_org_backend     │                       │        │
│  └───────────────────────┘                         └───────────────────────┘        │
│                                                              │                       │
│                                                              │ 2. pg_notify          │
│                                                              │    material_channel   │
│                                                              ▼                       │
│                                                     ┌───────────────────────┐        │
│                                                     │  Notifier             │        │
│                                                     │  (listener)           │        │
│                                                     └───────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                                               │
                                                               │ 3. SSE
                                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                   Frontends                                           │
│                                                                                      │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐    │
│  │  user frontend        │  │  orgadmin frontend    │  │  distadmin frontend   │    │
│  │  (materials page)     │  │  (materials page)     │  │  (optional)           │    │
│  └───────────────────────┘  └───────────────────────┘  └───────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Steps

## Phase 1: Distribution Backend Trigger

### 1.1 Create Trigger Function in dist_backend

Create a trigger on `material_instances` table that calls organization_backend when availability changes.

**File: `distribution_backend/internal/db/migrations/004_availability_trigger.sql`**

```sql
-- Function to notify organization backend of availability changes
CREATE OR REPLACE FUNCTION notify_availability_change()
RETURNS trigger AS $$
BEGIN
  -- Signal that availability has changed for this material type
  -- The actual notification will be handled by the application layer
  PERFORM pg_notify('availability_change_channel', 
    json_build_object(
      'material_type_id', COALESCE(NEW.type_id, OLD.type_id),
      'action', TG_OP,
      'timestamp', now()
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on material_instances table
DROP TRIGGER IF EXISTS material_instances_availability_notify ON material_instances;
CREATE TRIGGER material_instances_availability_notify
AFTER INSERT OR UPDATE OR DELETE ON material_instances
FOR EACH ROW
EXECUTE FUNCTION notify_availability_change();
```

### 1.2 Create Availability Notifier in dist_backend

**File: `distribution_backend/internal/db/notify.go`**

Similar to organization_backend's notifier, but listens for availability changes and triggers sync to org_backend.

## Phase 2: Organization Backend Notification System

### 2.1 Add Material Availability Trigger in org_backend

**File: `organization_backend/internal/db/migrations/006_material_availability_trigger.sql`**

```sql
-- Function to notify when material_available changes
CREATE OR REPLACE FUNCTION notify_material_availability_change()
RETURNS trigger AS $$
DECLARE
  payload json;
BEGIN
  payload = json_build_object(
    'material_type_id', COALESCE(NEW.material_type_id, OLD.material_type_id),
    'distribution_center_id', COALESCE(NEW.distribution_center_id, OLD.distribution_center_id),
    'amount', COALESCE(NEW.amount, 0),
    'action', TG_OP,
    'updated_at', now()
  );
  PERFORM pg_notify('material_availability_channel', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on material_available table
DROP TRIGGER IF EXISTS material_available_notify ON material_available;
CREATE TRIGGER material_available_notify
AFTER INSERT OR UPDATE OR DELETE ON material_available
FOR EACH ROW
EXECUTE FUNCTION notify_material_availability_change();
```

### 2.2 Create Material Availability Notifier

**File: `organization_backend/internal/db/material_notify.go`**

```go
package db

import (
    "context"
    "encoding/json"
    "sync"
    "time"

    "github.com/lib/pq"
)

type MaterialAvailabilityUpdate struct {
    MaterialTypeID      string    `json:"material_type_id"`
    DistributionCenterID string   `json:"distribution_center_id"`
    Amount              int       `json:"amount"`
    Action              string    `json:"action"`
    UpdatedAt           time.Time `json:"updated_at"`
}

type MaterialNotifier struct {
    connStr string
    mu      sync.RWMutex
    subs    map[int]chan MaterialAvailabilityUpdate
    nextID  int
}

func NewMaterialNotifier(connStr string) *MaterialNotifier {
    return &MaterialNotifier{
        connStr: connStr,
        subs:    map[int]chan MaterialAvailabilityUpdate{},
    }
}

func (n *MaterialNotifier) Start(ctx context.Context) error {
    listener := pq.NewListener(n.connStr, 10*time.Second, 30*time.Second, nil)
    if err := listener.Listen("material_availability_channel"); err != nil {
        return err
    }

    go func() {
        defer listener.Close()
        for {
            select {
            case <-ctx.Done():
                return
            case notif := <-listener.Notify:
                if notif == nil {
                    continue
                }
                var update MaterialAvailabilityUpdate
                if err := json.Unmarshal([]byte(notif.Extra), &update); err != nil {
                    continue
                }
                n.broadcast(update)
            }
        }
    }()

    return nil
}

// Subscribe, Unsubscribe, broadcast methods similar to existing Notifier
```

### 2.3 Add SSE Endpoint for Material Availability

**File: `organization_backend/internal/api/material_handlers.go`**

```go
// SubscribeMaterialAvailability handles SSE subscriptions for material availability
func (h *Handler) SubscribeMaterialAvailability(w http.ResponseWriter, r *http.Request) {
    // Optional: Check authentication
    claims := GetClaimsFromContext(r.Context())
    
    events := make(chan []byte, 10)
    subID, updates := h.MaterialNotifier.Subscribe()
    defer h.MaterialNotifier.Unsubscribe(subID)

    go func() {
        defer close(events)
        ctx := r.Context()
        
        // Send initial snapshot
        materials, _ := h.Store.ListMaterialTypesWithAvailability(ctx)
        snapshotPayload, _ := json.Marshal(map[string]interface{}{
            "type":      "snapshot",
            "materials": materials,
        })
        events <- snapshotPayload
        
        // Stream updates
        for {
            select {
            case <-ctx.Done():
                return
            case update, ok := <-updates:
                if !ok {
                    return
                }
                // Fetch updated material and send
                material, err := h.Store.GetMaterialTypeByID(ctx, update.MaterialTypeID)
                if err != nil {
                    continue
                }
                // Get updated availability
                materialsWithAvail, _ := h.Store.ListMaterialTypesWithAvailability(ctx)
                for _, m := range materialsWithAvail {
                    if m.ID == update.MaterialTypeID {
                        material.AvailableCount = m.AvailableCount
                        break
                    }
                }
                payload, _ := json.Marshal(map[string]interface{}{
                    "type":     "update",
                    "action":   update.Action,
                    "material": material,
                })
                events <- payload
            }
        }
    }()

    transport.Stream(w, r, events)
}
```

### 2.4 Register Route

**File: `organization_backend/internal/api/routes.go`**

```go
// Add material availability SSE endpoint
r.Get("/material-availability/subscribe", h.SubscribeMaterialAvailability)
```

## Phase 3: Distribution Backend to Organization Backend Sync

### 3.1 Create Sync Endpoint in org_backend

**File: `organization_backend/internal/api/internal_handlers.go`**

```go
// UpdateAvailabilityFromDistBackend receives availability updates from distribution backends
func (h *Handler) UpdateAvailabilityFromDistBackend(w http.ResponseWriter, r *http.Request) {
    // Verify request comes from internal socket or valid API key
    // This endpoint is called via Unix socket or internal API
    
    var req struct {
        DistributionCenterID string         `json:"distributionCenterId"`
        Availability         map[string]int `json:"availability"` // material_type_id -> count
    }
    
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
        return
    }
    
    // Update material_available table
    // This will trigger the pg_notify automatically
    err := h.Store.UpdateMaterialAvailability(r.Context(), req.DistributionCenterID, req.Availability)
    if err != nil {
        writeError(w, http.StatusInternalServerError, "update_failed", err.Error())
        return
    }
    
    writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
```

### 3.2 Create Sync Client in dist_backend

**File: `distribution_backend/internal/client/org_client.go`** (extend existing)

```go
// UpdateAvailability sends current availability to organization backend
func (c *OrgClient) UpdateAvailability(ctx context.Context, distributionCenterID string, availability map[string]int) error {
    url := "http://unix/internal/availability"
    if c.unixClient == nil {
        url = fmt.Sprintf("%s/internal/availability", c.baseURL)
    }

    body := map[string]interface{}{
        "distributionCenterId": distributionCenterID,
        "availability":         availability,
    }
    bodyBytes, err := json.Marshal(body)
    if err != nil {
        return fmt.Errorf("failed to marshal request: %w", err)
    }

    req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
    if err != nil {
        return fmt.Errorf("failed to create request: %w", err)
    }
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.do(req)
    if err != nil {
        return fmt.Errorf("failed to update availability: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("organization backend returned status %d", resp.StatusCode)
    }

    return nil
}
```

### 3.3 Trigger Sync on Material Instance Changes

**File: `distribution_backend/internal/db/notify.go`**

```go
package db

import (
    "context"
    "encoding/json"
    "sync"
    "time"

    "github.com/lib/pq"
    "distribution_backend/internal/client"
)

type AvailabilityChange struct {
    MaterialTypeID string    `json:"material_type_id"`
    Action         string    `json:"action"`
    Timestamp      time.Time `json:"timestamp"`
}

type AvailabilityNotifier struct {
    connStr    string
    orgClient  *client.OrgClient
    store      *Store
    distCenterID string
    mu         sync.RWMutex
    pending    map[string]bool // material types with pending changes
}

func (n *AvailabilityNotifier) Start(ctx context.Context) error {
    listener := pq.NewListener(n.connStr, 10*time.Second, 30*time.Second, nil)
    if err := listener.Listen("availability_change_channel"); err != nil {
        return err
    }

    go func() {
        defer listener.Close()
        debounceTimer := time.NewTicker(500 * time.Millisecond)
        defer debounceTimer.Stop()
        
        for {
            select {
            case <-ctx.Done():
                return
            case <-debounceTimer.C:
                // Batch and send updates
                n.syncToOrgBackend(ctx)
            case notif := <-listener.Notify:
                if notif == nil {
                    continue
                }
                var change AvailabilityChange
                if err := json.Unmarshal([]byte(notif.Extra), &change); err != nil {
                    continue
                }
                n.mu.Lock()
                n.pending[change.MaterialTypeID] = true
                n.mu.Unlock()
            }
        }
    }()

    return nil
}

func (n *AvailabilityNotifier) syncToOrgBackend(ctx context.Context) {
    n.mu.Lock()
    if len(n.pending) == 0 {
        n.mu.Unlock()
        return
    }
    n.pending = make(map[string]bool)
    n.mu.Unlock()
    
    // Get current availability
    availability, err := n.store.GetAvailableCountsByType(ctx)
    if err != nil {
        return
    }
    
    // Convert to map
    availMap := make(map[string]int)
    for _, a := range availability {
        availMap[a.MaterialTypeID] = a.Amount
    }
    
    // Send to org backend
    n.orgClient.UpdateAvailability(ctx, n.distCenterID, availMap)
}
```

## Phase 4: Frontend Integration

### 4.1 Create Material Availability SSE Service

**File: `frontend/user/src/services/materialSse.ts`**

```typescript
import type { Material } from '@/types/material';

const API_BASE = '/api';

interface MaterialAvailabilityEvent {
  type: 'snapshot' | 'update';
  materials?: Material[];
  material?: Material;
  action?: string;
}

type EventCallback = (data: MaterialAvailabilityEvent) => void;

class MaterialSseService {
  private eventSource: EventSource | null = null;
  
  subscribeToAvailability(onEvent: EventCallback): { unsubscribe: () => void } {
    const url = `${API_BASE}/material-availability/subscribe`;
    
    this.eventSource = new EventSource(url);
    
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as MaterialAvailabilityEvent;
        onEvent(data);
      } catch (err) {
        console.error('Failed to parse material SSE event:', err);
      }
    };
    
    this.eventSource.onerror = () => {
      console.error('Material SSE connection error');
    };
    
    return {
      unsubscribe: () => this.disconnect()
    };
  }
  
  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }
}

export const materialSse = new MaterialSseService();
```

### 4.2 Update MaterialTypesContext

**File: `frontend/user/src/context/MaterialTypesContext.tsx`**

```typescript
// Add SSE subscription in the context
import { materialSse } from '@/services/materialSse';

function MaterialTypesProvider({ children }: { children: React.ReactNode }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  // ... existing state ...

  useEffect(() => {
    fetchMaterials();
    
    // Subscribe to real-time updates
    const subscription = materialSse.subscribeToAvailability((event) => {
      if (event.type === 'snapshot' && event.materials) {
        setMaterials(event.materials.map(m => ({
          ...m,
          category: determineCategory(m),
          imageUrl: ensureImageUrl(m)
        })));
      } else if (event.type === 'update' && event.material) {
        setMaterials(prev => {
          const index = prev.findIndex(m => m.id === event.material!.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = {
              ...event.material!,
              category: determineCategory(event.material!),
              imageUrl: ensureImageUrl(event.material!)
            };
            return updated;
          }
          return prev;
        });
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // ... rest of context ...
}
```

## Phase 5: OrgAdmin Frontend

Similar changes to orgadmin frontend for material availability display.

## Implementation Order

1. **Phase 2.1**: Add material_available trigger in org_backend
2. **Phase 2.2**: Create MaterialNotifier in org_backend
3. **Phase 2.3-2.4**: Add SSE endpoint and route in org_backend
4. **Phase 3.1**: Add internal availability update endpoint in org_backend
5. **Phase 3.2-3.3**: Create sync mechanism in dist_backend
6. **Phase 4**: Update user frontend with SSE subscription
7. **Phase 5**: Update orgadmin frontend

## Database Migration Files

### organization_backend

1. `006_material_availability_trigger.sql` - Trigger on material_available table

### distribution_backend

1. `004_availability_trigger.sql` - Trigger on material_instances table

## Testing Plan

1. **Unit Tests**: Test trigger functions in isolation
2. **Integration Tests**: 
   - Create/update/delete material instance in dist_backend
   - Verify org_backend receives update
   - Verify frontend receives SSE event
3. **E2E Tests**: Full flow from dist_backend change to frontend update

## Rollback Plan

1. Disable triggers: `DROP TRIGGER IF EXISTS ... ON ...`
2. Remove SSE endpoints
3. Frontend falls back to polling or manual refresh

## Security Considerations

1. Internal endpoints should only accept requests from:
   - Unix socket (file permissions)
   - Valid API keys for remote distribution backends
2. SSE endpoints should require authentication for sensitive data
3. Rate limiting on SSE connections to prevent abuse
