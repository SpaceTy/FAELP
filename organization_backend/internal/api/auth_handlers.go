package api

import (
	"encoding/json"
	"net/http"

	"organization_backend/internal/auth"
	"organization_backend/internal/db"
)

type AuthHandler struct {
	Store     *db.Store
	JWTSecret string
}

func (h *AuthHandler) RequestMagicLink(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	if err := auth.CreateMagicLink(r.Context(), req.Email); err != nil {
		writeError(w, http.StatusInternalServerError, "magic_link_failed", "Failed to create magic link")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

func (h *AuthHandler) MagicLinkCallback(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code  string `json:"code"`
		Email string `json:"email"` // Email is now optional but recommended
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	authResp, err := auth.AuthenticateWithCode(r.Context(), req.Code, req.Email)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "auth_failed", "Invalid or expired code")
		return
	}

	customer, err := h.Store.GetOrCreateCustomerByWorkOSUser(r.Context(), &authResp.User)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "customer_error", "Failed to process user")
		return
	}

	token, err := auth.GenerateToken(customer.ID, customer.Email, customer.WorkOSUserID, h.JWTSecret)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token_error", "Failed to create session")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token":    token,
		"userId":   customer.ID,
		"customer": customer,
	})
}

func (h *AuthHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	claims := GetClaimsFromContext(r.Context())
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Not authenticated")
		return
	}

	customer, err := h.Store.GetCustomerByID(r.Context(), claims.CustomerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_error", "Failed to fetch user")
		return
	}

	writeJSON(w, http.StatusOK, customer)
}
