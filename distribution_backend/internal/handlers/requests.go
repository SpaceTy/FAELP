package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"distribution_backend/internal/auth"
	"distribution_backend/internal/client"
	"distribution_backend/internal/db"
	"distribution_backend/internal/domain"
)

// RequestsHandler handles incoming request endpoints.
type RequestsHandler struct {
	orgClient            *client.OrgClient
	store                *db.Store
	distributionCenterID string
	uploadPath           string
	auditLogger          *db.AuditLogger
}

// NewRequestsHandler creates a new requests handler.
func NewRequestsHandler(store *db.Store, orgClient *client.OrgClient, distributionCenterID, uploadPath string) *RequestsHandler {
	if strings.TrimSpace(uploadPath) == "" {
		uploadPath = "uploads"
	}
	return &RequestsHandler{
		orgClient:            orgClient,
		store:                store,
		distributionCenterID: distributionCenterID,
		uploadPath:           uploadPath,
	}
}

// NewRequestsHandlerWithAudit creates a new requests handler with audit logging.
func NewRequestsHandlerWithAudit(store *db.Store, orgClient *client.OrgClient, distributionCenterID, uploadPath string, auditLogger *db.AuditLogger) *RequestsHandler {
	if strings.TrimSpace(uploadPath) == "" {
		uploadPath = "uploads"
	}
	return &RequestsHandler{
		orgClient:            orgClient,
		store:                store,
		distributionCenterID: distributionCenterID,
		uploadPath:           uploadPath,
		auditLogger:          auditLogger,
	}
}

type incomingRequestItem struct {
	MaterialTypeID    string `json:"materialTypeId"`
	MaterialName      string `json:"materialName"`
	MaterialImageURL  string `json:"materialImageUrl"`
	Quantity          int    `json:"quantity"`
	AvailableQuantity int    `json:"availableQuantity"`
	ShortageQuantity  int    `json:"shortageQuantity"`
	IsFulfillable     bool   `json:"isFulfillable"`
}

type incomingRequest struct {
	ID                   string                  `json:"id"`
	CustomerID           string                  `json:"customerId"`
	DeliveryDate         string                  `json:"deliveryDate"`
	PlannedReturnDate    string                  `json:"plannedReturnDate,omitempty"`
	IntendedStudents     int                     `json:"intendedStudents"`
	Status               string                  `json:"status"`
	Archived             bool                    `json:"archived"`
	OutgoingTrackingCode string                  `json:"outgoingTrackingCode,omitempty"`
	ShippingCustomerName string                  `json:"shippingName"`
	ShippingAddressLine1 string                  `json:"addressLine1"`
	ShippingAddressLine2 string                  `json:"addressLine2"`
	ShippingCity         string                  `json:"city"`
	ShippingZipCode      string                  `json:"zipCode"`
	Note                 string                  `json:"note"`
	CreatedAt            string                  `json:"createdAt"`
	UpdatedAt            string                  `json:"updatedAt"`
	IsFulfillable        bool                    `json:"isFulfillable"`
	PackagingDraft       *incomingPackagingDraft `json:"packagingDraft,omitempty"`
	Items                []incomingRequestItem   `json:"items"`
}

type incomingPackagingDraftItem struct {
	MaterialTypeID string   `json:"materialTypeId"`
	Codes          []string `json:"codes"`
}

type incomingPackagingDraft struct {
	OutgoingTrackingCode string                       `json:"outgoingTrackingCode,omitempty"`
	CreatedAt            string                       `json:"createdAt"`
	UpdatedAt            string                       `json:"updatedAt"`
	Items                []incomingPackagingDraftItem `json:"items"`
}

