package db

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"distribution_backend/internal/client"
	"github.com/lib/pq"
)

type AvailabilityChange struct {
	MaterialTypeID string    `json:"material_type_id"`
	Action         string    `json:"action"`
	Timestamp      time.Time `json:"timestamp"`
}

type AvailabilityNotifier struct {
	connStr      string
	orgClient    *client.OrgClient
	store        *Store
	distCenterID string
	mu           sync.RWMutex
	pending      map[string]bool // material types with pending changes
	debounceMs   time.Duration
}

func NewAvailabilityNotifier(connStr string, orgClient *client.OrgClient, store *Store, distCenterID string) *AvailabilityNotifier {
	return &AvailabilityNotifier{
		connStr:      connStr,
		orgClient:    orgClient,
		store:        store,
		distCenterID: distCenterID,
		pending:      map[string]bool{},
		debounceMs:   500 * time.Millisecond,
	}
}

func (n *AvailabilityNotifier) Start(ctx context.Context) error {
	listener := pq.NewListener(n.connStr, 10*time.Second, 30*time.Second, nil)
	if err := listener.Listen("availability_change_channel"); err != nil {
		return err
	}

	go func() {
		defer listener.Close()
		debounceTimer := time.NewTimer(n.debounceMs)
		defer debounceTimer.Stop()
		debounceTimer.Stop() // Don't fire immediately

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
					log.Printf("Failed to unmarshal availability change: %v", err)
					continue
				}
				n.mu.Lock()
				n.pending[change.MaterialTypeID] = true
				n.mu.Unlock()
				// Reset debounce timer
				debounceTimer.Reset(n.debounceMs)
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
	// Clear pending map
	n.pending = map[string]bool{}
	n.mu.Unlock()

	// Get current availability counts
	availability, err := n.store.GetAvailableCountsByType(ctx)
	if err != nil {
		log.Printf("Failed to get available counts: %v", err)
		return
	}

	// Convert to map
	availMap := make(map[string]int)
	for _, a := range availability {
		availMap[a.MaterialTypeID] = a.Amount
	}

	// Send to org backend
	if err := n.orgClient.UpdateAvailability(ctx, n.distCenterID, availMap); err != nil {
		log.Printf("Failed to update availability in org backend: %v", err)
	}
}
