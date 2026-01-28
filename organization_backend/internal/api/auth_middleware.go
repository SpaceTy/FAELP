package api

import (
	"context"
	"net/http"
	"strings"

	"organization_backend/internal/auth"
)

type contextKey string

const claimsContextKey contextKey = "authClaims"

func AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
				writeError(w, http.StatusUnauthorized, "missing_auth", "Authorization header or token query parameter required")
				return
			}

			claims, err := auth.ParseToken(token, jwtSecret)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid_token", "Invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), claimsContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetClaimsFromContext(ctx context.Context) *auth.Claims {
	claims, _ := ctx.Value(claimsContextKey).(*auth.Claims)
	return claims
}