// ListIncomingRequests returns incoming requests from organization backend.
// Requires employee authentication via dist backend auth middleware.
func (h *RequestsHandler) ListIncomingRequests(w http.ResponseWriter, r *http.Request) {
	if h.orgClient == nil {
		http.Error(w, `{"error":"organization backend client not configured"}`, http.StatusServiceUnavailable)
		return
	}
	if h.store == nil {
		http.Error(w, `{"error":"inventory store not configured"}`, http.StatusServiceUnavailable)
		return
	}

	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status == "" {
		status = "pending"
	}
	if !isValidRequestStatus(status) {
		http.Error(w, `{"error":"invalid status"}`, http.StatusBadRequest)
		return
	}

	archived := false
	if strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("archived")), "true") {
		archived = true
	}

	requests, err := h.orgClient.GetRequests(r.Context(), status, h.distributionCenterID, &archived)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch requests from organization backend"}`, http.StatusBadGateway)
		return
	}
	if h.store != nil {
		states := make(map[string]bool, len(requests))
		for _, req := range requests {
			states[req.ID] = req.Archived
		}
		_ = h.store.UpsertRequestArchiveStates(r.Context(), states)
	}

	requestIDs := make([]string, 0, len(requests))
	for _, req := range requests {
		requestIDs = append(requestIDs, req.ID)
	}

	packagingDrafts := map[string]db.PackagingDraft{}
	if h.store != nil {
		drafts, err := h.store.GetPackagingDraftsByRequestIDs(r.Context(), requestIDs)
		if err != nil {
			http.Error(w, `{"error":"failed to fetch packaging drafts"}`, http.StatusInternalServerError)
			return
		}
		packagingDrafts = drafts
	}

	availabilities, err := h.store.GetAvailableCountsByType(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch local availability"}`, http.StatusInternalServerError)
		return
	}
	availableByType := make(map[string]int, len(availabilities))
	for _, availability := range availabilities {
		availableByType[availability.MaterialTypeID] = availability.Amount
	}

	typeNameByID := map[string]string{}
	typeImageURLByID := map[string]string{}
	if materialTypes, err := h.orgClient.GetMaterialTypes(r.Context()); err == nil {
		typeImageURLByID = syncMaterialTypeImages(r.Context(), h.orgClient, h.uploadPath, materialTypes)
		for _, mt := range materialTypes {
			typeNameByID[mt.ID] = mt.Name
		}
	}

	resp := make([]incomingRequest, 0, len(requests))
	for _, req := range requests {
		items := make([]incomingRequestItem, len(req.Items))
		isFulfillable := true
		for i, item := range req.Items {
			availableQuantity := availableByType[item.MaterialTypeID]
			shortageQuantity := item.Quantity - availableQuantity
			if shortageQuantity < 0 {
				shortageQuantity = 0
			}
			itemFulfillable := availableQuantity >= item.Quantity
			if !itemFulfillable {
				isFulfillable = false
			}
			materialName := typeNameByID[item.MaterialTypeID]
			if strings.TrimSpace(materialName) == "" {
				materialName = item.MaterialTypeID
			}

			items[i] = incomingRequestItem{
				MaterialTypeID:    item.MaterialTypeID,
				MaterialName:      materialName,
				MaterialImageURL:  typeImageURLByID[item.MaterialTypeID],
				Quantity:          item.Quantity,
				AvailableQuantity: availableQuantity,
				ShortageQuantity:  shortageQuantity,
				IsFulfillable:     itemFulfillable,
			}
		}

		note := ""
		if rawNote, ok := req.Metadata["note"].(string); ok {
			note = strings.TrimSpace(rawNote)
		}

		responseItem := incomingRequest{
			ID:                   req.ID,
			CustomerID:           req.CustomerID,
			DeliveryDate:         req.DeliveryDate.Format("2006-01-02"),
			PlannedReturnDate:    formatOptionalDate(req.PlannedReturnDate),
			IntendedStudents:     req.IntendedStudents,
			Status:               req.Status,
			Archived:             req.Archived,
			OutgoingTrackingCode: derefString(req.OutgoingTrackingCode),
			ShippingCustomerName: req.ShippingCustomerName,
			ShippingAddressLine1: req.ShippingAddressLine1,
			ShippingAddressLine2: req.ShippingAddressLine2,
			ShippingCity:         req.ShippingCity,
			ShippingZipCode:      req.ShippingZipCode,
			Note:                 note,
			CreatedAt:            req.CreatedAt.Format(time.RFC3339),
			UpdatedAt:            req.UpdatedAt.Format(time.RFC3339),
			IsFulfillable:        isFulfillable,
			Items:                items,
		}

		if draft, ok := packagingDrafts[req.ID]; ok {
			draftItems := make([]incomingPackagingDraftItem, 0, len(draft.Items))
			for _, draftItem := range draft.Items {
				draftItems = append(draftItems, incomingPackagingDraftItem{
					MaterialTypeID: draftItem.MaterialTypeID,
					Codes:          draftItem.Codes,
				})
			}
			responseItem.PackagingDraft = &incomingPackagingDraft{
				OutgoingTrackingCode: draft.OutgoingTrackingCode,
				CreatedAt:            draft.CreatedAt.Format(time.RFC3339),
				UpdatedAt:            draft.UpdatedAt.Format(time.RFC3339),
				Items:                draftItems,
			}
		}

		resp = append(resp, responseItem)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func formatOptionalDate(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.Format("2006-01-02")
}

func isValidRequestStatus(status string) bool {
	switch status {
	case "pending", "approved", "inAction", "returned", "cancelled":
		return true
	default:
		return false
	}
}

// ApproveIncomingRequest approves a request in organization backend and binds it to this distribution center.
func (h *RequestsHandler) ApproveIncomingRequest(w http.ResponseWriter, r *http.Request) {
	if h.orgClient == nil {
		http.Error(w, `{"error":"organization backend client not configured"}`, http.StatusServiceUnavailable)
		return
	}
	if strings.TrimSpace(h.distributionCenterID) == "" {
		http.Error(w, `{"error":"distribution center id not configured"}`, http.StatusServiceUnavailable)
		return
	}

	requestID := strings.TrimSpace(r.PathValue("id"))
	if requestID == "" {
		http.Error(w, `{"error":"request id is required"}`, http.StatusBadRequest)
		return
	}

	approved, err := h.orgClient.ApproveRequest(r.Context(), requestID, h.distributionCenterID)
	if err != nil {
		http.Error(w, `{"error":"failed to approve request"}`, http.StatusBadGateway)
		return
	}

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "request.approve", "request", requestID, map[string]interface{}{
			"status": approved.Status,
		}, nil)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(approved)
}

