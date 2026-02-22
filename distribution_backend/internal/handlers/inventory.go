package handlers

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"distribution_backend/internal/client"
	"distribution_backend/internal/db"
	"distribution_backend/internal/domain"
	"github.com/lib/pq"
)

// InventoryHandler handles inventory endpoints.
type InventoryHandler struct {
	store     *db.Store
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

type generatedCodeResponse struct {
	HumanCode string `json:"humanCode"`
}

type importInventoryResponse struct {
	ImportedCount int `json:"importedCount"`
	CreatedCount  int `json:"createdCount"`
	UpdatedCount  int `json:"updatedCount"`
}

var humanCodePattern = regexp.MustCompile(`^[A-Z]{5}$`)

// GenerateMaterialCode returns a unique human-readable inventory code.
func (h *InventoryHandler) GenerateMaterialCode(w http.ResponseWriter, r *http.Request) {
	code, err := h.store.GenerateMaterialHumanCode(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to generate material code"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(generatedCodeResponse{HumanCode: code})
}

// CreateMaterialInstance creates a new inventory item.
func (h *InventoryHandler) CreateMaterialInstance(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateMaterialInstanceInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.HumanCode = strings.ToUpper(strings.TrimSpace(req.HumanCode))
	if req.HumanCode == "" || req.TypeID == "" || req.Location == "" {
		http.Error(w, `{"error":"humanCode, typeId and location are required"}`, http.StatusBadRequest)
		return
	}
	if !humanCodePattern.MatchString(req.HumanCode) {
		http.Error(w, `{"error":"humanCode must be exactly 5 uppercase letters"}`, http.StatusBadRequest)
		return
	}

	instance, err := h.store.CreateMaterialInstance(r.Context(), req)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" && pqErr.Constraint == "material_instances_human_code_key" {
			http.Error(w, `{"error":"humanCode already exists"}`, http.StatusConflict)
			return
		}
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
		TypeID:    r.URL.Query().Get("typeId"),
		Status:    r.URL.Query().Get("status"),
		Location:  r.URL.Query().Get("location"),
		HumanCode: strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("humanCode"))),
		Limit:     limit,
		Offset:    offset,
	}

	if params.Status != "" && !isValidMaterialStatus(params.Status) {
		http.Error(w, `{"error":"invalid status"}`, http.StatusBadRequest)
		return
	}
	if params.HumanCode != "" && !humanCodePattern.MatchString(params.HumanCode) {
		http.Error(w, `{"error":"humanCode must be exactly 5 uppercase letters"}`, http.StatusBadRequest)
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

// ExportInventoryCSV exports inventory as CSV with optional filters.
func (h *InventoryHandler) ExportInventoryCSV(w http.ResponseWriter, r *http.Request) {
	params := db.ListMaterialInstancesParams{
		TypeID:    r.URL.Query().Get("typeId"),
		Status:    r.URL.Query().Get("status"),
		Location:  r.URL.Query().Get("location"),
		HumanCode: strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("humanCode"))),
	}

	if params.Status != "" && !isValidMaterialStatus(params.Status) {
		http.Error(w, `{"error":"invalid status"}`, http.StatusBadRequest)
		return
	}
	if params.HumanCode != "" && !humanCodePattern.MatchString(params.HumanCode) {
		http.Error(w, `{"error":"humanCode must be exactly 5 uppercase letters"}`, http.StatusBadRequest)
		return
	}

	instances, err := h.store.ListMaterialInstancesForExport(r.Context(), params)
	if err != nil {
		http.Error(w, `{"error":"failed to export inventory"}`, http.StatusInternalServerError)
		return
	}

	filename := fmt.Sprintf("inventory_%s.csv", time.Now().Format("20060102_150405"))
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	csvWriter := csv.NewWriter(w)
	if err := csvWriter.Write([]string{
		"humanCode",
		"typeId",
		"description",
		"status",
		"useCount",
		"location",
		"currentRequestId",
		"createdAt",
		"updatedAt",
	}); err != nil {
		http.Error(w, `{"error":"failed to write csv header"}`, http.StatusInternalServerError)
		return
	}

	for _, instance := range instances {
		currentRequestID := ""
		if instance.CurrentRequestID != nil {
			currentRequestID = *instance.CurrentRequestID
		}
		if err := csvWriter.Write([]string{
			instance.HumanCode,
			instance.TypeID,
			instance.Description,
			instance.Status,
			strconv.Itoa(instance.UseCount),
			instance.Location,
			currentRequestID,
			instance.CreatedAt.Format(time.RFC3339),
			instance.UpdatedAt.Format(time.RFC3339),
		}); err != nil {
			http.Error(w, `{"error":"failed to write csv row"}`, http.StatusInternalServerError)
			return
		}
	}

	csvWriter.Flush()
	if err := csvWriter.Error(); err != nil {
		http.Error(w, `{"error":"failed to finalize csv export"}`, http.StatusInternalServerError)
	}
}

