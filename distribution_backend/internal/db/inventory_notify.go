package db

import (
	"context"
	"sync"
	"time"

	"github.com/lib/pq"
)

// InventoryNotifier broadcasts a signal to SSE subscribers whenever any
// material_instance row changes (reuses the existing availability_change_channel trigger).
type InventoryNotifier struct {
	connStr string
	mu      sync.RWMutex
	subs    map[int]chan struct{}
	nextID  int
}

func NewInventoryNotifier(connStr string) *InventoryNotifier {
	return &InventoryNotifier{
		connStr: connStr,
		subs:    map[int]chan struct{}{},
	}
}

func (n *InventoryNotifier) Start(ctx context.Context) error {
	listener := pq.NewListener(n.connStr, 10*time.Second, 30*time.Second, nil)
	if err := listener.Listen("availability_change_channel"); err != nil {
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
				n.broadcast()
			}
		}
	}()

	return nil
}

func (n *InventoryNotifier) Subscribe() (int, <-chan struct{}) {
	n.mu.Lock()
	defer n.mu.Unlock()
	id := n.nextID
	n.nextID++
	ch := make(chan struct{}, 10)
	n.subs[id] = ch
	return id, ch
}

func (n *InventoryNotifier) Unsubscribe(id int) {
	n.mu.Lock()
	defer n.mu.Unlock()
	ch, ok := n.subs[id]
	if !ok {
		return
	}
	delete(n.subs, id)
	close(ch)
}

func (n *InventoryNotifier) broadcast() {
	n.mu.RLock()
	defer n.mu.RUnlock()
	for _, ch := range n.subs {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}