type packagingItem struct {
	MaterialTypeID string   `json:"materialTypeId"`
	Codes          []string `json:"codes"`
}

type markInActionBody struct {
	OutgoingTrackingCode string          `json:"outgoingTrackingCode"`
	Items                []packagingItem `json:"items"`
}

type savePackagingDraftBody struct {
	OutgoingTrackingCode string          `json:"outgoingTrackingCode"`
	Items                []packagingItem `json:"items"`
}

// MarkIncomingRequestInAction marks an approved request as inAction with outgoing tracking code.
func (h *RequestsHandler) MarkIncomingRequestInAction(w http.ResponseWriter, r *http.Request) {
	if h.orgClient == nil {
		http.Error(w, `{"error":"organization backend client not configured"}`, http.StatusServiceUnavailable)
		return
	}
	if strings.TrimSpace(h.distributionCenterID) == "" {
		http.Error(w, `{"error":"distribution center id not configured"}`, http.StatusServiceUnavailable)
		return
	}

	requestID := strings.TrimSpace(r.PathValue("id"))
	if requestID == "" {
		http.Error(w, `{"error":"request id is required"}`, http.StatusBadRequest)
		return
	}

	var body markInActionBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json body"}`, http.StatusBadRequest)
		return
	}

	body.OutgoingTrackingCode = strings.TrimSpace(body.OutgoingTrackingCode)
	if body.OutgoingTrackingCode == "" {
		http.Error(w, `{"error":"outgoingTrackingCode is required"}`, http.StatusBadRequest)
		return
	}

	normalizedItems, instancesToAssign, err := h.resolvePackagingInstances(r.Context(), requestID, body.Items)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	body.Items = normalizedItems

	updated, err := h.orgClient.MarkRequestInAction(r.Context(), requestID, h.distributionCenterID, body.OutgoingTrackingCode)
	if err != nil {
		http.Error(w, `{"error":"failed to mark request inAction"}`, http.StatusBadGateway)
		return
	}

	// Assign material instances to this request
	if h.store != nil && len(instancesToAssign) > 0 {
		instanceIDs := make([]string, 0, len(instancesToAssign))
		for _, instance := range instancesToAssign {
			instanceIDs = append(instanceIDs, instance.ID)
		}
		if err := h.store.SyncReservedInstancesForRequest(r.Context(), requestID, instanceIDs); err != nil {
			http.Error(w, `{"error":"failed to reserve material instances for request"}`, http.StatusInternalServerError)
			return
		}
		_ = h.store.DeletePackagingDraft(r.Context(), requestID)
	}

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "request.in_action", "request", requestID, map[string]interface{}{
			"status":               updated.Status,
			"outgoingTrackingCode": body.OutgoingTrackingCode,
		}, nil)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

