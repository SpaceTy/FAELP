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

	"distribution_backend/internal/auth"
	"distribution_backend/internal/client"
	"distribution_backend/internal/db"
	"distribution_backend/internal/domain"
	"github.com/lib/pq"
)

// InventoryHandler handles inventory endpoints.
type InventoryHandler struct {
	store             *db.Store
	orgClient         *client.OrgClient
	uploadPath        string
	auditLogger       *db.AuditLogger
	inventoryNotifier *db.InventoryNotifier
}

// NewInventoryHandler creates a new inventory handler.
func NewInventoryHandler(store *db.Store, orgClient *client.OrgClient, uploadPath string) *InventoryHandler {
	if strings.TrimSpace(uploadPath) == "" {
		uploadPath = "uploads"
	}
	return &InventoryHandler{store: store, orgClient: orgClient, uploadPath: uploadPath}
}

// NewInventoryHandlerWithAudit creates a new inventory handler with audit logging.
func NewInventoryHandlerWithAudit(store *db.Store, orgClient *client.OrgClient, uploadPath string, auditLogger *db.AuditLogger) *InventoryHandler {
	if strings.TrimSpace(uploadPath) == "" {
		uploadPath = "uploads"
	}
	return &InventoryHandler{store: store, orgClient: orgClient, uploadPath: uploadPath, auditLogger: auditLogger}
}

// WithInventoryNotifier attaches a notifier for real-time SSE support.
func (h *InventoryHandler) WithInventoryNotifier(n *db.InventoryNotifier) *InventoryHandler {
	h.inventoryNotifier = n
	return h
}

// SubscribeInventory streams SSE events whenever inventory changes.
func (h *InventoryHandler) SubscribeInventory(w http.ResponseWriter, r *http.Request) {
	if h.inventoryNotifier == nil {
		http.Error(w, `{"error":"not available"}`, http.StatusServiceUnavailable)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	fmt.Fprintf(w, ": connected\n\n")
	flusher.Flush()

	subID, updates := h.inventoryNotifier.Subscribe()
	defer h.inventoryNotifier.Unsubscribe(subID)

	for {
		select {
		case <-r.Context().Done():
			return
		case _, ok := <-updates:
			if !ok {
				return
			}
			fmt.Fprintf(w, "event: update\ndata: {\"type\":\"change\"}\n\n")
			flusher.Flush()
		}
	}
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
	imageURLByID := syncMaterialTypeImages(r.Context(), h.orgClient, h.uploadPath, materialTypes)
	for i := range materialTypes {
		if localURL, ok := imageURLByID[materialTypes[i].ID]; ok {
			materialTypes[i].ImageURL = localURL
		}
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

type bulkCreateResponse struct {
	CreatedCount int `json:"createdCount"`
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

type validateCodeResponse struct {
	Valid       bool   `json:"valid"`
	Code        string `json:"code,omitempty"`
	TypeID      string `json:"typeId,omitempty"`
	TypeIDMatch bool   `json:"typeIdMatch,omitempty"`
	Error       string `json:"error,omitempty"`
}

// ValidateMaterialCode validates that a human code exists and optionally matches a material type.
func (h *InventoryHandler) ValidateMaterialCode(w http.ResponseWriter, r *http.Request) {
	code := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("code")))
	expectedTypeID := strings.TrimSpace(r.URL.Query().Get("typeId"))

	if code == "" {
		http.Error(w, `{"error":"code is required"}`, http.StatusBadRequest)
		return
	}

	if !humanCodePattern.MatchString(code) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(validateCodeResponse{
			Valid: false,
			Error: "Code must be exactly 5 uppercase letters",
		})
		return
	}

	instance, err := h.store.GetMaterialInstanceByHumanCode(r.Context(), code)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(validateCodeResponse{
				Valid: false,
				Code:  code,
				Error: "Material code not found",
			})
			return
		}
		http.Error(w, `{"error":"failed to validate code"}`, http.StatusInternalServerError)
		return
	}

	response := validateCodeResponse{
		Valid:  true,
		Code:   instance.HumanCode,
		TypeID: instance.TypeID,
	}

	if expectedTypeID != "" {
		response.TypeIDMatch = instance.TypeID == expectedTypeID
		if !response.TypeIDMatch {
			response.Valid = false
			response.Error = "Code does not belong to the expected material type"
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
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

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "inventory.create", "material_instance", instance.ID, map[string]interface{}{
			"humanCode": instance.HumanCode,
			"typeId":    instance.TypeID,
			"location":  instance.Location,
		}, nil)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(instance)
}

