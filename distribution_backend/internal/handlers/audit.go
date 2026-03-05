package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"distribution_backend/internal/auth"
	"distribution_backend/internal/db"
)

type AuditHandler struct {
	store       *db.Store
	auditLogger *db.AuditLogger
}

func NewAuditHandler(store *db.Store, auditLogger *db.AuditLogger) *AuditHandler {
	return &AuditHandler{
		store:       store,
		auditLogger: auditLogger,
	}
}

func (h *AuditHandler) ListAuditEntries(w http.ResponseWriter, r *http.Request) {
	params := db.ListAuditEntriesParams{
		EntityType: r.URL.Query().Get("entityType"),
		EntityID:   r.URL.Query().Get("entityId"),
		UserID:     r.URL.Query().Get("userId"),
		Action:     r.URL.Query().Get("action"),
		Limit:      100,
		Offset:     0,
	}

	if v := r.URL.Query().Get("limit"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err == nil && parsed > 0 {
			params.Limit = parsed
		}
	}

	if v := r.URL.Query().Get("offset"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err == nil && parsed >= 0 {
			params.Offset = parsed
		}
	}

	if v := r.URL.Query().Get("from"); v != "" {
		parsed, err := time.Parse(time.RFC3339, v)
		if err == nil {
			params.From = &parsed
		}
	}

	if v := r.URL.Query().Get("to"); v != "" {
		parsed, err := time.Parse(time.RFC3339, v)
		if err == nil {
			params.To = &parsed
		}
	}

	entries, err := h.store.ListAuditEntries(r.Context(), params)
	if err != nil {
		http.Error(w, `{"error":"failed to list audit entries"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func (h *AuditHandler) GetAuditEntry(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid audit entry id"}`, http.StatusBadRequest)
		return
	}

	entry, err := h.store.GetAuditEntry(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"audit entry not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entry)
}

func (h *AuditHandler) RollbackAuditEntry(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, `{"error":"invalid audit entry id"}`, http.StatusBadRequest)
		return
	}

	userCtx, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	result, err := h.store.RollbackAuditEntry(r.Context(), id, userCtx.Username)
	if err != nil {
		if errors.Is(err, db.ErrAlreadyRolledBack) || errors.Is(err, db.ErrNotRollbackable) || errors.Is(err, db.ErrNoPreviousState) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(result)
			return
		}
		http.Error(w, `{"error":"failed to rollback audit entry"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
