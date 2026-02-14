package handlers

import (
	"encoding/json"
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
}

// NewRequestsHandler creates a new requests handler.
func NewRequestsHandler(store *db.Store, orgClient *client.OrgClient, distributionCenterID string) *RequestsHandler {
	return &RequestsHandler{
		orgClient:            orgClient,
		store:                store,
		distributionCenterID: distributionCenterID,
	}
}

type incomingRequestItem struct {
	MaterialTypeID    string `json:"materialTypeId"`
	MaterialName      string `json:"materialName"`
	Quantity          int    `json:"quantity"`
	AvailableQuantity int    `json:"availableQuantity"`
	ShortageQuantity  int    `json:"shortageQuantity"`
	IsFulfillable     bool   `json:"isFulfillable"`
}

type incomingRequest struct {
	ID                   string                `json:"id"`
	CustomerID           string                `json:"customerId"`
	DeliveryDate         string                `json:"deliveryDate"`
	Status               string                `json:"status"`
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

	requests, err := h.orgClient.GetRequests(r.Context(), status, h.distributionCenterID)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch requests from organization backend"}`, http.StatusBadGateway)
		return
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
	if materialTypes, err := h.orgClient.GetMaterialTypes(r.Context()); err == nil {
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
			Status:               req.Status,
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

func isValidRequestStatus(status string) bool {
	switch status {
	case "pending", "approved", "inAction", "returned":
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
