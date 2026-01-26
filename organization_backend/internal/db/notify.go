package db

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/lib/pq"
)

type RequestUpdate struct {
	RequestID string    `json:"request_id"`
	Action    string    `json:"action"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Notifier struct {
	connStr string
	mu      sync.RWMutex
	subs    map[int]chan RequestUpdate
	nextID  int
}

func NewNotifier(connStr string) *Notifier {
	return &Notifier{
		connStr: connStr,
		subs:    map[int]chan RequestUpdate{},
	}
}

func (n *Notifier) Start(ctx context.Context) error {
	listener := pq.NewListener(n.connStr, 10*time.Second, 30*time.Second, nil)
	if err := listener.Listen("requests_channel"); err != nil {
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
				var update RequestUpdate
				if err := json.Unmarshal([]byte(notif.Extra), &update); err != nil {
					continue
				}
				n.broadcast(update)
			}
		}
	}()

	return nil
}

func (n *Notifier) Subscribe() (int, <-chan RequestUpdate) {
	n.mu.Lock()
	defer n.mu.Unlock()
	id := n.nextID
	n.nextID++
	ch := make(chan RequestUpdate, 10)
	n.subs[id] = ch
	return id, ch
}

func (n *Notifier) Unsubscribe(id int) {
	n.mu.Lock()
	defer n.mu.Unlock()
	ch, ok := n.subs[id]
	if !ok {
		return
	}
	delete(n.subs, id)
	close(ch)
}

func (n *Notifier) broadcast(update RequestUpdate) {
	n.mu.RLock()
	defer n.mu.RUnlock()
	for _, ch := range n.subs {
		select {
		case ch <- update:
		default:
		}
	}
}
