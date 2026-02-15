package api

import (
	"encoding/json"
	"log"
	"net/http"

	"organization_backend/internal/auth"
	"organization_backend/internal/db"
)

type AuthHandler struct {
	Store     *db.Store
	JWTSecret string
}

func (h *AuthHandler) RequestMagicLink(w http.ResponseWriter, r *http.Request) {
	log.Println("[AUTH] RequestMagicLink: handler called")
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[AUTH] RequestMagicLink: failed to decode JSON: %v", err)
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}
	log.Printf("[AUTH] RequestMagicLink: requesting magic link for email=%s", req.Email)

	if err := auth.CreateMagicLink(r.Context(), req.Email); err != nil {
		log.Printf("[AUTH] RequestMagicLink: CreateMagicLink failed for email=%s: %v", req.Email, err)
		writeError(w, http.StatusInternalServerError, "magic_link_failed", "Failed to create magic link")
		return
	}

	log.Printf("[AUTH] RequestMagicLink: magic link sent successfully for email=%s", req.Email)
	writeJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

func (h *AuthHandler) MagicLinkCallback(w http.ResponseWriter, r *http.Request) {
	log.Println("[AUTH] MagicLinkCallback: handler called")
	var req struct {
		Code  string `json:"code"`
		Email string `json:"email"` // Email is now optional but recommended
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[AUTH] MagicLinkCallback: failed to decode JSON: %v", err)
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}
	log.Printf("[AUTH] MagicLinkCallback: verifying code for email=%s", req.Email)

	authResp, err := auth.AuthenticateWithCode(r.Context(), req.Code, req.Email)
	if err != nil {
		log.Printf("[AUTH] MagicLinkCallback: AuthenticateWithCode failed for email=%s: %v", req.Email, err)
		writeError(w, http.StatusUnauthorized, "auth_failed", "Invalid or expired code")
		return
	}
	log.Printf("[AUTH] MagicLinkCallback: WorkOS authentication successful for email=%s, workos_user_id=%s", req.Email, authResp.User.ID)

	customer, err := h.Store.GetOrCreateCustomerByWorkOSUser(r.Context(), &authResp.User)
	if err != nil {
		log.Printf("[AUTH] MagicLinkCallback: GetOrCreateCustomerByWorkOSUser failed: %v", err)
		writeError(w, http.StatusInternalServerError, "customer_error", "Failed to process user")
		return
	}
	log.Printf("[AUTH] MagicLinkCallback: customer resolved id=%s email=%s", customer.ID, customer.Email)

	token, err := auth.GenerateToken(customer.ID, customer.Email, customer.WorkOSUserID, customer.IsAdmin, h.JWTSecret)
	if err != nil {
		log.Printf("[AUTH] MagicLinkCallback: GenerateToken failed: %v", err)
		writeError(w, http.StatusInternalServerError, "token_error", "Failed to create session")
		return
	}

	log.Printf("[AUTH] MagicLinkCallback: login complete for customer_id=%s email=%s", customer.ID, customer.Email)
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
