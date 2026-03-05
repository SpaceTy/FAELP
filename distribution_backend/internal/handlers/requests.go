package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"distribution_backend/internal/client"
	"distribution_backend/internal/db"
)

// RequestsHandler handles incoming request endpoints.
type RequestsHandler struct {
	orgClient            *client.OrgClient
	store                *db.Store
	distributionCenterID string
	uploadPath           string
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
	ID                   string                `json:"id"`
	CustomerID           string                `json:"customerId"`
	DeliveryDate         string                `json:"deliveryDate"`
	PlannedReturnDate    string                `json:"plannedReturnDate,omitempty"`
	IntendedStudents     int                   `json:"intendedStudents"`
	Status               string                `json:"status"`
	Archived             bool                  `json:"archived"`
	OutgoingTrackingCode string                `json:"outgoingTrackingCode,omitempty"`
	ShippingCustomerName string                `json:"shippingName"`
	ShippingAddressLine1 string                `json:"addressLine1"`
	ShippingAddressLine2 string                `json:"addressLine2"`
	ShippingCity         string                `json:"city"`
	ShippingZipCode      string                `json:"zipCode"`
	Note                 string                `json:"note"`
	CreatedAt            string                `json:"createdAt"`
	UpdatedAt            string                `json:"updatedAt"`
	IsFulfillable        bool                  `json:"isFulfillable"`
	Items                []incomingRequestItem `json:"items"`
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

		resp = append(resp, incomingRequest{
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
		})
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

	// Validate that all provided codes are valid for their material types
	if len(body.Items) > 0 && h.store != nil {
		for _, item := range body.Items {
			for _, code := range item.Codes {
				code = strings.ToUpper(strings.TrimSpace(code))
				if code == "" {
					continue
				}

				instance, err := h.store.GetMaterialInstanceByHumanCode(r.Context(), code)
				if err != nil {
					if errors.Is(err, sql.ErrNoRows) {
						http.Error(w, fmt.Sprintf(`{"error":"invalid code '%s': material instance not found"}`, code), http.StatusBadRequest)
						return
					}
					http.Error(w, `{"error":"failed to validate material codes"}`, http.StatusInternalServerError)
					return
				}

				if instance.TypeID != item.MaterialTypeID {
					http.Error(w, fmt.Sprintf(`{"error":"invalid code '%s': does not belong to the expected material type"}`, code), http.StatusBadRequest)
					return
				}
			}
		}
	}

	updated, err := h.orgClient.MarkRequestInAction(r.Context(), requestID, h.distributionCenterID, body.OutgoingTrackingCode)
	if err != nil {
		http.Error(w, `{"error":"failed to mark request inAction"}`, http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
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

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

func derefString(input *string) string {
	if input == nil {
		return ""
	}
	return *input
}
