package db

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/lib/pq"
)

type MaterialAvailabilityUpdate struct {
	MaterialTypeID       string    `json:"material_type_id"`
	DistributionCenterID string    `json:"distribution_center_id"`
	Amount               int       `json:"amount"`
	Action               string    `json:"action"`
	UpdatedAt            time.Time `json:"updated_at"`
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

func (n *MaterialNotifier) Subscribe() (int, <-chan MaterialAvailabilityUpdate) {
	n.mu.Lock()
	defer n.mu.Unlock()
	id := n.nextID
	n.nextID++
	ch := make(chan MaterialAvailabilityUpdate, 10)
	n.subs[id] = ch
	return id, ch
}

func (n *MaterialNotifier) Unsubscribe(id int) {
	n.mu.Lock()
	defer n.mu.Unlock()
	ch, ok := n.subs[id]
	if !ok {
		return
	}
	delete(n.subs, id)
	close(ch)
}

func (n *MaterialNotifier) broadcast(update MaterialAvailabilityUpdate) {
	n.mu.RLock()
	defer n.mu.RUnlock()
	for _, ch := range n.subs {
		select {
		case ch <- update:
		default:
		}
	}
}
