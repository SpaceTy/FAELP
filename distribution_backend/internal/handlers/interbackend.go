package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"distribution_backend/internal/auth"
	"distribution_backend/internal/db"
	"distribution_backend/internal/interbackend"
)

type InterbackendHandler struct {
	store        *db.Store
	manager      *interbackend.Manager
	orgJWTSecret string
}

func NewInterbackendHandler(store *db.Store, manager *interbackend.Manager, orgJWTSecret string) *InterbackendHandler {
	return &InterbackendHandler{store: store, manager: manager, orgJWTSecret: orgJWTSecret}
}

func (h *InterbackendHandler) ExportInventory(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
		return
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		http.Error(w, `{"error":"invalid authorization header"}`, http.StatusUnauthorized)
		return
	}
	if _, err := auth.ParseInterbackendToken(parts[1], h.orgJWTSecret); err != nil {
		http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
		return
	}

	summary, err := h.store.CountByTypeAndStatus(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to build inventory"}`, http.StatusInternalServerError)
		return
	}

	available := map[string]int{}
	for _, item := range summary {
		if item.Status == "available" {
			available[item.TypeID] += item.Count
		}
	}

	type row struct {
		MaterialTypeID  string `json:"materialTypeId"`
		AvailableAmount int    `json:"availableAmount"`
	}
	items := make([]row, 0, len(available))
	for id, amount := range available {
		items = append(items, row{MaterialTypeID: id, AvailableAmount: amount})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"snapshotId": "export-" + time.Now().UTC().Format("20060102150405"),
		"snapshotAt": time.Now().UTC(),
		"items":      items,
	})
}

func (h *InterbackendHandler) LinkStatus(w http.ResponseWriter, r *http.Request) {
	status := h.manager.Status()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}