// ImportInventoryCSV imports inventory rows from CSV.
func (h *InventoryHandler) ImportInventoryCSV(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, `{"error":"invalid multipart form"}`, http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error":"file is required (form field: file)"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1

	header, err := reader.Read()
	if err != nil {
		http.Error(w, `{"error":"failed to read csv header"}`, http.StatusBadRequest)
		return
	}

	colIndex := map[string]int{}
	for idx, rawName := range header {
		colIndex[strings.ToLower(strings.TrimSpace(rawName))] = idx
	}

	requiredColumns := []string{"humancode", "typeid", "location"}
	for _, col := range requiredColumns {
		if _, ok := colIndex[col]; !ok {
			http.Error(w, fmt.Sprintf(`{"error":"missing required csv column: %s"}`, col), http.StatusBadRequest)
			return
		}
	}

	getCol := func(record []string, key string) string {
		idx, ok := colIndex[key]
		if !ok || idx >= len(record) {
			return ""
		}
		return strings.TrimSpace(record[idx])
	}

	var inputs []db.UpsertMaterialInstanceInput
	var rowErrors []string
	rowNumber := 1

	for {
		record, readErr := reader.Read()
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil && !errors.Is(readErr, csv.ErrFieldCount) {
			http.Error(w, `{"error":"failed to parse csv"}`, http.StatusBadRequest)
			return
		}
		rowNumber++

		// Skip completely empty rows.
		isEmpty := true
		for _, value := range record {
			if strings.TrimSpace(value) != "" {
				isEmpty = false
				break
			}
		}
		if isEmpty {
			continue
		}

		humanCode := strings.ToUpper(getCol(record, "humancode"))
		typeID := getCol(record, "typeid")
		location := getCol(record, "location")
		description := getCol(record, "description")
		status := strings.ToLower(getCol(record, "status"))
		useCountRaw := getCol(record, "usecount")
		currentRequestIDRaw := getCol(record, "currentrequestid")

		if humanCode == "" || !humanCodePattern.MatchString(humanCode) {
			rowErrors = append(rowErrors, fmt.Sprintf("row %d: invalid humanCode", rowNumber))
			continue
		}
		if typeID == "" {
			rowErrors = append(rowErrors, fmt.Sprintf("row %d: typeId is required", rowNumber))
			continue
		}
		if location == "" {
			rowErrors = append(rowErrors, fmt.Sprintf("row %d: location is required", rowNumber))
			continue
		}

		if status == "" {
			status = domain.StatusAvailable
		}
		if !isValidMaterialStatus(status) {
			rowErrors = append(rowErrors, fmt.Sprintf("row %d: invalid status", rowNumber))
			continue
		}

		useCount := 0
		if useCountRaw != "" {
			parsedUseCount, convErr := strconv.Atoi(useCountRaw)
			if convErr != nil || parsedUseCount < 0 {
				rowErrors = append(rowErrors, fmt.Sprintf("row %d: invalid useCount", rowNumber))
				continue
			}
			useCount = parsedUseCount
		}

		var currentRequestID *string
		if currentRequestIDRaw != "" {
			currentRequestID = &currentRequestIDRaw
		}
		if status == domain.StatusRented && currentRequestID == nil {
			rowErrors = append(rowErrors, fmt.Sprintf("row %d: currentRequestId required for rented status", rowNumber))
			continue
		}
		if status != domain.StatusRented {
			currentRequestID = nil
		}

		inputs = append(inputs, db.UpsertMaterialInstanceInput{
			HumanCode:        humanCode,
			TypeID:           typeID,
			Description:      description,
			Status:           status,
			UseCount:         useCount,
			Location:         location,
			CurrentRequestID: currentRequestID,
		})
	}

	if len(rowErrors) > 0 {
		if len(rowErrors) > 20 {
			rowErrors = rowErrors[:20]
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":   "invalid CSV rows",
			"details": rowErrors,
		})
		return
	}
	if len(inputs) == 0 {
		http.Error(w, `{"error":"csv contains no importable rows"}`, http.StatusBadRequest)
		return
	}

	createdCount, updatedCount, err := h.store.UpsertMaterialInstances(r.Context(), inputs)
	if err != nil {
		http.Error(w, `{"error":"failed to import inventory"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(importInventoryResponse{
		ImportedCount: len(inputs),
		CreatedCount:  createdCount,
		UpdatedCount:  updatedCount,
	})
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

// GetAvailableMaterialCounts returns available material counts by type for org backend
func (h *InventoryHandler) GetAvailableMaterialCounts(w http.ResponseWriter, r *http.Request) {
	availabilities, err := h.store.GetAvailableCountsByType(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch available material counts"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(availabilities)
}

func isValidMaterialStatus(status string) bool {
	switch status {
	case domain.StatusAvailable, domain.StatusRented, domain.StatusReturned:
		return true
	default:
		return false
	}
}
