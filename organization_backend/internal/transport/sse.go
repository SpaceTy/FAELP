package transport

import (
	"fmt"
	"net/http"
)

func Stream(w http.ResponseWriter, r *http.Request, events <-chan []byte) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	flusher.Flush()
	for {
		select {
		case <-r.Context().Done():
			return
		case payload, ok := <-events:
			if !ok {
				return
			}
			fmt.Fprintf(w, "event: update\ndata: %s\n\n", payload)
			flusher.Flush()
		}
	}
}