// BulkCreateMaterialInstances creates multiple inventory items with generated codes.
func (h *InventoryHandler) BulkCreateMaterialInstances(w http.ResponseWriter, r *http.Request) {
	var req domain.BulkCreateMaterialInstancesInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.TypeID = strings.TrimSpace(req.TypeID)
	req.Location = strings.TrimSpace(req.Location)
	if req.TypeID == "" {
		http.Error(w, `{"error":"typeId is required"}`, http.StatusBadRequest)
		return
	}
	if req.Location == "" {
		http.Error(w, `{"error":"location is required"}`, http.StatusBadRequest)
		return
	}
	if req.Quantity <= 0 {
		http.Error(w, `{"error":"quantity must be greater than 0"}`, http.StatusBadRequest)
		return
	}
	if req.Quantity > 1000 {
		http.Error(w, `{"error":"quantity must be 1000 or less"}`, http.StatusBadRequest)
		return
	}
	if !req.Acknowledged {
		http.Error(w, `{"error":"bulk add acknowledgement is required"}`, http.StatusBadRequest)
		return
	}

	instances, err := h.store.CreateMaterialInstancesBulk(r.Context(), req, req.Location)
	if err != nil {
		http.Error(w, `{"error":"failed to bulk create material instances"}`, http.StatusInternalServerError)
		return
	}

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "inventory.bulk_create", "material_instance", "", map[string]interface{}{
			"typeId":       req.TypeID,
			"quantity":     len(instances),
			"location":     req.Location,
			"acknowledged": req.Acknowledged,
		}, nil)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(bulkCreateResponse{CreatedCount: len(instances)})
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
		Query:     strings.TrimSpace(r.URL.Query().Get("query")),
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
		Query:     strings.TrimSpace(r.URL.Query().Get("query")),
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

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "inventory.import", "material_instance", "", map[string]interface{}{
			"importedCount": len(inputs),
			"createdCount":  createdCount,
			"updatedCount":  updatedCount,
		}, nil)
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

	existing, err := h.store.GetMaterialInstanceByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, `{"error":"material instance not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to fetch material instance"}`, http.StatusInternalServerError)
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

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		previousState := map[string]interface{}{
			"humanCode":   existing.HumanCode,
			"typeId":      existing.TypeID,
			"description": existing.Description,
			"status":      existing.Status,
			"useCount":    existing.UseCount,
			"location":    existing.Location,
		}
		newState := map[string]interface{}{
			"status":   instance.Status,
			"location": instance.Location,
		}
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "inventory.update", "material_instance", instance.ID, newState, previousState)
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

	existing, err := h.store.GetMaterialInstanceByID(r.Context(), id)
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

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		previousState := map[string]interface{}{
			"humanCode":   existing.HumanCode,
			"typeId":      existing.TypeID,
			"description": existing.Description,
			"status":      existing.Status,
			"useCount":    existing.UseCount,
			"location":    existing.Location,
		}
		if existing.CurrentRequestID != nil {
			previousState["currentRequestId"] = *existing.CurrentRequestID
		}
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "inventory.delete", "material_instance", id, nil, previousState)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "material instance deleted"})
}

// ArchiveMaterialInstance marks an inventory item as archived.
func (h *InventoryHandler) ArchiveMaterialInstance(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"instance id required"}`, http.StatusBadRequest)
		return
	}

	existing, err := h.store.GetMaterialInstanceByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, `{"error":"material instance not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to fetch material instance"}`, http.StatusInternalServerError)
		return
	}
	if existing.Status == domain.StatusRented {
		http.Error(w, `{"error":"cannot archive rented material instance"}`, http.StatusConflict)
		return
	}

	instance, err := h.store.ArchiveMaterialInstance(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, `{"error":"material instance not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to archive material instance"}`, http.StatusInternalServerError)
		return
	}

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		previousState := map[string]interface{}{
			"status": existing.Status,
		}
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "inventory.archive", "material_instance", instance.ID, map[string]interface{}{"status": instance.Status}, previousState)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(instance)
}

// UnarchiveMaterialInstance marks an archived inventory item as available.
func (h *InventoryHandler) UnarchiveMaterialInstance(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, `{"error":"instance id required"}`, http.StatusBadRequest)
		return
	}

	existing, err := h.store.GetMaterialInstanceByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, `{"error":"material instance not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to fetch material instance"}`, http.StatusInternalServerError)
		return
	}
	if existing.Status != domain.StatusArchived {
		http.Error(w, `{"error":"material instance is not archived"}`, http.StatusConflict)
		return
	}

	instance, err := h.store.UnarchiveMaterialInstance(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, `{"error":"material instance not found or not archived"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"failed to unarchive material instance"}`, http.StatusInternalServerError)
		return
	}

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		previousState := map[string]interface{}{
			"status": existing.Status,
		}
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "inventory.unarchive", "material_instance", instance.ID, map[string]interface{}{"status": instance.Status}, previousState)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(instance)
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

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "inventory.assign", "material_instance", instance.ID, map[string]interface{}{
			"requestId": req.RequestID,
			"status":    instance.Status,
		}, nil)
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

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "inventory.release", "material_instance", instance.ID, map[string]interface{}{
			"status":   instance.Status,
			"useCount": instance.UseCount,
		}, nil)
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
	case domain.StatusAvailable, domain.StatusRented, domain.StatusReturned, domain.StatusArchived:
		return true
	default:
		return false
	}
}
