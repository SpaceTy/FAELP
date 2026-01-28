package api

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"organization_backend/internal/domain"

	"github.com/go-chi/chi/v5"
)

// MaterialTypeHandler handles material type related requests
type MaterialTypeHandler struct {
	Store      StoreInterface
	UploadPath string
}

// StoreInterface defines the methods needed from Store
type StoreInterface interface {
	ListMaterialTypes(ctx context.Context) ([]domain.MaterialType, error)
	ListMaterialTypesWithAvailability(ctx context.Context) ([]domain.MaterialType, error)
	GetMaterialTypeByID(ctx context.Context, id string) (domain.MaterialType, error)
	CreateMaterialType(ctx context.Context, id, name, description, imageURL string) (domain.MaterialType, error)
	UpdateMaterialType(ctx context.Context, id, name, description string) (domain.MaterialType, error)
	UpdateMaterialTypeImage(ctx context.Context, id, imageURL string) error
	DeleteMaterialType(ctx context.Context, id string) error
}

// ListMaterialTypes returns all material types with availability counts (public)
func (h *MaterialTypeHandler) ListMaterialTypes(w http.ResponseWriter, r *http.Request) {
	materialTypes, err := h.Store.ListMaterialTypesWithAvailability(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list_failed", "Failed to fetch material types")
		return
	}
	writeJSON(w, http.StatusOK, materialTypes)
}

// GetMaterialType returns a single material type by ID (public)
func (h *MaterialTypeHandler) GetMaterialType(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	mt, err := h.Store.GetMaterialTypeByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Material type not found")
		return
	}
	writeJSON(w, http.StatusOK, mt)
}

// CreateMaterialTypeRequest represents the request body for creating a material type
type CreateMaterialTypeRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	ImageURL    string `json:"imageUrl"`
}

// CreateMaterialType creates a new material type (admin only)
func (h *MaterialTypeHandler) CreateMaterialType(w http.ResponseWriter, r *http.Request) {
	var req CreateMaterialTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	// Validate input
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Name is required")
		return
	}
	if strings.TrimSpace(req.Description) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Description is required")
		return
	}

	// Generate ID from name: lowercase, replace spaces with underscores, remove special chars
	id := generateMaterialTypeID(req.Name)

	mt, err := h.Store.CreateMaterialType(r.Context(), id, req.Name, req.Description, req.ImageURL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create_failed", "Failed to create material type")
		return
	}

	writeJSON(w, http.StatusCreated, mt)
}

// UpdateMaterialTypeRequest represents the request body for updating a material type
type UpdateMaterialTypeRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// UpdateMaterialType updates an existing material type (admin only)
func (h *MaterialTypeHandler) UpdateMaterialType(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req UpdateMaterialTypeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	// Validate input
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Name is required")
		return
	}
	if strings.TrimSpace(req.Description) == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Description is required")
		return
	}

	mt, err := h.Store.UpdateMaterialType(r.Context(), id, req.Name, req.Description)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update_failed", "Failed to update material type")
		return
	}

	writeJSON(w, http.StatusOK, mt)
}

// DeleteMaterialType deletes a material type (admin only)
func (h *MaterialTypeHandler) DeleteMaterialType(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.Store.DeleteMaterialType(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "delete_failed", "Failed to delete material type")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// generateMaterialTypeID creates a URL-friendly ID from a name
func generateMaterialTypeID(name string) string {
	// Convert to lowercase
	id := strings.ToLower(name)
	// Replace spaces with underscores
	id = strings.ReplaceAll(id, " ", "_")
	// Remove special characters, keep only alphanumeric and underscores
	re := regexp.MustCompile(`[^a-z0-9_]`)
	id = re.ReplaceAllString(id, "")
	// Remove consecutive underscores
	re = regexp.MustCompile(`_+`)
	id = re.ReplaceAllString(id, "_")
	// Trim underscores from start and end
	id = strings.Trim(id, "_")
	return id
}
