package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"organization_backend/internal/db"
	"organization_backend/internal/domain"
)

type RequestHandler struct {
	Store *db.Store
}

type createRequestRequest struct {
	DeliveryDate         string `json:"deliveryDate"`
	PlannedReturnDate    string `json:"plannedReturnDate"`
	ShippingCustomerName string `json:"shippingName"`
	ShippingAddressLine1 string `json:"addressLine1"`
	ShippingAddressLine2 string `json:"addressLine2"`
	ShippingCity         string `json:"city"`
	ShippingZipCode      string `json:"zipCode"`
	Note                 string `json:"note"`
	Items                []struct {
		MaterialTypeID string `json:"materialTypeId"`
		Quantity       int    `json:"quantity"`
	} `json:"items"`
}

func (h *RequestHandler) CreateRequest(w http.ResponseWriter, r *http.Request) {
	slog.Info("create_request_handler_entered",
		"method", r.Method,
		"path", r.URL.Path,
		"remote_addr", r.RemoteAddr,
	)

	claims := GetClaimsFromContext(r.Context())
	if claims == nil {
		slog.Info("create_request_failed_no_claims")
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	slog.Info("create_request_claims_found",
		"customer_id", claims.CustomerID,
		"is_admin", claims.IsAdmin,
	)

	var req createRequestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		slog.Info("create_request_failed_json_decode", "error", err.Error())
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	slog.Info("create_request_json_decoded",
		"shipping_name", req.ShippingCustomerName,
		"delivery_date", req.DeliveryDate,
		"planned_return_date", req.PlannedReturnDate,
		"item_count", len(req.Items),
	)

	if strings.TrimSpace(req.ShippingCustomerName) == "" {
		slog.Info("create_request_validation_failed", "field", "shipping_name", "reason", "empty")
		writeError(w, http.StatusBadRequest, "validation_error", "Shipping name is required")
		return
	}
	if strings.TrimSpace(req.ShippingAddressLine1) == "" {
		slog.Info("create_request_validation_failed", "field", "address_line1", "reason", "empty")
		writeError(w, http.StatusBadRequest, "validation_error", "Address is required")
		return
	}
	if strings.TrimSpace(req.ShippingCity) == "" {
		slog.Info("create_request_validation_failed", "field", "city", "reason", "empty")
		writeError(w, http.StatusBadRequest, "validation_error", "City is required")
		return
	}
	if strings.TrimSpace(req.ShippingZipCode) == "" {
		slog.Info("create_request_validation_failed", "field", "zip_code", "reason", "empty")
		writeError(w, http.StatusBadRequest, "validation_error", "Zip code is required")
		return
	}
	if req.DeliveryDate == "" {
		slog.Info("create_request_validation_failed", "field", "delivery_date", "reason", "empty")
		writeError(w, http.StatusBadRequest, "validation_error", "Delivery date is required")
		return
	}
	if req.PlannedReturnDate == "" {
		slog.Info("create_request_validation_failed", "field", "planned_return_date", "reason", "empty")
		writeError(w, http.StatusBadRequest, "validation_error", "Planned return date is required")
		return
	}
	if len(req.Items) == 0 {
		slog.Info("create_request_validation_failed", "field", "items", "reason", "empty")
		writeError(w, http.StatusBadRequest, "validation_error", "At least one item is required")
		return
	}

	deliveryDate, err := time.Parse("2006-01-02", req.DeliveryDate)
	if err != nil {
		slog.Info("create_request_validation_failed",
			"field", "delivery_date",
			"reason", "invalid_format",
			"value", req.DeliveryDate,
			"error", err.Error(),
		)
		writeError(w, http.StatusBadRequest, "validation_error", "Invalid delivery date format (use YYYY-MM-DD)")
		return
	}
	plannedReturnDate, err := time.Parse("2006-01-02", req.PlannedReturnDate)
	if err != nil {
		slog.Info("create_request_validation_failed",
			"field", "planned_return_date",
			"reason", "invalid_format",
			"value", req.PlannedReturnDate,
			"error", err.Error(),
		)
		writeError(w, http.StatusBadRequest, "validation_error", "Invalid planned return date format (use YYYY-MM-DD)")
		return
	}

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	if deliveryDate.Before(today) {
		slog.Info("create_request_validation_failed",
			"field", "delivery_date",
			"reason", "past_date",
			"value", req.DeliveryDate,
		)
		writeError(w, http.StatusBadRequest, "validation_error", "Delivery date must be in the future")
		return
	}
	if plannedReturnDate.Before(deliveryDate) {
		slog.Info("create_request_validation_failed",
			"field", "planned_return_date",
			"reason", "before_delivery_date",
			"value", req.PlannedReturnDate,
		)
		writeError(w, http.StatusBadRequest, "validation_error", "Planned return date must be on or after delivery date")
		return
	}

	slog.Info("create_request_date_validated",
		"delivery_date", deliveryDate,
		"planned_return_date", plannedReturnDate,
	)

	items := make([]domain.RequestItem, len(req.Items))
	for i, item := range req.Items {
		if strings.TrimSpace(item.MaterialTypeID) == "" {
			slog.Info("create_request_validation_failed",
				"field", "items",
				"index", i,
				"reason", "missing_material_type_id",
			)
			writeError(w, http.StatusBadRequest, "validation_error", "Material type ID is required for all items")
			return
		}
		if item.Quantity <= 0 {
			slog.Info("create_request_validation_failed",
				"field", "items",
				"index", i,
				"material_type_id", item.MaterialTypeID,
				"reason", "invalid_quantity",
				"quantity", item.Quantity,
			)
			writeError(w, http.StatusBadRequest, "validation_error", "Quantity must be greater than 0 for all items")
			return
		}
		items[i] = domain.RequestItem{
			MaterialTypeID: strings.TrimSpace(item.MaterialTypeID),
			Quantity:       item.Quantity,
		}
	}

	slog.Info("create_request_items_validated", "item_count", len(items))

	input := domain.CreateRequestInput{
		CustomerID:           claims.CustomerID,
		DeliveryDate:         deliveryDate,
		PlannedReturnDate:    plannedReturnDate,
		ShippingCustomerName: strings.TrimSpace(req.ShippingCustomerName),
		ShippingAddressLine1: strings.TrimSpace(req.ShippingAddressLine1),
		ShippingAddressLine2: strings.TrimSpace(req.ShippingAddressLine2),
		ShippingCity:         strings.TrimSpace(req.ShippingCity),
		ShippingZipCode:      strings.TrimSpace(req.ShippingZipCode),
		Note:                 strings.TrimSpace(req.Note),
		Items:                items,
	}

	slog.Info("create_request_calling_store",
		"customer_id", input.CustomerID,
		"delivery_date", input.DeliveryDate,
		"shipping_city", input.ShippingCity,
		"item_count", len(input.Items),
	)

	created, err := h.Store.CreateRequest(r.Context(), input)
	if err != nil {
		slog.Info("create_request_store_failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "create_failed", "Failed to create request")
		return
	}

	slog.Info("create_request_completed",
		"request_id", created.ID,
		"customer_id", created.CustomerID,
		"status", created.Status,
	)

	writeJSON(w, http.StatusCreated, created)
}

// ListMyRequests returns all requests for the currently authenticated customer
func (h *RequestHandler) ListMyRequests(w http.ResponseWriter, r *http.Request) {
	slog.Info("list_my_requests_handler_entered",
		"method", r.Method,
		"path", r.URL.Path,
		"remote_addr", r.RemoteAddr,
	)

	claims := GetClaimsFromContext(r.Context())
	if claims == nil {
		slog.Info("list_my_requests_failed_no_claims")
		writeError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	slog.Info("list_my_requests_claims_found",
		"customer_id", claims.CustomerID,
		"is_admin", claims.IsAdmin,
	)

	requests, err := h.Store.ListRequestsByCustomerID(r.Context(), claims.CustomerID)
	if err != nil {
		slog.Info("list_my_requests_store_failed", "error", err.Error())
		writeError(w, http.StatusInternalServerError, "fetch_failed", "Failed to fetch requests")
		return
	}

	slog.Info("list_my_requests_completed",
		"customer_id", claims.CustomerID,
		"count", len(requests),
	)

	writeJSON(w, http.StatusOK, requests)
}

// ListRequestsForDistribution returns requests for distribution backend usage.
// Supports optional status query filtering and is intended for internal/service calls.
func (h *RequestHandler) ListRequestsForDistribution(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status != "" && !isValidRequestStatus(status) {
		writeError(w, http.StatusBadRequest, "invalid_status", "Status must be one of: pending, approved, inAction, returned")
		return
	}

	distributionCenterID := strings.TrimSpace(r.URL.Query().Get("distributionCenterId"))
	requests, err := h.Store.ListRequests(r.Context(), status, distributionCenterID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_failed", "Failed to fetch requests")
		return
	}

	writeJSON(w, http.StatusOK, requests)
}

type approveRequestBody struct {
	DistributionCenterID string `json:"distributionCenterId"`
}

type markRequestInActionBody struct {
	DistributionCenterID string `json:"distributionCenterId"`
	OutgoingTrackingCode string `json:"outgoingTrackingCode"`
}

type cancelAssignedRequestBody struct {
	DistributionCenterID string `json:"distributionCenterId"`
}

// ApproveRequestForDistribution sets request status to approved and binds it to a distribution center.
func (h *RequestHandler) ApproveRequestForDistribution(w http.ResponseWriter, r *http.Request) {
	requestID := strings.TrimSpace(chi.URLParam(r, "id"))
	if requestID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Request ID is required")
		return
	}

	var req approveRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}
	req.DistributionCenterID = strings.TrimSpace(req.DistributionCenterID)
	if req.DistributionCenterID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "distributionCenterId is required")
		return
	}

	approved, err := h.Store.ApproveRequest(r.Context(), requestID, req.DistributionCenterID)
	if err != nil {
		switch {
		case errors.Is(err, db.ErrRequestNotFound):
			writeError(w, http.StatusNotFound, "not_found", "Request not found")
		case errors.Is(err, db.ErrRequestAlreadyApproved):
			writeError(w, http.StatusConflict, "already_approved", "Request already approved by another distribution center")
		case errors.Is(err, db.ErrInvalidRequestStatus):
			writeError(w, http.StatusConflict, "invalid_status", "Request cannot be approved in its current status")
		default:
			writeError(w, http.StatusInternalServerError, "approve_failed", "Failed to approve request")
		}
		return
	}

	writeJSON(w, http.StatusOK, approved)
}

