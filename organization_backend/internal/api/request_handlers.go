package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"organization_backend/internal/db"
	"organization_backend/internal/domain"
)

type RequestHandler struct {
	Store *db.Store
}

type createRequestRequest struct {
	DeliveryDate         string `json:"deliveryDate"`
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

	slog.Info("create_request_date_validated", "delivery_date", deliveryDate)

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
