package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"distribution_backend/internal/client"
	"distribution_backend/internal/db"
	"distribution_backend/internal/domain"
)

// InventoryHandler handles inventory endpoints.
type InventoryHandler struct {
	store    *db.Store
	orgClient *client.OrgClient
}

// NewInventoryHandler creates a new inventory handler.
func NewInventoryHandler(store *db.Store, orgClient *client.OrgClient) *InventoryHandler {
	return &InventoryHandler{store: store, orgClient: orgClient}
}

// GetMaterialTypes returns all material types from the organization backend.
func (h *InventoryHandler) GetMaterialTypes(w http.ResponseWriter, r *http.Request) {
	if h.orgClient == nil {
		http.Error(w, `{"error":"organization backend client not configured"}`, http.StatusServiceUnavailable)
		return
	}

	materialTypes, err := h.orgClient.GetMaterialTypes(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch material types from organization backend"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(materialTypes)
}

type assignRequestBody struct {
	RequestID string `json:"requestId"`
}

// CreateMaterialInstance creates a new inventory item.
func (h *InventoryHandler) CreateMaterialInstance(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateMaterialInstanceInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.TypeID == "" || req.Location == "" {
		http.Error(w, `{"error":"typeId and location are required"}`, http.StatusBadRequest)
		return
	}

	instance, err := h.store.CreateMaterialInstance(r.Context(), req)
	if err != nil {
		http.Error(w, `{"error":"failed to create material instance"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(instance)
}

// GetMaterialInstance returns one inventory item by ID.
func (h *InventoryHandler) GetMaterialInstance(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"instance id required"}`, http.StatusBadRequest)
		return
	}

	instance, err := h.store.GetMaterialInstanceByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, `{"error":"material instance not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to fetch material instance"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(instance)
}

// ListMaterialInstances lists inventory items with optional filters.
func (h *InventoryHandler) ListMaterialInstances(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if v := r.URL.Query().Get("limit"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil {
			http.Error(w, `{"error":"limit must be a valid integer"}`, http.StatusBadRequest)
			return
		}
		limit = parsed
	}

	offset := 0
	if v := r.URL.Query().Get("offset"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil {
			http.Error(w, `{"error":"offset must be a valid integer"}`, http.StatusBadRequest)
			return
		}
		offset = parsed
	}

	params := db.ListMaterialInstancesParams{
		TypeID:   r.URL.Query().Get("typeId"),
		Status:   r.URL.Query().Get("status"),
		Location: r.URL.Query().Get("location"),
		Limit:    limit,
		Offset:   offset,
	}

	if params.Status != "" && !isValidMaterialStatus(params.Status) {
		http.Error(w, `{"error":"invalid status"}`, http.StatusBadRequest)
		return
	}

	instances, err := h.store.ListMaterialInstances(r.Context(), params)
	if err != nil {
		http.Error(w, `{"error":"failed to list material instances"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(instances)
}

// UpdateMaterialInstance updates status/location for an inventory item.
func (h *InventoryHandler) UpdateMaterialInstance(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"instance id required"}`, http.StatusBadRequest)
		return
	}

	var req domain.UpdateMaterialInstanceInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Status == "" || req.Location == "" {
		http.Error(w, `{"error":"status and location are required"}`, http.StatusBadRequest)
		return
	}
	if !isValidMaterialStatus(req.Status) {
		http.Error(w, `{"error":"invalid status"}`, http.StatusBadRequest)
		return
	}

	instance, err := h.store.UpdateMaterialInstance(r.Context(), id, req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, `{"error":"material instance not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to update material instance"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(instance)
}

// DeleteMaterialInstance deletes an inventory item by ID.
func (h *InventoryHandler) DeleteMaterialInstance(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"instance id required"}`, http.StatusBadRequest)
		return
	}

	_, err := h.store.GetMaterialInstanceByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, `{"error":"material instance not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to fetch material instance"}`, http.StatusInternalServerError)
		return
	}

	if err := h.store.DeleteMaterialInstance(r.Context(), id); err != nil {
		http.Error(w, `{"error":"failed to delete material instance"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "material instance deleted"})
}

// AssignToRequest marks an available inventory item as rented for a request.
func (h *InventoryHandler) AssignToRequest(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"instance id required"}`, http.StatusBadRequest)
		return
	}

	var req assignRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if req.RequestID == "" {
		http.Error(w, `{"error":"requestId is required"}`, http.StatusBadRequest)
		return
	}

	instance, err := h.store.AssignToRequest(r.Context(), id, req.RequestID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, `{"error":"material instance not found or not available"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"failed to assign material instance"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(instance)
}

// ReleaseFromRequest marks a rented inventory item as returned.
func (h *InventoryHandler) ReleaseFromRequest(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"instance id required"}`, http.StatusBadRequest)
		return
	}

	instance, err := h.store.ReleaseFromRequest(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, `{"error":"material instance not found or not rented"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"failed to release material instance"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(instance)
}

// CountByTypeAndStatus returns inventory summary grouped by type and status.
func (h *InventoryHandler) CountByTypeAndStatus(w http.ResponseWriter, r *http.Request) {
	summary, err := h.store.CountByTypeAndStatus(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch inventory summary"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(summary)
}

// GetAvailableByType returns available instances for a given type.
func (h *InventoryHandler) GetAvailableByType(w http.ResponseWriter, r *http.Request) {
	typeID := r.URL.Query().Get("typeId")
	if typeID == "" {
		http.Error(w, `{"error":"typeId is required"}`, http.StatusBadRequest)
		return
	}

	limit := 100
	if v := r.URL.Query().Get("limit"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil {
			http.Error(w, `{"error":"limit must be a valid integer"}`, http.StatusBadRequest)
			return
		}
		limit = parsed
	}

	instances, err := h.store.GetAvailableByType(r.Context(), typeID, limit)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch available material instances"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(instances)
}

func isValidMaterialStatus(status string) bool {
	switch status {
	case domain.StatusAvailable, domain.StatusRented, domain.StatusReturned:
		return true
	default:
		return false
	}
}
