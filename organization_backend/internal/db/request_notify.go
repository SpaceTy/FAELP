package db

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/lib/pq"
)

type RequestChangeNotification struct {
	RequestID  string `json:"request_id"`
	CustomerID string `json:"customer_id"`
	Status     string `json:"status"`
	Action     string `json:"action"`
}

type RequestNotifier struct {
	connStr string
	mu      sync.RWMutex
	subs    map[int]chan RequestChangeNotification
	nextID  int
}

func NewRequestNotifier(connStr string) *RequestNotifier {
	return &RequestNotifier{
		connStr: connStr,
		subs:    map[int]chan RequestChangeNotification{},
	}
}

func (n *RequestNotifier) Start(ctx context.Context) error {
	listener := pq.NewListener(n.connStr, 10*time.Second, 30*time.Second, nil)
	if err := listener.Listen("request_change_channel"); err != nil {
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
				var update RequestChangeNotification
				if err := json.Unmarshal([]byte(notif.Extra), &update); err != nil {
					continue
				}
				n.broadcast(update)
			}
		}
	}()

	return nil
}

func (n *RequestNotifier) Subscribe() (int, <-chan RequestChangeNotification) {
	n.mu.Lock()
	defer n.mu.Unlock()
	id := n.nextID
	n.nextID++
	ch := make(chan RequestChangeNotification, 10)
	n.subs[id] = ch
	return id, ch
}

func (n *RequestNotifier) Unsubscribe(id int) {
	n.mu.Lock()
	defer n.mu.Unlock()
	ch, ok := n.subs[id]
	if !ok {
		return
	}
	delete(n.subs, id)
	close(ch)
}

func (n *RequestNotifier) broadcast(update RequestChangeNotification) {
	n.mu.RLock()
	defer n.mu.RUnlock()
	for _, ch := range n.subs {
		select {
		case ch <- update:
		default:
		}
	}
}
