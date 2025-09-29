package watcher

import (
	"encoding/json"
	"sync"
	"time"
)

// EventHub is a very small in-memory pub/sub hub used to broadcast events
// from the VM watcher to connected SSE clients. It is intentionally simple
// (no persistence) and suitable for single-node deployments or as a shim
// while introducing a production pub/sub (Redis, NATS, etc.).
type EventHub struct {
	mu      sync.Mutex
	clients map[chan string]struct{}
}

// NewEventHub creates a new event hub
func NewEventHub() *EventHub {
	return &EventHub{clients: make(map[chan string]struct{})}
}

// Register adds a new subscriber and returns a channel which will receive
// stringified JSON event payloads. The caller must call Unregister when done.
func (h *EventHub) Register() chan string {
	ch := make(chan string, 16)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

// Unregister removes a subscriber and closes the channel.
func (h *EventHub) Unregister(ch chan string) {
	h.mu.Lock()
	if _, ok := h.clients[ch]; ok {
		delete(h.clients, ch)
		close(ch)
	}
	h.mu.Unlock()
}

// Broadcast sends the given message to all registered clients. It does a
// non-blocking send per-client to avoid a slow/blocked client from stalling
// the hub. Messages should already be JSON-encoded strings.
func (h *EventHub) Broadcast(msg string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.clients {
		select {
		case ch <- msg:
		default:
			// drop the message for slow listeners
		}
	}
}

// helper to serialize a generic event with a timestamp
func (h *EventHub) BroadcastEvent(typ string, payload interface{}) {
	env := map[string]interface{}{
		"type":      typ,
		"payload":   payload,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	b, err := json.Marshal(env)
	if err != nil {
		return
	}
	h.Broadcast(string(b))
}

// Shared hub instance used by the watcher and HTTP handlers in server package.
var DefaultHub = NewEventHub()
