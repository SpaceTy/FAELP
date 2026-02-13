package api

import (
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"
)

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Log every request at INFO level so it always shows up
		slog.Info("cors_middleware",
			"method", r.Method,
			"path", r.URL.Path,
			"remote_addr", r.RemoteAddr,
			"origin", r.Header.Get("Origin"),
			"content_type", r.Header.Get("Content-Type"),
		)

		// Set CORS headers immediately before anything else
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			slog.Info("cors_preflight_response", "path", r.URL.Path, "status", 200)
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// RecoveryMiddleware catches panics and logs them
func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				slog.Error("panic_recovered",
					"error", fmt.Sprintf("%v", err),
					"path", r.URL.Path,
					"method", r.Method,
					"stack", string(debug.Stack()),
				)
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(`{"error":"internal_error","message":"Internal server error"}`))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// DebugMiddleware logs all HTTP requests and responses with timing
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

func (rw *responseWriter) WriteHeader(code int) {
	if !rw.written {
		rw.statusCode = code
		rw.written = true
		rw.ResponseWriter.WriteHeader(code)
	}
}

func DebugMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		path := r.URL.Path
		method := r.Method

		slog.Info("http_request_started",
			"method", method,
			"path", path,
			"remote_addr", r.RemoteAddr,
			"user_agent", r.UserAgent(),
		)

		wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(wrapped, r)

		duration := time.Since(start)
		slog.Info("http_request_completed",
			"method", method,
			"path", path,
			"status", wrapped.statusCode,
			"duration_ms", duration.Milliseconds(),
		)
	})
}
