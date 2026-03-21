//go:build !devbypass

package api

import (
	"context"
	"errors"
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

// isUnixSocketRequest checks if the request came via Unix socket
func isUnixSocketRequest(r *http.Request) bool {
	// Unix socket connections have special RemoteAddr formats:
	// - Empty string
	// - Starts with "@" (abstract socket on Linux)
	// - Starts with "/" (filesystem socket path)
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
				// Mark as internal request - skip auth
				ctx := context.WithValue(r.Context(), internalContextKey, true)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			slog.Info("auth_middleware_entered",
				"path", r.URL.Path,
				"remote_addr", r.RemoteAddr,
			)

			// Skip auth for internal Unix socket requests
			if isUnixSocketRequest(r) {
				slog.Info("auth_skipped_unix_socket", "path", r.URL.Path)
				ctx := context.WithValue(r.Context(), internalContextKey, true)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			var token string

			// First try to get token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
					token = parts[1]
				}
			}

			// If no header, try query parameter (for SSE connections)
			if token == "" {
				token = r.URL.Query().Get("token")
			}

			if token == "" {
				slog.Info("auth_failed_no_token", "path", r.URL.Path)
				writeError(w, http.StatusUnauthorized, "missing_auth", "Authorization header or token query parameter required")
				return
			}

			claims, err := auth.ParseToken(token, jwtSecret)
			if err != nil {
				slog.Info("auth_failed_invalid_token",
					"path", r.URL.Path,
					"error", err.Error(),
				)
				writeError(w, http.StatusUnauthorized, "invalid_token", "Invalid or expired token")
				return
			}

			slog.Info("auth_success",
				"path", r.URL.Path,
				"customer_id", claims.CustomerID,
				"is_admin", claims.IsAdmin,
			)

			ctx := context.WithValue(r.Context(), claimsContextKey, claims)
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

// APIKeyMiddleware currently rejects all non-internal HTTP requests.
// Unix socket requests are allowed and used for current inter-service communication.
func APIKeyMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if IsInternalRequest(r.Context()) || isUnixSocketRequest(r) {
				next.ServeHTTP(w, r)
				return
			}
			writeError(w, http.StatusUnauthorized, "api_key_not_implemented", "API key authentication is not implemented yet")
		})
	}
}

// AdminMiddleware checks if the authenticated user is an admin
func AdminMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaimsFromContext(r.Context())
			if claims == nil {
				writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
				return
			}

			if !claims.IsAdmin {
				writeError(w, http.StatusForbidden, "forbidden", "Admin access required")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// VerifiedUserMiddleware checks if the authenticated user has been approved to place requests.
func VerifiedUserMiddleware(store *db.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaimsFromContext(r.Context())
			if claims == nil {
				writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
				return
			}

			user, err := store.GetUserByID(r.Context(), claims.CustomerID)
			if err != nil {
				if errors.Is(err, db.ErrUserNotFound) {
					writeError(w, http.StatusUnauthorized, "unauthorized", "User not found")
					return
				}
				writeError(w, http.StatusInternalServerError, "fetch_error", "Failed to fetch user")
				return
			}

			if !user.EmailVerified {
				writeError(w, http.StatusForbidden, "account_unverified", "Account is not verified")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