// MarkRequestInActionForDistribution sets an approved request to inAction and stores outgoing tracking code.
func (h *RequestHandler) MarkRequestInActionForDistribution(w http.ResponseWriter, r *http.Request) {
	requestID := strings.TrimSpace(chi.URLParam(r, "id"))
	if requestID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Request ID is required")
		return
	}

	var req markRequestInActionBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}
	req.DistributionCenterID = strings.TrimSpace(req.DistributionCenterID)
	req.OutgoingTrackingCode = strings.TrimSpace(req.OutgoingTrackingCode)
	if req.DistributionCenterID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "distributionCenterId is required")
		return
	}
	if req.OutgoingTrackingCode == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "outgoingTrackingCode is required")
		return
	}

	updated, err := h.Store.MarkRequestInAction(r.Context(), requestID, req.DistributionCenterID, req.OutgoingTrackingCode)
	if err != nil {
		switch {
		case errors.Is(err, db.ErrRequestNotFound):
			writeError(w, http.StatusNotFound, "not_found", "Request not found")
		case errors.Is(err, db.ErrRequestAlreadyApproved):
			writeError(w, http.StatusConflict, "already_approved", "Request belongs to another distribution center")
		case errors.Is(err, db.ErrInvalidRequestStatus):
			writeError(w, http.StatusConflict, "invalid_status", "Request must be approved before marking inAction")
		default:
			writeError(w, http.StatusInternalServerError, "update_failed", "Failed to update request")
		}
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

// CancelAssignedRequestForDistribution reverts approved/inAction request to pending and clears assignment/tracking.
func (h *RequestHandler) CancelAssignedRequestForDistribution(w http.ResponseWriter, r *http.Request) {
	requestID := strings.TrimSpace(chi.URLParam(r, "id"))
	if requestID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Request ID is required")
		return
	}

	var req cancelAssignedRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}
	req.DistributionCenterID = strings.TrimSpace(req.DistributionCenterID)
	if req.DistributionCenterID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "distributionCenterId is required")
		return
	}

	updated, err := h.Store.CancelAssignedRequest(r.Context(), requestID, req.DistributionCenterID)
	if err != nil {
		switch {
		case errors.Is(err, db.ErrRequestNotFound):
			writeError(w, http.StatusNotFound, "not_found", "Request not found")
		case errors.Is(err, db.ErrRequestAlreadyApproved):
			writeError(w, http.StatusConflict, "already_approved", "Request belongs to another distribution center")
		case errors.Is(err, db.ErrInvalidRequestStatus):
			writeError(w, http.StatusConflict, "invalid_status", "Request must be approved or inAction to cancel")
		default:
			writeError(w, http.StatusInternalServerError, "update_failed", "Failed to cancel request")
		}
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

func isValidRequestStatus(status string) bool {
	switch status {
	case "pending", "approved", "inAction", "returned":
		return true
	default:
		return false
	}
}
