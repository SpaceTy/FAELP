package api

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"organization_backend/internal/auth"
	"organization_backend/internal/db"

	"github.com/go-chi/chi/v5"
)

type NonceStore struct {
	mu     sync.Mutex
	values map[string]time.Time
}

func NewNonceStore() *NonceStore {
	return &NonceStore{values: make(map[string]time.Time)}
}

func (n *NonceStore) Use(nonce string, ttl time.Duration) bool {
	n.mu.Lock()
	defer n.mu.Unlock()
	now := time.Now().UTC()
	for k, exp := range n.values {
		if exp.Before(now) {
			delete(n.values, k)
		}
	}
	if _, exists := n.values[nonce]; exists {
		return false
	}
	n.values[nonce] = now.Add(ttl)
	return true
}

type InterbackendHandler struct {
	Store     *db.Store
	JWTSecret string
	Nonces    *NonceStore
}

type createLinkRequest struct {
	CenterCode     string `json:"centerCode"`
	CenterName     string `json:"centerName"`
	CenterAddress  string `json:"centerAddress"`
	CallbackURL    string `json:"callbackUrl"`
	ChallengeToken string `json:"challengeToken"`
	DistPublicKey  string `json:"distPublicKey"`
}

func (h *InterbackendHandler) CreateLinkRequest(w http.ResponseWriter, r *http.Request) {
	var req createLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	req.CenterCode = strings.TrimSpace(req.CenterCode)
	req.CenterName = strings.TrimSpace(req.CenterName)
	req.CenterAddress = strings.TrimSpace(req.CenterAddress)
	req.CallbackURL = strings.TrimSpace(req.CallbackURL)
	req.ChallengeToken = strings.TrimSpace(req.ChallengeToken)
	req.DistPublicKey = strings.TrimSpace(req.DistPublicKey)

	if req.CenterCode == "" || req.CenterName == "" || req.CenterAddress == "" || req.CallbackURL == "" || req.ChallengeToken == "" || req.DistPublicKey == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "centerCode, centerName, centerAddress, callbackUrl, challengeToken and distPublicKey are required")
		return
	}
	if _, err := base64.StdEncoding.DecodeString(req.DistPublicKey); err != nil {
		if _, err2 := base64.RawStdEncoding.DecodeString(req.DistPublicKey); err2 != nil {
			writeError(w, http.StatusBadRequest, "validation_error", "distPublicKey must be valid base64")
			return
		}
	}

	out, err := h.Store.UpsertDistributionLinkRequest(r.Context(), db.UpsertLinkRequestInput{
		CenterCode:     req.CenterCode,
		CenterName:     req.CenterName,
		CenterAddress:  req.CenterAddress,
		CallbackURL:    req.CallbackURL,
		ChallengeToken: req.ChallengeToken,
		DistPublicKey:  req.DistPublicKey,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create_failed", "Failed to create link request")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"requestId":            out.ID,
		"distributionCenterId": out.DistributionCenterID,
		"centerCode":           out.CenterCode,
		"state":                out.State,
		"challengeExpiresAt":   out.ChallengeExpiresAt,
	})
}

type bootstrapRequest struct {
	CenterCode string `json:"centerCode"`
	Nonce      string `json:"nonce"`
	Timestamp  string `json:"timestamp"`
	Signature  string `json:"signature"`
}

