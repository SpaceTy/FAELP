package api

import (
	"context"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"sync"
	"time"

	"organization_backend/internal/auth"
	"organization_backend/internal/db"
)

const defaultMagicLinkCooldown = 15 * time.Second

type AuthHandler struct {
	Store             *db.Store
	JWTSecret         string
	MagicLinkCooldown time.Duration

	magicLinkMu       sync.Mutex
	magicLinkLastSent map[string]time.Time
	now               func() time.Time
	createMagicLink   func(context.Context, string) error
}

func normalizeAuthEmail(email string) string {
	parsed, err := mail.ParseAddress(strings.TrimSpace(email))
	if err == nil {
		return strings.ToLower(strings.TrimSpace(parsed.Address))
	}
	return strings.ToLower(strings.TrimSpace(email))
}

func (h *AuthHandler) authNow() time.Time {
	if h.now != nil {
		return h.now()
	}
	return time.Now()
}

func (h *AuthHandler) magicLinkCooldown() time.Duration {
	if h.MagicLinkCooldown > 0 {
		return h.MagicLinkCooldown
	}
	return defaultMagicLinkCooldown
}

func (h *AuthHandler) magicLinkSender() func(context.Context, string) error {
	if h.createMagicLink != nil {
		return h.createMagicLink
	}
	return auth.CreateMagicLink
}

func (h *AuthHandler) reserveMagicLinkSend(email string, now time.Time) (time.Duration, bool) {
	h.magicLinkMu.Lock()
	defer h.magicLinkMu.Unlock()

	if h.magicLinkLastSent == nil {
		h.magicLinkLastSent = make(map[string]time.Time)
	}

	cooldown := h.magicLinkCooldown()
	if lastSent, ok := h.magicLinkLastSent[email]; ok {
		if nextAllowed := lastSent.Add(cooldown); now.Before(nextAllowed) {
			return nextAllowed.Sub(now), false
		}
	}

	h.magicLinkLastSent[email] = now
	return 0, true
}

func (h *AuthHandler) releaseMagicLinkReservation(email string, reservedAt time.Time) {
	h.magicLinkMu.Lock()
	defer h.magicLinkMu.Unlock()

	if h.magicLinkLastSent == nil {
		return
	}
	if current, ok := h.magicLinkLastSent[email]; ok && current.Equal(reservedAt) {
		delete(h.magicLinkLastSent, email)
	}
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
	email := normalizeAuthEmail(req.Email)
	log.Printf("[AUTH] RequestMagicLink: requesting magic link for email=%s", email)

	now := h.authNow()
	retryAfter, allowed := h.reserveMagicLinkSend(email, now)
	if !allowed {
		seconds := int(math.Ceil(retryAfter.Seconds()))
		if seconds < 1 {
			seconds = 1
		}
		w.Header().Set("Retry-After", strconv.Itoa(seconds))
		writeError(w, http.StatusTooManyRequests, "magic_link_cooldown", "Please wait before requesting another magic link")
		return
	}

	if err := h.magicLinkSender()(r.Context(), email); err != nil {
		h.releaseMagicLinkReservation(email, now)
		log.Printf("[AUTH] RequestMagicLink: CreateMagicLink failed for email=%s: %v", email, err)
		writeError(w, http.StatusInternalServerError, "magic_link_failed", "Failed to create magic link")
		return
	}

	log.Printf("[AUTH] RequestMagicLink: magic link sent successfully for email=%s", email)
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