func (h *RequestsHandler) SavePackagingDraft(w http.ResponseWriter, r *http.Request) {
	if h.store == nil {
		http.Error(w, `{"error":"inventory store not configured"}`, http.StatusServiceUnavailable)
		return
	}

	requestID := strings.TrimSpace(r.PathValue("id"))
	if requestID == "" {
		http.Error(w, `{"error":"request id is required"}`, http.StatusBadRequest)
		return
	}

	var body savePackagingDraftBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json body"}`, http.StatusBadRequest)
		return
	}

	normalizedItems, instances, err := h.resolvePackagingInstances(r.Context(), requestID, body.Items)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(normalizedItems) == 0 {
		http.Error(w, `{"error":"at least one packaging item is required"}`, http.StatusBadRequest)
		return
	}

	instanceIDs := make([]string, 0, len(instances))
	for _, instance := range instances {
		instanceIDs = append(instanceIDs, instance.ID)
	}

	draft := db.PackagingDraft{
		RequestID:            requestID,
		OutgoingTrackingCode: strings.TrimSpace(body.OutgoingTrackingCode),
		Items:                make([]db.PackagingDraftItem, 0, len(normalizedItems)),
	}
	for _, item := range normalizedItems {
		draft.Items = append(draft.Items, db.PackagingDraftItem{
			MaterialTypeID: item.MaterialTypeID,
			Codes:          item.Codes,
		})
	}

	if err := h.store.SavePackagingDraft(r.Context(), draft, instanceIDs); err != nil {
		http.Error(w, `{"error":"failed to save packaging draft"}`, http.StatusInternalServerError)
		return
	}

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "request.packaging_draft", "request", requestID, map[string]interface{}{
			"items":                len(draft.Items),
			"outgoingTrackingCode": draft.OutgoingTrackingCode,
		}, nil)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
}