func (h *InterbackendHandler) BootstrapAuth(w http.ResponseWriter, r *http.Request) {
	var req bootstrapRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	req.CenterCode = strings.TrimSpace(req.CenterCode)
	req.Nonce = strings.TrimSpace(req.Nonce)
	req.Timestamp = strings.TrimSpace(req.Timestamp)
	req.Signature = strings.TrimSpace(req.Signature)

	if req.CenterCode == "" || req.Nonce == "" || req.Timestamp == "" || req.Signature == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "centerCode, nonce, timestamp and signature are required")
		return
	}
	if !h.Nonces.Use(req.Nonce, 5*time.Minute) {
		writeError(w, http.StatusUnauthorized, "replay_detected", "nonce already used")
		return
	}

	ts, err := time.Parse(time.RFC3339, req.Timestamp)
	if err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", "timestamp must be RFC3339")
		return
	}
	if delta := time.Since(ts); delta > 5*time.Minute || delta < -5*time.Minute {
		writeError(w, http.StatusUnauthorized, "stale_timestamp", "timestamp outside allowed clock skew")
		return
	}

	center, err := h.Store.GetCenterBootstrapDataByCode(r.Context(), req.CenterCode)
	if err != nil {
		writeError(w, http.StatusNotFound, "center_not_found", "Distribution center not found")
		return
	}
	if center.CenterState == db.LinkStateAdminLocked || center.CenterState == db.LinkStateRejected || center.CenterState == db.LinkStateRevoked || center.CenterState == db.LinkStatePending {
		writeError(w, http.StatusForbidden, "center_not_eligible", "Distribution center is not eligible for bootstrap")
		return
	}

	if err := verifyBootstrapSignature(center.PublicKey, req.CenterCode, req.Nonce, req.Timestamp, req.Signature); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_signature", "Signature verification failed")
		return
	}

	token, exp, err := auth.GenerateInterbackendToken(center.CenterID, center.CenterCode, h.JWTSecret, 15*time.Minute)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token_issue_failed", "Failed to issue token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"accessToken": token,
		"tokenType":   "Bearer",
		"expiresAt":   exp,
	})
}

type heartbeatRequest struct {
	DistVersion string `json:"distVersion"`
	DistTime    string `json:"distTime"`
	Health      string `json:"health"`
}

func (h *InterbackendHandler) Heartbeat(w http.ResponseWriter, r *http.Request) {
	centerID, _, err := h.requireMachineAuth(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_token", err.Error())
		return
	}

	center, err := h.Store.GetDistributionCenterByID(r.Context(), centerID)
	if err != nil {
		writeError(w, http.StatusNotFound, "center_not_found", "Distribution center not found")
		return
	}
	if center.LinkState == db.LinkStateAdminLocked {
		writeError(w, http.StatusForbidden, "admin_locked", "Distribution center requires admin reactivation")
		return
	}
	if center.LinkState == db.LinkStateRejected || center.LinkState == db.LinkStateRevoked {
		writeError(w, http.StatusForbidden, "forbidden", "Distribution center is not allowed")
		return
	}

	updated, err := h.Store.MarkHeartbeat(r.Context(), centerID, r.RemoteAddr, r.UserAgent())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "heartbeat_failed", "Failed to record heartbeat")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":     "ok",
		"centerId":   centerID,
		"linkState":  updated.LinkState,
		"lastSeenAt": updated.LastSeenAt,
	})
}

type inventoryPushRequest struct {
	SnapshotID string               `json:"snapshotId"`
	SnapshotAt string               `json:"snapshotAt"`
	Items      []db.InventoryAmount `json:"items"`
}

func (h *InterbackendHandler) PushInventory(w http.ResponseWriter, r *http.Request) {
	centerID, _, err := h.requireMachineAuth(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_token", err.Error())
		return
	}

	center, err := h.Store.GetDistributionCenterByID(r.Context(), centerID)
	if err != nil {
		writeError(w, http.StatusNotFound, "center_not_found", "Distribution center not found")
		return
	}
	if center.LinkState == db.LinkStateAdminLocked {
		writeError(w, http.StatusForbidden, "admin_locked", "Distribution center requires admin reactivation")
		return
	}
	if center.LinkState == db.LinkStateRejected || center.LinkState == db.LinkStateRevoked {
		writeError(w, http.StatusForbidden, "forbidden", "Distribution center is not allowed")
		return
	}

	var req inventoryPushRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	updated, err := h.Store.RecordInventorySync(r.Context(), centerID, req.Items)
	if err != nil {
		_ = h.Store.MarkInventorySyncFailure(r.Context(), centerID, err.Error())
		writeError(w, http.StatusInternalServerError, "sync_failed", "Failed to sync inventory")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":       "ok",
		"centerId":     centerID,
		"updatedItems": updated,
	})
}

