package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"organization_backend/internal/domain"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
)

const (
	defaultMaterialTypeCacheTTL   = 30 * time.Second
	materialTypeCacheRetryBackoff = 5 * time.Second
	materialTypeCacheRefreshLimit = 10 * time.Second
)

// MaterialTypeHandler handles material type related requests
type MaterialTypeHandler struct {
	Store      StoreInterface
	UploadPath string
	DistClient DistClientInterface
	SocketPath string
	CacheTTL   time.Duration

	cacheMu           sync.Mutex
	cacheCond         *sync.Cond
	cachedMaterials   []domain.MaterialType
	cacheRefreshAfter time.Time
	cacheRefreshing   bool
	now               func() time.Time
}

// StoreInterface defines the methods needed from Store
type StoreInterface interface {
	ListMaterialTypes(ctx context.Context) ([]domain.MaterialType, error)
	ListMaterialTypesWithAvailability(ctx context.Context) ([]domain.MaterialType, error)
	GetMaterialTypeByID(ctx context.Context, id string) (domain.MaterialType, error)
	CreateMaterialType(ctx context.Context, id, name, description, imageURL string, category domain.MaterialCategory) (domain.MaterialType, error)
	UpdateMaterialType(ctx context.Context, id, name, description string, category domain.MaterialCategory) (domain.MaterialType, error)
	UpdateMaterialTypeImage(ctx context.Context, id, imageURL string) error
	DeleteMaterialType(ctx context.Context, id string) error
	UpdateMaterialAvailability(ctx context.Context, distributionCenterID string, availability map[string]int) error
	ListDistributionCenters(ctx context.Context) ([]domain.DistributionCenter, error)
	GetDistributionCenterByID(ctx context.Context, id string) (domain.DistributionCenter, error)
	GetDistributionCenterBySocketPath(ctx context.Context, socketPath string) (domain.DistributionCenter, error)
	CreateDistributionCenter(ctx context.Context, input domain.CreateDistributionCenterInput) (domain.DistributionCenter, error)
	CreateDistributionCenterWithSocket(ctx context.Context, name, address, socketPath string) (domain.DistributionCenter, error)
	UpdateDistributionCenter(ctx context.Context, id string, input domain.UpdateDistributionCenterInput) (domain.DistributionCenter, error)
	DeleteDistributionCenter(ctx context.Context, id string) error
}

// DistClientInterface defines the methods needed from the distribution backend client
type DistClientInterface interface {
	GetAvailableMaterials(ctx context.Context) (map[string]int, error)
}

func (h *MaterialTypeHandler) cacheNow() time.Time {
	if h.now != nil {
		return h.now()
	}
	return time.Now()
}

func (h *MaterialTypeHandler) materialTypeCacheTTL() time.Duration {
	if h.CacheTTL > 0 {
		return h.CacheTTL
	}
	return defaultMaterialTypeCacheTTL
}

func (h *MaterialTypeHandler) materialTypeCacheCond() *sync.Cond {
	if h.cacheCond == nil {
		h.cacheCond = sync.NewCond(&h.cacheMu)
	}
	return h.cacheCond
}

func cloneMaterialTypes(materials []domain.MaterialType) []domain.MaterialType {
	if materials == nil {
		return nil
	}
	cloned := make([]domain.MaterialType, len(materials))
	copy(cloned, materials)
	return cloned
}

func (h *MaterialTypeHandler) finishMaterialTypeRefresh(materialTypes []domain.MaterialType, err error) {
	h.cacheMu.Lock()
	defer h.cacheMu.Unlock()

	if err == nil {
		h.cachedMaterials = cloneMaterialTypes(materialTypes)
		h.cacheRefreshAfter = h.cacheNow().Add(h.materialTypeCacheTTL())
	} else if len(h.cachedMaterials) > 0 {
		h.cacheRefreshAfter = h.cacheNow().Add(materialTypeCacheRetryBackoff)
	}

	h.cacheRefreshing = false
	h.materialTypeCacheCond().Broadcast()
}

func (h *MaterialTypeHandler) refreshMaterialTypes(ctx context.Context) ([]domain.MaterialType, error) {
	// Fetch availability from distribution backend if configured.
	if h.DistClient != nil && h.SocketPath != "" {
		availabilityMap, err := h.DistClient.GetAvailableMaterials(ctx)
		if err != nil {
			// Log error but don't fail; we'll return the last known DB-backed availability below.
			log.Printf("Warning: failed to fetch availability from dist backend: %v", err)
		} else {
			// Look up distribution center ID from database based on socket path.
			dc, err := h.Store.GetDistributionCenterBySocketPath(ctx, h.SocketPath)
			if err != nil {
				log.Printf("Warning: failed to find distribution center for socket %s: %v", h.SocketPath, err)
			} else {
				if err := h.Store.UpdateMaterialAvailability(ctx, dc.ID, availabilityMap); err != nil {
					log.Printf("Warning: failed to store availability in database: %v", err)
				}
			}
		}
	}

	// Always return DB-computed availability so reserved quantities are subtracted.
	return h.Store.ListMaterialTypesWithAvailability(ctx)
}

