package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"organization_backend/internal/domain"

	"github.com/go-chi/chi/v5"
)

// DistributionCenterHandler handles distribution center related requests
type DistributionCenterHandler struct {
	Store StoreInterface
}

// DistCenterStoreInterface defines the methods needed from Store for distribution centers
type DistCenterStoreInterface interface {
	ListDistributionCenters(ctx context.Context) ([]domain.DistributionCenter, error)
	GetDistributionCenterByID(ctx context.Context, id string) (domain.DistributionCenter, error)
	GetDistributionCenterBySocketPath(ctx context.Context, socketPath string) (domain.DistributionCenter, error)
	CreateDistributionCenter(ctx context.Context, input domain.CreateDistributionCenterInput) (domain.DistributionCenter, error)
	CreateDistributionCenterWithSocket(ctx context.Context, name, address, socketPath string) (domain.DistributionCenter, error)
	UpdateDistributionCenter(ctx context.Context, id string, input domain.UpdateDistributionCenterInput) (domain.DistributionCenter, error)
	DeleteDistributionCenter(ctx context.Context, id string) error
}

// ListDistributionCenters returns all distribution centers
func (h *DistributionCenterHandler) ListDistributionCenters(w http.ResponseWriter, r *http.Request) {
	centers, err := h.Store.ListDistributionCenters(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list_failed", "Failed to fetch distribution centers")
		return
	}
	writeJSON(w, http.StatusOK, centers)
}

// GetDistributionCenter returns a single distribution center by ID
func (h *DistributionCenterHandler) GetDistributionCenter(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	center, err := h.Store.GetDistributionCenterByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Distribution center not found")
		return
	}
	writeJSON(w, http.StatusOK, center)
}

// CreateDistributionCenterRequest represents the request body for creating a distribution center
type CreateDistributionCenterRequest struct {
	Name    string `json:"name"`
	Address string `json:"address"`
}

// CreateDistributionCenter creates a new distribution center
func (h *DistributionCenterHandler) CreateDistributionCenter(w http.ResponseWriter, r *http.Request) {
	var req CreateDistributionCenterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	// Validate input
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Name is required")
		return
	}
	if strings.TrimSpace(req.Address) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Address is required")
		return
	}

	input := domain.CreateDistributionCenterInput{
		Name:    strings.TrimSpace(req.Name),
		Address: strings.TrimSpace(req.Address),
	}

	center, err := h.Store.CreateDistributionCenter(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create_failed", "Failed to create distribution center")
		return
	}

	writeJSON(w, http.StatusCreated, center)
}

// UpdateDistributionCenterRequest represents the request body for updating a distribution center
type UpdateDistributionCenterRequest struct {
	Name    string `json:"name"`
	Address string `json:"address"`
}

// UpdateDistributionCenter updates an existing distribution center
func (h *DistributionCenterHandler) UpdateDistributionCenter(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req UpdateDistributionCenterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	// Validate input
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Name is required")
		return
	}
	if strings.TrimSpace(req.Address) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Address is required")
		return
	}

	input := domain.UpdateDistributionCenterInput{
		Name:    strings.TrimSpace(req.Name),
		Address: strings.TrimSpace(req.Address),
	}

	center, err := h.Store.UpdateDistributionCenter(r.Context(), id, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update_failed", "Failed to update distribution center")
		return
	}

	writeJSON(w, http.StatusOK, center)
}

// DeleteDistributionCenter deletes a distribution center
func (h *DistributionCenterHandler) DeleteDistributionCenter(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.Store.DeleteDistributionCenter(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "delete_failed", "Failed to delete distribution center")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// RegisterDistBackendRequest represents the request for auto-registering a co-located backend
type RegisterDistBackendRequest struct {
	Name       string `json:"name"`
	Address    string `json:"address"`
	SocketPath string `json:"socketPath"`
}

// RegisterDistBackend auto-registers a co-located distribution backend via Unix socket
func (h *DistributionCenterHandler) RegisterDistBackend(w http.ResponseWriter, r *http.Request) {
	var req RegisterDistBackendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	// Validate input
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Name is required")
		return
	}
	if strings.TrimSpace(req.Address) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Address is required")
		return
	}
	if strings.TrimSpace(req.SocketPath) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Socket path is required")
		return
	}

	// Check if already registered with this socket path
	existing, err := h.Store.GetDistributionCenterBySocketPath(r.Context(), req.SocketPath)
	if err == nil {
		// Already registered, return existing
		writeJSON(w, http.StatusOK, existing)
		return
	}

	// Create new distribution center with socket path
	center, err := h.Store.CreateDistributionCenterWithSocket(
		r.Context(),
		strings.TrimSpace(req.Name),
		strings.TrimSpace(req.Address),
		strings.TrimSpace(req.SocketPath),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create_failed", "Failed to register distribution center")
		return
	}

	writeJSON(w, http.StatusCreated, center)
}