func (h *InterbackendHandler) ListLinkRequests(w http.ResponseWriter, r *http.Request) {
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	items, err := h.Store.ListDistributionLinkRequests(r.Context(), state, 100)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list_failed", "Failed to list link requests")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *InterbackendHandler) GetLinkRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.Store.GetDistributionLinkRequestByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Link request not found")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (h *InterbackendHandler) FindLinkRequestByToken(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChallengeToken string `json:"challengeToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}
	req.ChallengeToken = strings.TrimSpace(req.ChallengeToken)
	if req.ChallengeToken == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "challengeToken is required")
		return
	}

	item, err := h.Store.FindPendingLinkRequestByToken(r.Context(), req.ChallengeToken)
	if err != nil {
		if errors.Is(err, db.ErrCenterNotFound) {
			writeJSON(w, http.StatusOK, map[string]any{"match": nil})
			return
		}
		writeError(w, http.StatusInternalServerError, "lookup_failed", "Failed to lookup link request")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"match": item})
}

func (h *InterbackendHandler) ApproveLinkRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	claims := GetClaimsFromContext(r.Context())
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	var req struct {
		AdminNote string `json:"adminNote"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	out, err := h.Store.ApproveDistributionLinkRequest(r.Context(), id, claims.CustomerID, strings.TrimSpace(req.AdminNote))
	if err != nil {
		writeError(w, http.StatusBadRequest, "approve_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *InterbackendHandler) RejectLinkRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	claims := GetClaimsFromContext(r.Context())
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Reason) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "reason is required")
		return
	}

	out, err := h.Store.RejectDistributionLinkRequest(r.Context(), id, claims.CustomerID, strings.TrimSpace(req.Reason))
	if err != nil {
		writeError(w, http.StatusBadRequest, "reject_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *InterbackendHandler) ReactivateCenter(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Note string `json:"note"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	out, err := h.Store.ReactivateDistributionCenter(r.Context(), id, strings.TrimSpace(req.Note))
	if err != nil {
		writeError(w, http.StatusBadRequest, "reactivate_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *InterbackendHandler) GetCenterStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	out, err := h.Store.GetDistributionCenterByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Distribution center not found")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *InterbackendHandler) ListCenters(w http.ResponseWriter, r *http.Request) {
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	out, err := h.Store.ListDistributionCenters(r.Context(), state, 200)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list_failed", "Failed to list distribution centers")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *InterbackendHandler) RunLifecycleTicker(ctx context.Context, hibernateAfter, lockAfter time.Duration) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_ = h.Store.ApplyLinkLifecycleTransitions(ctx, hibernateAfter, lockAfter)
		}
	}
}

func verifyBootstrapSignature(pubKeyB64, centerCode, nonce, ts, signatureB64 string) error {
	pubKeyBytes, err := decodeMaybeRawB64(pubKeyB64)
	if err != nil {
		return err
	}
	if len(pubKeyBytes) != ed25519.PublicKeySize {
		return fmt.Errorf("invalid public key size")
	}

	sigBytes, err := decodeMaybeRawB64(signatureB64)
	if err != nil {
		return err
	}
	if len(sigBytes) != ed25519.SignatureSize {
		return fmt.Errorf("invalid signature size")
	}

	message := []byte(centerCode + "|" + nonce + "|" + ts)
	if !ed25519.Verify(ed25519.PublicKey(pubKeyBytes), message, sigBytes) {
		return fmt.Errorf("invalid signature")
	}
	return nil
}

func decodeMaybeRawB64(input string) ([]byte, error) {
	if b, err := base64.StdEncoding.DecodeString(input); err == nil {
		return b, nil
	}
	return base64.RawStdEncoding.DecodeString(input)
}

func (h *InterbackendHandler) requireMachineAuth(ctx context.Context, r *http.Request) (string, string, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", "", errors.New("missing authorization header")
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return "", "", errors.New("invalid authorization header")
	}
	claims, err := auth.ParseInterbackendToken(parts[1], h.JWTSecret)
	if err != nil {
		return "", "", err
	}
	if claims.Scope != "interbackend" {
		return "", "", errors.New("invalid token scope")
	}
	return claims.CenterID, claims.CenterCode, nil
}

func sha256Hex(input []byte) string {
	h := sha256.Sum256(input)
	return hex.EncodeToString(h[:])
}