func (h *MaterialTypeHandler) refreshMaterialTypesAsync() {
	ctx, cancel := context.WithTimeout(context.Background(), materialTypeCacheRefreshLimit)
	defer cancel()

	materialTypes, err := h.refreshMaterialTypes(ctx)
	if err != nil {
		log.Printf("Warning: failed to refresh material type cache: %v", err)
	}
	h.finishMaterialTypeRefresh(materialTypes, err)
}

func (h *MaterialTypeHandler) invalidateMaterialTypesCache() {
	h.cacheMu.Lock()
	defer h.cacheMu.Unlock()

	h.cachedMaterials = nil
	h.cacheRefreshAfter = time.Time{}
}

// ListMaterialTypes returns all material types with availability counts from dist backend (public)
func (h *MaterialTypeHandler) ListMaterialTypes(w http.ResponseWriter, r *http.Request) {
	now := h.cacheNow()

	h.cacheMu.Lock()
	cacheCond := h.materialTypeCacheCond()
	for len(h.cachedMaterials) == 0 && h.cacheRefreshing {
		cacheCond.Wait()
	}

	if len(h.cachedMaterials) > 0 {
		materialTypes := cloneMaterialTypes(h.cachedMaterials)
		shouldRefresh := !h.cacheRefreshing && !now.Before(h.cacheRefreshAfter)
		if shouldRefresh {
			h.cacheRefreshing = true
		}
		h.cacheMu.Unlock()

		if shouldRefresh {
			go h.refreshMaterialTypesAsync()
		}

		writeJSON(w, http.StatusOK, materialTypes)
		return
	}

	h.cacheRefreshing = true
	h.cacheMu.Unlock()

	materialTypes, err := h.refreshMaterialTypes(r.Context())
	if err != nil {
		h.finishMaterialTypeRefresh(nil, err)
		writeError(w, http.StatusInternalServerError, "list_failed", "Failed to fetch material types")
		return
	}

	h.finishMaterialTypeRefresh(materialTypes, nil)
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
	Name        string                  `json:"name"`
	Description string                  `json:"description"`
	ImageURL    string                  `json:"imageUrl"`
	Category    domain.MaterialCategory `json:"category"`
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
	if req.Category == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Category is required")
		return
	}
	if !req.Category.IsValid() {
		writeError(w, http.StatusBadRequest, "validation_error", "Category is invalid")
		return
	}

	// Generate ID from name: lowercase, replace spaces with underscores, remove special chars
	id := generateMaterialTypeID(req.Name)

	// Validate that the generated ID is not empty
	if id == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Name must contain at least one letter or number")
		return
	}

	mt, err := h.Store.CreateMaterialType(r.Context(), id, req.Name, req.Description, req.ImageURL, req.Category)
	if err != nil {
		log.Printf("ERROR CreateMaterialType id=%q name=%q: %v", id, req.Name, err)
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			writeError(w, http.StatusConflict, "duplicate_id", "A material type with this name (or a similar one) already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "create_failed", "Failed to create material type")
		return
	}

	h.invalidateMaterialTypesCache()
	writeJSON(w, http.StatusCreated, mt)
}

// UpdateMaterialTypeRequest represents the request body for updating a material type
type UpdateMaterialTypeRequest struct {
	Name        string                  `json:"name"`
	Description string                  `json:"description"`
	Category    domain.MaterialCategory `json:"category"`
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
	if req.Category == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Category is required")
		return
	}
	if !req.Category.IsValid() {
		writeError(w, http.StatusBadRequest, "validation_error", "Category is invalid")
		return
	}

	mt, err := h.Store.UpdateMaterialType(r.Context(), id, req.Name, req.Description, req.Category)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update_failed", "Failed to update material type")
		return
	}

	h.invalidateMaterialTypesCache()
	writeJSON(w, http.StatusOK, mt)
}

// DeleteMaterialType deletes a material type (admin only)
func (h *MaterialTypeHandler) DeleteMaterialType(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.Store.DeleteMaterialType(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "delete_failed", "Failed to delete material type")
		return
	}

	h.invalidateMaterialTypesCache()
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