// CancelAssignedIncomingRequest reverts approved/inAction request back to pending and clears assignment/tracking.
func (h *RequestsHandler) CancelAssignedIncomingRequest(w http.ResponseWriter, r *http.Request) {
	if h.orgClient == nil {
		http.Error(w, `{"error":"organization backend client not configured"}`, http.StatusServiceUnavailable)
		return
	}
	if strings.TrimSpace(h.distributionCenterID) == "" {
		http.Error(w, `{"error":"distribution center id not configured"}`, http.StatusServiceUnavailable)
		return
	}

	requestID := strings.TrimSpace(r.PathValue("id"))
	if requestID == "" {
		http.Error(w, `{"error":"request id is required"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.orgClient.CancelAssignedRequest(r.Context(), requestID, h.distributionCenterID)
	if err != nil {
		http.Error(w, `{"error":"failed to cancel request"}`, http.StatusBadGateway)
		return
	}

	if h.store != nil {
		_ = h.store.SyncReservedInstancesForRequest(r.Context(), requestID, nil)
		_ = h.store.DeletePackagingDraft(r.Context(), requestID)
	}

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "request.cancel", "request", requestID, map[string]interface{}{
			"status": updated.Status,
		}, nil)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

// ArchiveIncomingRequest archives a request in organization backend.
func (h *RequestsHandler) ArchiveIncomingRequest(w http.ResponseWriter, r *http.Request) {
	if h.orgClient == nil {
		http.Error(w, `{"error":"organization backend client not configured"}`, http.StatusServiceUnavailable)
		return
	}
	if strings.TrimSpace(h.distributionCenterID) == "" {
		http.Error(w, `{"error":"distribution center id not configured"}`, http.StatusServiceUnavailable)
		return
	}

	requestID := strings.TrimSpace(r.PathValue("id"))
	if requestID == "" {
		http.Error(w, `{"error":"request id is required"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.orgClient.ArchiveRequest(r.Context(), requestID, h.distributionCenterID)
	if err != nil {
		http.Error(w, `{"error":"failed to archive request"}`, http.StatusBadGateway)
		return
	}
	if h.store != nil {
		_ = h.store.SetRequestArchived(r.Context(), requestID, true)
	}

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "request.archive", "request", requestID, map[string]interface{}{
			"archived": true,
		}, nil)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

// UnarchiveIncomingRequest unarchives a request in organization backend.
func (h *RequestsHandler) UnarchiveIncomingRequest(w http.ResponseWriter, r *http.Request) {
	if h.orgClient == nil {
		http.Error(w, `{"error":"organization backend client not configured"}`, http.StatusServiceUnavailable)
		return
	}
	if strings.TrimSpace(h.distributionCenterID) == "" {
		http.Error(w, `{"error":"distribution center id not configured"}`, http.StatusServiceUnavailable)
		return
	}

	requestID := strings.TrimSpace(r.PathValue("id"))
	if requestID == "" {
		http.Error(w, `{"error":"request id is required"}`, http.StatusBadRequest)
		return
	}

	updated, err := h.orgClient.UnarchiveRequest(r.Context(), requestID, h.distributionCenterID)
	if err != nil {
		http.Error(w, `{"error":"failed to unarchive request"}`, http.StatusBadGateway)
		return
	}
	if h.store != nil {
		_ = h.store.SetRequestArchived(r.Context(), requestID, false)
	}

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "request.unarchive", "request", requestID, map[string]interface{}{
			"archived": false,
		}, nil)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

type inspectItemBody struct {
	ItemIndex         int    `json:"itemIndex"`
	HumanCode         string `json:"humanCode"`
	Condition         string `json:"condition"`
	Destination       string `json:"destination"`
	ReturnToInventory bool   `json:"returnToInventory"`
	Location          string `json:"location"`
}

// InspectReturnItem looks up a returned material instance by human code,
// updates its location, increments use_count, and sets its status based on destination.
func (h *RequestsHandler) InspectReturnItem(w http.ResponseWriter, r *http.Request) {
	if h.store == nil {
		http.Error(w, `{"error":"inventory store not configured"}`, http.StatusServiceUnavailable)
		return
	}

	requestID := strings.TrimSpace(r.PathValue("id"))
	if requestID == "" {
		http.Error(w, `{"error":"request id is required"}`, http.StatusBadRequest)
		return
	}

	var body inspectItemBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json body"}`, http.StatusBadRequest)
		return
	}

	body.HumanCode = strings.ToUpper(strings.TrimSpace(body.HumanCode))
	if body.HumanCode == "" {
		http.Error(w, `{"error":"humanCode is required"}`, http.StatusBadRequest)
		return
	}

	instance, err := h.store.GetMaterialInstanceByHumanCode(r.Context(), body.HumanCode)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, fmt.Sprintf(`{"error":"item with code '%s' not found"}`, body.HumanCode), http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to look up material instance"}`, http.StatusInternalServerError)
		return
	}

	newStatus := "available"
	if body.Destination == "writeoff" {
		newStatus = "archived"
	}

	updated, err := h.store.ReturnAndInspectMaterialInstance(r.Context(), instance.ID, newStatus, strings.TrimSpace(body.Location))
	if err != nil {
		http.Error(w, `{"error":"failed to update material instance"}`, http.StatusInternalServerError)
		return
	}

	if h.auditLogger != nil {
		userCtx, _ := auth.GetUserFromContext(r.Context())
		_ = h.auditLogger.Log(r.Context(), userCtx.UserID, userCtx.Username, "request.inspect_item", "request", requestID, map[string]interface{}{
			"humanCode":   body.HumanCode,
			"condition":   body.Condition,
			"destination": body.Destination,
			"location":    body.Location,
			"newStatus":   newStatus,
		}, nil)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

// GetRequestInstances returns all material instances currently assigned to a request.
func (h *RequestsHandler) GetRequestInstances(w http.ResponseWriter, r *http.Request) {
	if h.store == nil {
		http.Error(w, `{"error":"inventory store not configured"}`, http.StatusServiceUnavailable)
		return
	}

	requestID := strings.TrimSpace(r.PathValue("id"))
	if requestID == "" {
		http.Error(w, `{"error":"request id is required"}`, http.StatusBadRequest)
		return
	}

	instances, err := h.store.GetInstancesByRequestID(r.Context(), requestID)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch request instances"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(instances)
}

func derefString(input *string) string {
	if input == nil {
		return ""
	}
	return *input
}

func (h *RequestsHandler) resolvePackagingInstances(ctx context.Context, requestID string, items []packagingItem) ([]packagingItem, []domain.MaterialInstance, error) {
	if h.store == nil {
		return nil, nil, fmt.Errorf(`{"error":"inventory store not configured"}`)
	}

	normalizedItems := make([]packagingItem, 0, len(items))
	instances := make([]domain.MaterialInstance, 0)
	seenCodes := make(map[string]struct{})

	for _, item := range items {
		materialTypeID := strings.TrimSpace(item.MaterialTypeID)
		if materialTypeID == "" {
			continue
		}

		normalizedCodes := make([]string, 0, len(item.Codes))
		for _, rawCode := range item.Codes {
			code := strings.ToUpper(strings.TrimSpace(rawCode))
			if code == "" {
				continue
			}
			if _, exists := seenCodes[code]; exists {
				return nil, nil, fmt.Errorf(`{"error":"duplicate code '%s' in packaging draft"}`, code)
			}
			seenCodes[code] = struct{}{}

			instance, err := h.store.GetMaterialInstanceByHumanCode(ctx, code)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					return nil, nil, fmt.Errorf(`{"error":"invalid code '%s': material instance not found"}`, code)
				}
				return nil, nil, fmt.Errorf(`{"error":"failed to validate material codes"}`)
			}

			if instance.TypeID != materialTypeID {
				return nil, nil, fmt.Errorf(`{"error":"invalid code '%s': does not belong to the expected material type"}`, code)
			}

			if instance.Status != domain.StatusAvailable && !(instance.CurrentRequestID != nil && *instance.CurrentRequestID == requestID) {
				return nil, nil, fmt.Errorf(`{"error":"invalid code '%s': material instance is no longer available"}`, code)
			}

			normalizedCodes = append(normalizedCodes, code)
			instances = append(instances, instance)
		}

		if len(normalizedCodes) == 0 {
			continue
		}

		normalizedItems = append(normalizedItems, packagingItem{
			MaterialTypeID: materialTypeID,
			Codes:          normalizedCodes,
		})
	}

	return normalizedItems, instances, nil
}
