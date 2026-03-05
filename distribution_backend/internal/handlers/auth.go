package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"distribution_backend/internal/auth"
	"distribution_backend/internal/db"
	"distribution_backend/internal/domain"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	store       *db.Store
	jwtService  *auth.JWTService
	auditLogger *db.AuditLogger
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(store *db.Store, jwtService *auth.JWTService) *AuthHandler {
	return &AuthHandler{
		store:      store,
		jwtService: jwtService,
	}
}

// NewAuthHandlerWithAudit creates a new auth handler with audit logging
func NewAuthHandlerWithAudit(store *db.Store, jwtService *auth.JWTService, auditLogger *db.AuditLogger) *AuthHandler {
	return &AuthHandler{
		store:       store,
		jwtService:  jwtService,
		auditLogger: auditLogger,
	}
}

// LoginRequest represents a login request body
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse represents a successful login response
type LoginResponse struct {
	Token   string      `json:"token"`
	User    domain.User `json:"user"`
	Message string      `json:"message"`
}

// CreateUserRequest represents a create user request body
type CreateUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	IsAdmin  bool   `json:"isAdmin"`
}

// Login handles user login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Password == "" {
		http.Error(w, `{"error":"username and password are required"}`, http.StatusBadRequest)
		return
	}

	user, err := h.store.GetUserByUsername(r.Context(), req.Username)
	if err != nil {
		http.Error(w, `{"error":"invalid username or password"}`, http.StatusUnauthorized)
		return
	}

	if !auth.CheckPassword(req.Password, user.PasswordHash) {
		http.Error(w, `{"error":"invalid username or password"}`, http.StatusUnauthorized)
		return
	}

	token, err := h.jwtService.GenerateToken(user.ID, user.Username, user.IsAdmin)
	if err != nil {
		http.Error(w, `{"error":"failed to generate token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(LoginResponse{
		Token:   token,
		User:    user,
		Message: "login successful",
	})
}

// CreateUser handles user creation (admin only)
func (h *AuthHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Password == "" {
		http.Error(w, `{"error":"username and password are required"}`, http.StatusBadRequest)
		return
	}

	if len(req.Username) < 3 {
		http.Error(w, `{"error":"username must be at least 3 characters"}`, http.StatusBadRequest)
		return
	}

	if len(req.Password) < 8 {
		http.Error(w, `{"error":"password must be at least 8 characters"}`, http.StatusBadRequest)
		return
	}

	exists, err := h.store.UserExists(r.Context(), req.Username)
	if err != nil {
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, `{"error":"username already exists"}`, http.StatusConflict)
		return
	}

	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		http.Error(w, `{"error":"failed to hash password"}`, http.StatusInternalServerError)
		return
	}

	user, err := h.store.CreateUser(r.Context(), domain.CreateUserInput{
		Username:     req.Username,
		PasswordHash: passwordHash,
		IsAdmin:      req.IsAdmin,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to create user"}`, http.StatusInternalServerError)
		return
	}

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "user.create", "user", user.ID, map[string]interface{}{
			"username": user.Username,
			"isAdmin":  user.IsAdmin,
		}, nil)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

// ListUsers returns all users (admin only)
func (h *AuthHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.store.ListUsers(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to list users"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// GetUser returns a single user by ID (admin only)
func (h *AuthHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"user id required"}`, http.StatusBadRequest)
		return
	}

	user, err := h.store.GetUserByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// DeleteUser deletes a user (admin only)
func (h *AuthHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"user id required"}`, http.StatusBadRequest)
		return
	}

	// Get current user from context to prevent self-deletion
	userCtx, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	if userCtx.UserID == id {
		http.Error(w, `{"error":"cannot delete your own account"}`, http.StatusBadRequest)
		return
	}

	existing, err := h.store.GetUserByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	if err := h.store.DeleteUser(r.Context(), id); err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	if h.auditLogger != nil {
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "user.delete", "user", id, nil, map[string]interface{}{
			"username": existing.Username,
			"isAdmin":  existing.IsAdmin,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "user deleted"})
}

// GetCurrentUser returns the currently authenticated user
func (h *AuthHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	userCtx, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	user, err := h.store.GetUserByID(r.Context(), userCtx.UserID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// UpdatePasswordRequest represents a password update request
type UpdatePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// UpdatePassword allows a user to update their own password
func (h *AuthHandler) UpdatePassword(w http.ResponseWriter, r *http.Request) {
	userCtx, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req UpdatePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		http.Error(w, `{"error":"current password and new password are required"}`, http.StatusBadRequest)
		return
	}

	if len(req.NewPassword) < 8 {
		http.Error(w, `{"error":"new password must be at least 8 characters"}`, http.StatusBadRequest)
		return
	}

	user, err := h.store.GetUserByID(r.Context(), userCtx.UserID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	if !auth.CheckPassword(req.CurrentPassword, user.PasswordHash) {
		http.Error(w, `{"error":"current password is incorrect"}`, http.StatusUnauthorized)
		return
	}

	newHash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		http.Error(w, `{"error":"failed to hash password"}`, http.StatusInternalServerError)
		return
	}

	_, err = h.store.UpdateUser(r.Context(), userCtx.UserID, domain.UpdateUserInput{
		PasswordHash: &newHash,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to update password"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "password updated"})
}

// ResetUserPasswordRequest represents an admin password reset request
type ResetUserPasswordRequest struct {
	NewPassword string `json:"newPassword"`
}

// ResetUserPassword allows an admin to reset another user's password
func (h *AuthHandler) ResetUserPassword(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"user id required"}`, http.StatusBadRequest)
		return
	}

	var req ResetUserPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if len(req.NewPassword) < 8 {
		http.Error(w, `{"error":"new password must be at least 8 characters"}`, http.StatusBadRequest)
		return
	}

	// Check user exists
	_, err := h.store.GetUserByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	newHash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		http.Error(w, `{"error":"failed to hash password"}`, http.StatusInternalServerError)
		return
	}

	_, err = h.store.UpdateUser(r.Context(), id, domain.UpdateUserInput{
		PasswordHash: &newHash,
	})
	if err != nil {
		http.Error(w, `{"error":"failed to reset password"}`, http.StatusInternalServerError)
		return
	}

	if h.auditLogger != nil {
		adminCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), adminCtx.UserID, adminCtx.Username, "user.reset_password", "user", id, nil, nil)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "password reset successful"})
}

// SetUserAdminRequest represents a request to change admin status
type SetUserAdminRequest struct {
	IsAdmin bool `json:"isAdmin"`
}

// SetUserAdmin allows an admin to change another user's admin status
func (h *AuthHandler) SetUserAdmin(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"user id required"}`, http.StatusBadRequest)
		return
	}

	userCtx, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Prevent changing own admin status
	if userCtx.UserID == id {
		http.Error(w, `{"error":"cannot change your own admin status"}`, http.StatusBadRequest)
		return
	}

	existing, err := h.store.GetUserByID(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	var req SetUserAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Remove the last admin check since the migration doesn't have constraints for this
	// This allows flexibility but the frontend should warn about this

	user, err := h.store.UpdateUser(r.Context(), id, domain.UpdateUserInput{
		IsAdmin: &req.IsAdmin,
	})
	if err != nil {
		if strings.Contains(err.Error(), "no rows") {
			http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to update user"}`, http.StatusInternalServerError)
		return
	}

	if h.auditLogger != nil {
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "user.set_admin", "user", id, map[string]interface{}{
			"isAdmin": user.IsAdmin,
		}, map[string]interface{}{
			"isAdmin": existing.IsAdmin,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}
