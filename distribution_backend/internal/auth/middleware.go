package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const (
	UserContextKey contextKey = "user"
)

// UserContext holds the authenticated user information in request context
type UserContext struct {
	UserID   string
	Username string
	IsAdmin  bool
}

// Middleware provides authentication middleware
type Middleware struct {
	jwtService *JWTService
}

// NewMiddleware creates a new auth middleware
func NewMiddleware(jwtService *JWTService) *Middleware {
	return &Middleware{jwtService: jwtService}
}

// RequireAuth middleware validates JWT token and adds user to context
func (m *Middleware) RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			http.Error(w, `{"error":"invalid authorization header format"}`, http.StatusUnauthorized)
			return
		}

		claims, err := m.jwtService.ValidateToken(parts[1])
		if err != nil {
			http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		userCtx := UserContext{
			UserID:   claims.UserID,
			Username: claims.Username,
			IsAdmin:  claims.IsAdmin,
		}

		ctx := context.WithValue(r.Context(), UserContextKey, userCtx)
		next(w, r.WithContext(ctx))
	}
}

// RequireAdmin middleware checks if the authenticated user is an admin
func (m *Middleware) RequireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return m.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		userCtx, ok := GetUserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		if !userCtx.IsAdmin {
			http.Error(w, `{"error":"admin access required"}`, http.StatusForbidden)
			return
		}

		next(w, r)
	})
}

// GetUserFromContext extracts user information from request context
func GetUserFromContext(ctx context.Context) (UserContext, bool) {
	userCtx, ok := ctx.Value(UserContextKey).(UserContext)
	return userCtx, ok
}
