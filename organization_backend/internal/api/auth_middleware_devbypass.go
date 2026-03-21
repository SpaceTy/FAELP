//go:build devbypass

package api

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"organization_backend/internal/auth"
	"organization_backend/internal/db"
)

type contextKey string

const (
	claimsContextKey   contextKey = "authClaims"
	internalContextKey contextKey = "internalRequest"
)

// devClaims are injected into every request when running with the devbypass build tag.
var devClaims = &auth.Claims{
	CustomerID:   "dev-user",
	Email:        "dev@localhost",
	WorkOSUserID: "dev-workos-user",
	IsAdmin:      true,
}

func init() {
	slog.Warn("DEV AUTH BYPASS ENABLED — all requests are treated as authenticated admin")
}

// isUnixSocketRequest checks if the request came via Unix socket
func isUnixSocketRequest(r *http.Request) bool {
	remoteAddr := r.RemoteAddr
	return remoteAddr == "" ||
		strings.HasPrefix(remoteAddr, "@") ||
		strings.HasPrefix(remoteAddr, "/")
}

// InternalMiddleware marks requests from Unix sockets as internal
func InternalMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isUnixSocketRequest(r) {
				ctx := context.WithValue(r.Context(), internalContextKey, true)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// AuthMiddleware bypasses all auth checks and injects dev admin claims.
func AuthMiddleware(_ string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), claimsContextKey, devClaims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetClaimsFromContext(ctx context.Context) *auth.Claims {
	claims, _ := ctx.Value(claimsContextKey).(*auth.Claims)
	return claims
}

func IsInternalRequest(ctx context.Context) bool {
	internal, _ := ctx.Value(internalContextKey).(bool)
	return internal
}

// APIKeyMiddleware passes all requests through when dev bypass is enabled.
func APIKeyMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r)
		})
	}
}

// AdminMiddleware passes all requests through when dev bypass is enabled.
func AdminMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r)
		})
	}
}

// VerifiedUserMiddleware passes all requests through when dev bypass is enabled.
func VerifiedUserMiddleware(_ *db.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r)
		})
	}
}
